import { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import jwt, { JwtPayload } from 'jsonwebtoken';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Id-Token',
  'Access-Control-Allow-Credentials': 'true'
};

interface ConnectionRecord {
  UserId: string;
  ConnectionId: string;
  TTL: number;
  CreatedAt: string;
}

// Add structured logging helper
const log = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      data
    }));
  },
  error: (message: string, error?: any) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    }));
  }
};

const validateTokensAndGetUserId = (headers: Record<string, string | undefined>): string => {
  log.info('Validating tokens', { headers: Object.keys(headers) });

  const idToken = headers['x-id-token'];
  const accessToken = headers.authorization?.replace('Bearer ', '');

  if (!idToken || !accessToken) {
    log.error('Missing tokens', { idTokenExists: !!idToken, accessTokenExists: !!accessToken });
    throw new Error('Missing required tokens');
  }

  try {
    // Decode and validate both tokens
    const idTokenPayload: JwtPayload = jwt.decode(idToken, { complete: true })?.payload as JwtPayload;
    const accessTokenPayload: JwtPayload = jwt.decode(accessToken, { complete: true })?.payload as JwtPayload;

    if (!idTokenPayload || !accessTokenPayload) {
      log.error('Invalid token payloads', {
        idTokenPayloadExists: !!idTokenPayload,
        accessTokenPayloadExists: !!accessTokenPayload
      });
      throw new Error('Invalid tokens');
    }

    // Verify token claims
    const now = Math.floor(Date.now() / 1000);
    const tokenValidation = {
      idTokenSub: !!idTokenPayload.sub,
      idTokenExp: idTokenPayload.exp,
      accessTokenExp: accessTokenPayload.exp,
      currentTime: now,
      idTokenExpired: idTokenPayload.exp ? idTokenPayload.exp < now : true,
      accessTokenExpired: accessTokenPayload.exp ? accessTokenPayload.exp < now : true
    };

    log.info('Token validation details', tokenValidation);

    if (
      !idTokenPayload.sub ||
      !idTokenPayload.exp ||
      !accessTokenPayload.exp ||
      idTokenPayload.exp < now ||
      accessTokenPayload.exp < now
    ) {
      throw new Error('Tokens expired or invalid');
    }

    // Verify tokens are from your Cognito user pool
    const expectedIssuer = `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}`;
    const issuersValid = {
      expectedIssuer,
      idTokenIssuer: idTokenPayload.iss,
      accessTokenIssuer: accessTokenPayload.iss,
      isValid: idTokenPayload.iss === expectedIssuer && accessTokenPayload.iss === expectedIssuer
    };

    log.info('Token issuer validation', issuersValid);

    if (!issuersValid.isValid) {
      throw new Error('Invalid token issuer');
    }

    log.info('Token validation successful', { userId: idTokenPayload.sub });
    return idTokenPayload.sub;
  } catch (error) {
    log.error('Token validation failed', error);
    throw error;
  }
};

const handleConnect = async (connectionId: string, userId: string): Promise<void> => {
  log.info('Handling connection', { connectionId, userId });

  try {
    const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60);

    const item: ConnectionRecord = {
      UserId: userId,
      ConnectionId: connectionId,
      TTL: ttl,
      CreatedAt: new Date().toISOString()
    };

    log.info('Saving connection record', { item });

    await ddbClient.send(new PutItemCommand({
      TableName: CONNECTIONS_TABLE,
      Item: marshall(item, { removeUndefinedValues: true })
    }));

    log.info('Connection record saved successfully');
  } catch (error) {
    log.error('Failed to save connection record', error);
    throw error;
  }
};

const handleDisconnect = async (connectionId: string): Promise<void> => {
  log.info('Handling disconnection', { connectionId });

  try {
    await ddbClient.send(new DeleteItemCommand({
      TableName: CONNECTIONS_TABLE,
      Key: marshall({
        ConnectionId: connectionId
      })
    }));

    log.info('Connection record deleted successfully');
  } catch (error) {
    log.error('Failed to delete connection record', error);
    throw error;
  }
};

export const handler = async (
  event: APIGatewayProxyEvent | APIGatewayProxyEventV2
): Promise<APIGatewayProxyResult | APIGatewayProxyResultV2> => {
  log.info('Lambda invoked', {
    routeKey: event.requestContext.routeKey,
    requestId: event.requestContext.requestId
  });

  try {
    const routeKey = event.requestContext.routeKey;
    const connectionId = 'connectionId' in event.requestContext 
      ? (event.requestContext as any).connectionId 
      : undefined;

    log.info('Processing request', { routeKey, connectionId });

    if (!connectionId) {
      log.error('Missing connection ID');
      throw new Error('Missing connection ID');
    }

    switch (routeKey) {
      case '$connect': {
        const userId = validateTokensAndGetUserId(event.headers);
        await handleConnect(connectionId, userId);
        log.info('Connection successful', { connectionId, userId });
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Connected successfully' })
        };
      }

      case '$disconnect': {
        await handleDisconnect(connectionId);
        log.info('Disconnection successful', { connectionId });
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Disconnected successfully' })
        };
      }

      default:
        log.error('Unsupported route', { routeKey });
        return {
          statusCode: 400,
          headers: corsHeaders,
          body: JSON.stringify({ message: 'Unsupported route' })
        };
    }
  } catch (error) {
    log.error('Request processing failed', error);
    return {
      statusCode: error instanceof Error && error.message.includes('token') ? 401 : 500,
      headers: corsHeaders,
      body: JSON.stringify({
        message: error instanceof Error ? error.message : 'Internal Server Error'
      })
    };
  }
};
