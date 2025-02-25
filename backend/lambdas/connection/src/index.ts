import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
// import jwt, { JwtPayload } from 'jsonwebtoken';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
// const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

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

// const validateTokensAndGetUserId = (headers: Record<string, string | undefined>): string => {
//   log.info('Validating tokens', { headers: Object.keys(headers) });

//   const idToken = headers['x-id-token'];
//   const accessToken = headers.authorization?.replace('Bearer ', '');

//   if (!idToken || !accessToken) {
//     log.error('Missing tokens', { idTokenExists: !!idToken, accessTokenExists: !!accessToken });
//     throw new Error('Missing required tokens');
//   }

//   try {
//     // Decode and validate both tokens
//     const idTokenPayload: JwtPayload = jwt.decode(idToken, { complete: true })?.payload as JwtPayload;
//     const accessTokenPayload: JwtPayload = jwt.decode(accessToken, { complete: true })?.payload as JwtPayload;

//     if (!idTokenPayload || !accessTokenPayload) {
//       log.error('Invalid token payloads', {
//         idTokenPayloadExists: !!idTokenPayload,
//         accessTokenPayloadExists: !!accessTokenPayload
//       });
//       throw new Error('Invalid tokens');
//     }

//     // Verify token claims
//     const now = Math.floor(Date.now() / 1000);
//     const tokenValidation = {
//       idTokenSub: !!idTokenPayload.sub,
//       idTokenExp: idTokenPayload.exp,
//       accessTokenExp: accessTokenPayload.exp,
//       currentTime: now,
//       idTokenExpired: idTokenPayload.exp ? idTokenPayload.exp < now : true,
//       accessTokenExpired: accessTokenPayload.exp ? accessTokenPayload.exp < now : true
//     };

//     log.info('Token validation details', tokenValidation);

//     if (
//       !idTokenPayload.sub ||
//       !idTokenPayload.exp ||
//       !accessTokenPayload.exp ||
//       idTokenPayload.exp < now ||
//       accessTokenPayload.exp < now
//     ) {
//       throw new Error('Tokens expired or invalid');
//     }

//     // Verify tokens are from your Cognito user pool
//     const expectedIssuer = `https://cognito-idp.us-east-1.amazonaws.com/${COGNITO_USER_POOL_ID}`;
//     const issuersValid = {
//       expectedIssuer,
//       idTokenIssuer: idTokenPayload.iss,
//       accessTokenIssuer: accessTokenPayload.iss,
//       isValid: idTokenPayload.iss === expectedIssuer && accessTokenPayload.iss === expectedIssuer
//     };

//     log.info('Token issuer validation', issuersValid);

//     if (!issuersValid.isValid) {
//       throw new Error('Invalid token issuer');
//     }

//     log.info('Token validation successful', { userId: idTokenPayload.sub });
//     return idTokenPayload.sub;
//   } catch (error) {
//     log.error('Token validation failed', error);
//     throw error;
//   }
// };

const handleConnect = async (connectionId: string, userId: string): Promise<void> => {
  log.info('Handling connection', { connectionId, userId });

  const ttl = Math.floor(Date.now() / 1000) + (24 * 60 * 60); // 24 hours from now

  const item: ConnectionRecord = {
    UserId: userId,
    ConnectionId: connectionId,
    TTL: ttl,
    CreatedAt: new Date().toISOString()
  };

  await ddbClient.send(new PutItemCommand({
    TableName: CONNECTIONS_TABLE,
    Item: marshall(item)
  }));
};

const handleDisconnect = async (connectionId: string): Promise<void> => {
  log.info('Handling disconnection', { connectionId });

  await ddbClient.send(new DeleteItemCommand({
    TableName: CONNECTIONS_TABLE,
    Key: marshall({
      ConnectionId: connectionId
    })
  }));
};

export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const routeKey = event.requestContext.routeKey;
  
  if (!connectionId) {
    return { statusCode: 400, body: 'Missing connection ID' };
  }

  const userId = "1"; // TODO: get user ID

  try {
    switch (routeKey) {
      case '$connect':
        await handleConnect(connectionId, userId);
        return { statusCode: 200, body: 'Connected' };

      case '$disconnect':
        await handleDisconnect(connectionId);
        return { statusCode: 200, body: 'Disconnected' };

      default:
        return { statusCode: 400, body: 'Unsupported route' };
    }
  } catch (error) {
    log.error('Error handling connection', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};
