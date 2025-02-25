import { 
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  AuthFlowType,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ResendConfirmationCodeCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { AuthError, CognitoTokens } from '../types';

const cognitoClient = new CognitoIdentityProviderClient({});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

if (!USER_POOL_ID || !CLIENT_ID) {
  throw new Error('COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID is not set');
}

export class CognitoService {
  static async signUp(email: string, password: string): Promise<void> {
    try {
      await cognitoClient.send(
        new SignUpCommand({
          ClientId: CLIENT_ID,
          Username: email,
          Password: password,
          UserAttributes: [
            {
              Name: 'email',
              Value: email,
            },
          ],
        })
      );
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code === 'UsernameExistsException') {
        throw new Error('User already exists');
      }
      throw error;
    }
  }

  static async verifyEmail(email: string, code: string): Promise<void> {
    try {
      await cognitoClient.send(
        new ConfirmSignUpCommand({
          ClientId: CLIENT_ID,
          Username: email,
          ConfirmationCode: code,
        })
      );
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code === 'CodeMismatchException') {
        throw new Error('Invalid verification code');
      }
      throw error;
    }
  }

  static async login(email: string, password: string): Promise<CognitoTokens> {
    try {
      const response = await cognitoClient.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: CLIENT_ID,
          AuthParameters: {
            USERNAME: email,
            PASSWORD: password,
          },
        })
      );

      const result = response.AuthenticationResult;
      if (!result?.AccessToken || !result.IdToken || !result.RefreshToken) {
        throw new Error('Invalid authentication result');
      }

      return {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
        refreshToken: result.RefreshToken,
      };
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code === 'NotAuthorizedException') {
        throw new Error('Invalid credentials');
      }
      if (authError.code === 'UserNotConfirmedException') {
        throw new Error('Please verify your email first');
      }
      throw error;
    }
  }

  static async refreshToken(refreshToken: string): Promise<Omit<CognitoTokens, 'refreshToken'>> {
    try {
      const response = await cognitoClient.send(
        new InitiateAuthCommand({
          AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
          ClientId: CLIENT_ID,
          AuthParameters: {
            REFRESH_TOKEN: refreshToken,
          },
        })
      );

      const result = response.AuthenticationResult;
      if (!result?.AccessToken || !result.IdToken) {
        throw new Error('Invalid refresh result');
      }

      return {
        accessToken: result.AccessToken,
        idToken: result.IdToken,
      };
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code === 'NotAuthorizedException') {
        throw new Error('Invalid refresh token');
      }
      throw error;
    }
  }

  static async forgotPassword(email: string): Promise<void> {
    try {
      await cognitoClient.send(
        new ForgotPasswordCommand({
          ClientId: CLIENT_ID,
          Username: email,
        })
      );
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code === 'UserNotFoundException') {
        throw new Error('User not found');
      }
      if (authError.code === 'LimitExceededException') {
        throw new Error('Too many attempts. Please try again later');
      }
      throw error;
    }
  }

  static async resetPassword(email: string, code: string, newPassword: string): Promise<void> {
    try {
      await cognitoClient.send(
        new ConfirmForgotPasswordCommand({
          ClientId: CLIENT_ID,
          Username: email,
          ConfirmationCode: code,
          Password: newPassword,
        })
      );
    } catch (error) {
      const authError = error as AuthError;
      if (authError.code === 'CodeMismatchException') {
        throw new Error('Invalid verification code');
      }
      if (authError.code === 'ExpiredCodeException') {
        throw new Error('Verification code has expired');
      }
      if (authError.code === 'InvalidPasswordException') {
        throw new Error('Password does not meet requirements');
      }
      throw error;
    }
  }

  static async resendConfirmationCode(email: string): Promise<void> {
    const params = {
      ClientId: process.env.COGNITO_CLIENT_ID!,
      Username: email
    };

    try {
      await cognitoClient.send(new ResendConfirmationCodeCommand(params));
    } catch (error) {
      console.error('Error resending confirmation code:', error);
      throw error;
    }
  }
} 