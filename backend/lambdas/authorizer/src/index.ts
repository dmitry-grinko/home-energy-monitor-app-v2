import { APIGatewayRequestAuthorizerHandler } from 'aws-lambda';
import { CognitoJwtVerifier } from "aws-jwt-verify";

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const COGNITO_CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

const verifier = CognitoJwtVerifier.create({
  userPoolId: COGNITO_USER_POOL_ID,
  tokenUse: "id",
  clientId: COGNITO_CLIENT_ID,
});

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  try {
    console.log('Auth event', JSON.stringify(event, null, 2));

    const token = event.queryStringParameters?.auth;
    if (!token) {
      throw new Error('No token provided');
    }

    const payload = await verifier.verify(token);
    console.log('Token payload:', payload);

    return {
      isAuthorized: true,
      context: {
        userId: payload.sub,
        email: payload.email
      }
    };
  } catch (err) {
    console.error('Authorization failed:', err);
    return {
      isAuthorized: false,
      context: {}
    };
  }
}; 