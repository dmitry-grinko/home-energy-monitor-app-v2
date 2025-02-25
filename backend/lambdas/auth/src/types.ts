export interface LoginData {
  email: string;
  password: string;
}

export interface SignupData extends LoginData {
  name?: string;
}

export interface VerifyEmailData {
  email: string;
  code: string;
}

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
}

export interface AuthError extends Error {
  code?: string;
}

export interface CorsHeaders {
  'Access-Control-Allow-Origin': string;
  'Access-Control-Allow-Methods': string;
  'Access-Control-Allow-Headers': string;
  'Access-Control-Allow-Credentials': boolean;
  'Access-Control-Max-Age': number;
}

export interface ForgotPasswordData {
  email: string;
}

export interface PasswordResetData {
  email: string;
  code: string;
  newPassword: string;
} 