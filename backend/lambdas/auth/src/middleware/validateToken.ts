import { 
  CognitoJwtVerifier 
} from "aws-jwt-verify";
import { APIGatewayProxyEvent } from 'aws-lambda';

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

const verifier = CognitoJwtVerifier.create({
  userPoolId: USER_POOL_ID,
  tokenUse: "access",
  clientId: CLIENT_ID,
});

export interface AuthenticatedEvent extends APIGatewayProxyEvent {
  user?: {
    sub: string;
    email: string;
    // Add other claims you need
  };
}

export async function validateToken(event: APIGatewayProxyEvent): Promise<AuthenticatedEvent> {
  const auth = event.headers.Authorization || event.headers.authorization;
  if (!auth) {
    throw new Error('No authorization header');
  }

  const token = auth.replace('Bearer ', '');
  try {
    const payload = await verifier.verify(token);
    return {
      ...event,
      user: {
        sub: payload.sub,
        email: payload.email as string,
      },
    };
  } catch (error) {
    throw new Error('Invalid token');
  }
} 