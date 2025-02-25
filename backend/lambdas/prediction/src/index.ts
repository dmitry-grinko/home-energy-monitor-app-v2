import { APIGatewayProxyEvent } from 'aws-lambda';
import { SageMakerRuntimeClient, InvokeEndpointCommand, ValidationError } from '@aws-sdk/client-sagemaker-runtime';
import { SageMakerClient, DescribeEndpointCommand, EndpointStatus } from '@aws-sdk/client-sagemaker';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import jwt, { JwtPayload } from 'jsonwebtoken';

const sagemakerRuntime = new SageMakerRuntimeClient();
const sagemakerClient = new SageMakerClient();
const ssmClient = new SSMClient();

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const SAGEMAKER_ENDPOINT_PARAM = process.env.SAGEMAKER_ENDPOINT!;

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

async function getEndpointName(): Promise<string> {
  try {
    const response = await ssmClient.send(new GetParameterCommand({
      Name: SAGEMAKER_ENDPOINT_PARAM
    }));
    
    if (!response.Parameter?.Value) {
      throw new Error('No endpoint found in Parameter Store');
    }
    
    return response.Parameter.Value;
  } catch (error) {
    console.error('Error getting endpoint from SSM:', error);
    throw error;
  }
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
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

    // Validate date parameter
    if (!event.queryStringParameters?.date || isNaN(new Date(event.queryStringParameters.date).getTime())) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ message: 'Valid date parameter is required (YYYY-MM-DD)' })
      };
    }

    // Get endpoint name from SSM
    const endpointName = await getEndpointName();
    console.log('Retrieved endpoint name from SSM:', endpointName);

    // Check endpoint status
    const endpointStatus = await checkEndpointStatus(endpointName);
    console.log('Endpoint status:', { endpointName, status: endpointStatus });

    if (!endpointStatus) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Prediction model not found. Please try again in a few minutes.',
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

    // Calculate day of year for the prediction date
    const predictionDate = new Date(event.queryStringParameters.date);
    const dayOfYear = getDayOfYear(predictionDate);

    console.log('Prediction calculation:', {
      predictionDate: predictionDate.toISOString(),
      dayOfYear
    });

    // Invoke SageMaker endpoint
    console.log('Invoking SageMaker endpoint:', {
      endpointName,
      input: dayOfYear.toString(),
      contentType: 'text/csv'
    });

    const response = await sagemakerRuntime.send(new InvokeEndpointCommand({
      EndpointName: endpointName,
      ContentType: 'text/csv',
      Body: dayOfYear.toString()
    }));

    // Parse the prediction result
    const rawResponse = Buffer.from(response.Body as Uint8Array).toString('utf-8');
    console.log('Raw SageMaker response:', {
      rawResponse,
      responseType: typeof rawResponse,
      responseLength: rawResponse.length
    });

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

    if ((error as Error).message.includes('token')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ 
          message: 'Your session has expired. Please sign in again.'
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