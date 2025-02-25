interface EnvConfig {
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  STAGE: string;
}

function validateEnv(): EnvConfig {
  const requiredEnvVars = [
    'COGNITO_USER_POOL_ID',
    'COGNITO_CLIENT_ID',
    'STAGE'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID!,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID!,
    STAGE: process.env.STAGE!
  };
}

export const config = validateEnv(); 