import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import jwt, { JwtPayload } from 'jsonwebtoken';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const snsClient = new SNSClient({ region: 'us-east-1' });

const TABLE_NAME = process.env.TABLE_NAME!;
const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  "Access-Control-Allow-Headers" : "Content-Type",
  'Access-Control-Allow-Credentials': 'true'
};

interface EnergyInput {
  Date: string;  // Part of the primary key (sort key)
  EnergyUsage: number;
  Source: string;
  UserId: string;  // Part of the primary key (partition key)
  TTL: number;
  CreatedAt: string;
}

const handleInput = async (body: any, sub: string | (() => string)) => {  
  if (!body.date || !body.usage || !body.source || !sub) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Missing required fields: date, usage, source, idToken' })
    };
  }

  // Calculate TTL for 1 year from now
  const ttl = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

  const item: EnergyInput = {
    Date: body.date,
    EnergyUsage: body.usage,
    Source: body.source,
    UserId: typeof sub === 'function' ? sub() : sub,
    TTL: ttl,
    CreatedAt: new Date().toISOString()
  };

  try {
    // Save to DynamoDB
    await ddbClient.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: marshall(item, { removeUndefinedValues: true }),
    }));

    // Notify SNS
    await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Message: JSON.stringify({
        userId: item.UserId
      }),
      MessageAttributes: {
        'userId': {
          DataType: 'String',
          StringValue: item.UserId
        },
        'date': {
          DataType: 'String',
          StringValue: item.Date
        }
      }
    }));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Energy data saved successfully',
        data: item
      })
    };
  } catch (error) {
    console.error('Error saving to DynamoDB or publishing to SNS:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Failed to save energy usage'
      })
    };
  }
};

const handleHistory = async (queryParams: any, sub: string | (() => string)) => {
  if (!queryParams.startDate || !queryParams.endDate) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Missing required query parameters: startDate, endDate' })
    };
  }

  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'UserId = :userId AND #date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'Date'  // Date is a reserved word in DynamoDB
      },
      ExpressionAttributeValues: marshall({
        ':userId': sub,
        ':startDate': queryParams.startDate,
        ':endDate': queryParams.endDate
      }),
    };

    const { Items = [] } = await ddbClient.send(new QueryCommand(params));
    
    const energyData = Items.map(item => unmarshall(item));

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Energy history retrieved successfully',
        data: energyData
      })
    };
  } catch (error) {
    console.error('Error fetching from DynamoDB:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Failed to retrieve energy history'
      })
    };
  }
};

const handleSummary = async (queryParams: any, sub: string | (() => string)) => {
  if (!queryParams.period) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Missing required query parameter: period (daily/weekly/monthly)' })
    };
  }

  const period = queryParams.period.toLowerCase();
  if (!['daily', 'weekly', 'monthly'].includes(period)) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Invalid period. Must be daily, weekly, or monthly' })
    };
  }

  // Calculate date range based on period
  const endDate = new Date();
  const startDate = new Date();
  switch (period) {
    case 'daily':
      startDate.setDate(endDate.getDate() - 7); // Last 7 days
      break;
    case 'weekly':
      startDate.setDate(endDate.getDate() - 28); // Last 4 weeks
      break;
    case 'monthly':
      startDate.setMonth(endDate.getMonth() - 12); // Last 12 months
      break;
  }

  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'UserId = :userId AND #date BETWEEN :startDate AND :endDate',
      ExpressionAttributeNames: {
        '#date': 'Date'
      },
      ExpressionAttributeValues: marshall({
        ':userId': sub,
        ':startDate': startDate.toISOString().split('T')[0],
        ':endDate': endDate.toISOString().split('T')[0]
      }),
    };

    const { Items = [] } = await ddbClient.send(new QueryCommand(params));
    const energyData = Items.map(item => unmarshall(item) as EnergyInput);

    // Aggregate data based on period
    const aggregatedData = aggregateEnergyData(energyData, period);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: `Energy ${period} summary retrieved successfully`,
        data: aggregatedData
      })
    };
  } catch (error) {
    console.error('Error fetching summary from DynamoDB:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Failed to retrieve energy summary'
      })
    };
  }
};

interface AggregatedData {
  period: string;
  totalUsage: number;
  avgUsage: number;
  sourceBreakdown: { [key: string]: number };
}

function aggregateEnergyData(data: EnergyInput[], period: string): AggregatedData[] {
  const groupedData = new Map<string, EnergyInput[]>();

  data.forEach(item => {
    let periodKey: string;
    const date = new Date(item.Date);

    switch (period) {
      case 'daily': {
        periodKey = item.Date;
        break;
      }
      case 'weekly': {
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6 : 1);
        periodKey = new Date(date.setDate(diff)).toISOString().split('T')[0];
        break;
      }
      case 'monthly': {
        periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      }
      default: {
        periodKey = item.Date;
      }
    }

    if (!groupedData.has(periodKey)) {
      groupedData.set(periodKey, []);
    }
    groupedData.get(periodKey)!.push(item);
  });

  return Array.from(groupedData.entries()).map(([periodKey, items]) => {
    const sourceBreakdown: { [key: string]: number } = {};
    let totalUsage = 0;

    items.forEach(item => {
      totalUsage += item.EnergyUsage;
      sourceBreakdown[item.Source] = (sourceBreakdown[item.Source] || 0) + item.EnergyUsage;
    });

    return {
      period: periodKey,
      totalUsage,
      avgUsage: totalUsage / items.length,
      sourceBreakdown
    };
  }).sort((a, b) => a.period.localeCompare(b.period));
}

const handleDownload = async (sub: string | (() => string)) => {
  try {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: marshall({
        ':userId': sub
      }),
    };

    const { Items = [] } = await ddbClient.send(new QueryCommand(params));
    const energyData = Items.map(item => unmarshall(item) as EnergyInput);

    // Convert data to CSV format
    const csvHeaders = ['Date', 'Usage'];
    const csvRows = [
      csvHeaders.join(','),
      ...energyData.map(item => 
        `${item.Date},${item.EnergyUsage}`
      )
    ];
    const csvContent = csvRows.join('\n');

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="energy-data.csv"'
      },
      body: csvContent
    };
  } catch (error) {
    console.error('Error fetching data for download:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Failed to download energy data'
      })
    };
  }
};

// Type guard to check if event is V2
function isV2Event(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): event is APIGatewayProxyEventV2 {
  return 'requestContext' in event && 'http' in event.requestContext;
}

function getQueryParams(event: APIGatewayProxyEvent | APIGatewayProxyEventV2): Record<string, string | undefined> {
  const queryStringParams = event.queryStringParameters ?? {};
  return queryStringParams;
}

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> => {
  // Determine HTTP method and path based on event version
  const httpMethod = isV2Event(event) 
    ? event.requestContext.http.method 
    : event.httpMethod;

  const path = isV2Event(event) 
    ? event.rawPath 
    : event.path;

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    let idToken: string | undefined;
    let accessToken: string | undefined;

    try {
      idToken = event.headers['x-id-token'];
      accessToken = event.headers.authorization?.replace('Bearer ', '');
    } catch (error) {
      console.error('Error parsing headers:', error);
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Invalid headers' })
      };
    }

    if (!idToken || !accessToken) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized. Missing required tokens.' })
      };
    }

    // Decode and validate both tokens
    const idTokenPayload: JwtPayload = jwt.decode(idToken, { complete: true })?.payload as JwtPayload;
    const accessTokenPayload: JwtPayload = jwt.decode(accessToken, { complete: true })?.payload as JwtPayload;

    if (!idTokenPayload || !accessTokenPayload) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized. Invalid tokens.' })
      };
    }

    // Verify token claims
    const now = Math.floor(Date.now() / 1000);
    if (
      !idTokenPayload.sub ||
      !idTokenPayload.exp ||
      !accessTokenPayload.exp ||
      idTokenPayload.exp < now ||
      accessTokenPayload.exp < now
    ) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized. Tokens expired or invalid.' })
      };
    }

    // Verify tokens are from your Cognito user pool
    if (
      idTokenPayload.iss !== `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}` ||
      accessTokenPayload.iss !== `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}`
    ) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Unauthorized. Invalid token issuer.' })
      };
    }

    const sub = idTokenPayload.sub;

    const queryParams = getQueryParams(event);

    switch (path) {
      case '/dev/energy/input':
        return await handleInput(body, sub);
      case '/dev/energy/history':
        return await handleHistory(queryParams, sub);
      case '/dev/energy/summary':
        return await handleSummary(queryParams, sub);
      case '/dev/energy/download':
        return await handleDownload(sub);
      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Not Found' })
        };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: error instanceof Error ? error.message : 'Internal Server Error'
      })
    };
  }
};
