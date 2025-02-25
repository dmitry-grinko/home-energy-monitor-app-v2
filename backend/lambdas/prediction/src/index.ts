import { APIGatewayProxyEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SageMakerRuntimeClient, InvokeEndpointCommand, ValidationError } from '@aws-sdk/client-sagemaker-runtime';
import { SageMakerClient, DescribeEndpointCommand, EndpointStatus } from '@aws-sdk/client-sagemaker';
import jwt, { JwtPayload } from 'jsonwebtoken';

const ddbClient = new DynamoDBClient();
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const sagemakerRuntime = new SageMakerRuntimeClient();
const sagemakerClient = new SageMakerClient();

const USER_DATA_TABLE = process.env.USER_DATA_TABLE!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,X-Id-Token,Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

interface PredictionResponse {
  date: string;
  prediction: number;
}

async function checkEndpointStatus(endpointName: string): Promise<EndpointStatus | null> {
  try {
    const response = await sagemakerClient.send(new DescribeEndpointCommand({
      EndpointName: endpointName
    }));
    if (response.EndpointStatus === undefined) {
      return null;
    }
    return response.EndpointStatus;
  } catch (error) {
    console.error('Error checking endpoint status:', error);
    return null;
  }
}

export const handler = async (event: APIGatewayProxyEvent): Promise<any> => {
  console.log('Prediction lambda invoked with event:', {
    httpMethod: event.httpMethod,
    path: event.path,
    queryParams: event.queryStringParameters,
    headers: {
      ...event.headers,
      'authorization': event.headers.authorization ? '[REDACTED]' : undefined,
      'x-id-token': event.headers['x-id-token'] ? '[REDACTED]' : undefined
    }
  });

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    // Token validation
    const idToken = event.headers['x-id-token'];
    const accessToken = event.headers.authorization?.replace('Bearer ', '');

    console.log('Validating tokens:', {
      hasIdToken: !!idToken,
      hasAccessToken: !!accessToken
    });

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

    console.log('Token payloads:', {
      idTokenIss: idTokenPayload?.iss,
      accessTokenIss: accessTokenPayload?.iss,
      expectedIss: `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}`
    });

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
    console.log('Authenticated user:', { userId });

    // Rest of your existing prediction logic
    if (!event.queryStringParameters?.date || isNaN(new Date(event.queryStringParameters.date).getTime())) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Valid date parameter is required (YYYY-MM-DD)' })
      };
    }

    // Get user's endpoint from DynamoDB
    const userDataResponse = await ddbDocClient.send(new GetCommand({
      TableName: USER_DATA_TABLE,
      Key: { UserId: userId }
    }));

    console.log('User data from DynamoDB:', {
      hasData: !!userDataResponse.Item,
      endpoint: userDataResponse.Item?.sagemakerEndpoint,
      trainingStartDate: userDataResponse.Item?.trainingStartDate
    });

    const endpointName = userDataResponse.Item?.sagemakerEndpoint;
    if (!endpointName) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'No trained model found. Please upload at least 100 energy consumption records to train the prediction model.',
          requiresData: true 
        })
      };
    }

    // Check endpoint status before invoking
    const endpointStatus = await checkEndpointStatus(endpointName);
    console.log('Endpoint status:', { endpointName, status: endpointStatus });

    if (!endpointStatus) {
      // Endpoint doesn't exist
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Prediction model needs to be retrained. Please try again in a few minutes.',
          requiresRetrain: true 
        })
      };
    }

    if (endpointStatus !== 'InService') {
      return {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: `Prediction model is currently ${endpointStatus}. Please try again in a few minutes.`,
          status: endpointStatus
        })
      };
    }

    // Convert prediction date to days since first training date
    const predictionDate = new Date(event.queryStringParameters.date);
    const trainingStartDate = new Date(userDataResponse.Item?.trainingStartDate || predictionDate);
    const daysSinceStart = (predictionDate.getTime() - trainingStartDate.getTime()) / (1000 * 60 * 60 * 24);

    console.log('Prediction calculation:', {
      predictionDate: predictionDate.toISOString(),
      trainingStartDate: trainingStartDate.toISOString(),
      daysSinceStart
    });

    // Prepare input in the same format as training data
    const input = `${daysSinceStart}`;

    console.log('Invoking SageMaker endpoint:', {
      endpointName,
      input,
      contentType: 'text/csv'
    });

    // Invoke SageMaker endpoint
    const response = await sagemakerRuntime.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'text/csv',
      Body: input
    }));

    // Add detailed logging of the raw response
    const rawResponse = Buffer.from(response.Body as Uint8Array).toString('utf-8');
    console.log('Raw SageMaker response:', {
      rawResponse,
      responseType: typeof rawResponse,
      responseLength: rawResponse.length
    });

    // Parse the prediction result with validation
    const prediction = parseFloat(rawResponse);
    
    if (isNaN(prediction)) {
      console.error('Invalid prediction value:', {
        rawResponse,
        parsed: prediction
      });
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Received invalid prediction value from the model'
        })
      };
    }

    console.log('Prediction result:', {
      rawResponse,
      rawPrediction: prediction,
      roundedPrediction: Math.round(prediction)
    });

    const result: PredictionResponse = {
      date: event.queryStringParameters.date,
      prediction: Math.round(prediction)
    };

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(result)
    };

  } catch (error) {
    console.error('Error making prediction:', {
      error,
      message: (error as Error).message,
      stack: (error as Error).stack
    });

    // Handle specific error types
    if (error instanceof ValidationError) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Prediction model needs to be retrained. Please try again in a few minutes.',
          requiresRetrain: true 
        })
      };
    }

    // Handle token validation errors
    if ((error as Error).message.includes('token')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Your session has expired. Please sign in again.'
        })
      };
    }

    // Handle SageMaker service errors
    if ((error as Error).message.includes('SageMaker')) {
      return {
        statusCode: 503,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'The prediction service is temporarily unavailable. Please try again in a few minutes.'
        })
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ 
        message: 'Unable to make prediction at this time. Please try again later.'
      })
    };
  }
};