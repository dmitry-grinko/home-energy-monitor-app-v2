import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, APIGatewayProxyResultV2 } from 'aws-lambda';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { jwtDecode } from 'jwt-decode';

// Initialize the S3 client outside the handler for better performance
const s3Client = new S3Client({ region: "us-east-1"});

const bucketName = process.env.BUCKET_NAME;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

if (!bucketName) {
  throw new Error('BUCKET_NAME is not set');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-ID-Token',
  'Access-Control-Allow-Methods': 'GET'
};

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> => {
  // Check if the path matches
  if ('path' in event && event.path !== '/dev/presigned-url') {
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ message: 'Not found' })
    };
  }

  try {
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

    const sub = idTokenPayload.sub;

    // Generate a unique file key using timestamp and user sub
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileKey = `user-uploads/${sub}/${sub}-${timestamp}-${randomString}.csv`;

    // Create the command for putting an object
    const putObjectCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileKey,
      ContentType: 'text/csv',
    });

    // Generate presigned URL (expires in 5 minutes)
    const presignedUrl = await getSignedUrl(s3Client, putObjectCommand, {
      expiresIn: 300 // 5 minutes
    });

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        presignedUrl,
        fileKey
      })
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Error generating presigned URL'
      })
    };
  }
};
