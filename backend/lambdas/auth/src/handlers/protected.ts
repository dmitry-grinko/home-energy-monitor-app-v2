import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { validateToken } from '../middleware/validateToken';
import { corsHeaders } from '../utils/cors';

export const protectedHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    // Validate JWT token
    const authenticatedEvent = await validateToken(event);
    
    // Now you have access to the user info
    const { user } = authenticatedEvent;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        message: 'Protected route accessed successfully',
        user: {
          email: user?.email,
          // Don't send sensitive data like sub
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({
        message: error instanceof Error ? error.message : 'Unauthorized'
      })
    };
  }
} 