import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult } from 'aws-lambda';
import { jwtDecode } from 'jwt-decode';

const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const tableName = process.env.USER_DATA_TABLE!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Id-Token',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,DELETE'
};

interface AlertThreshold {
  threshold: number;
}

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult> => {
  // Handle OPTIONS requests for CORS
  if ('httpMethod' in event && event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  let idToken: string | undefined;
  let accessToken: string | undefined;
  
  try {
    idToken = event.headers['x-id-token'] || event.headers['X-Id-Token'];
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
  const idTokenPayload = jwtDecode(idToken);
  const accessTokenPayload = jwtDecode(accessToken);

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

  const userId = idTokenPayload.sub;

  try {
    const method = 'httpMethod' in event ? event.httpMethod : event.requestContext.http.method;
    
    switch (method) {
      case 'POST': {
        // Set new threshold
        const body = JSON.parse(event.body || '{}') as AlertThreshold;
        
        if (typeof body.threshold !== 'number' || body.threshold <= 0) {
          return {
            statusCode: 400,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'Invalid threshold value' })
          };
        }

        await docClient.send(new PutCommand({
          TableName: tableName,
          Item: {
            UserId: userId,
            threshold: body.threshold,
            TTL: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // TTL 1 year from now
          }
        }));

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Threshold set successfully' })
        };
      }

      case 'GET': {
        // Get current threshold
        const response = await docClient.send(new GetCommand({
          TableName: tableName,
          Key: {
            UserId: userId
          }
        }));

        if (!response.Item) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({ message: 'No threshold found' })
          };
        }

        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ threshold: response.Item.threshold })
        };
      }

      default:
        return {
          statusCode: 405,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};