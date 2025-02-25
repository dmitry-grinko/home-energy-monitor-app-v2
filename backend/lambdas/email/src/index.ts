import { SNSEvent } from 'aws-lambda';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { CognitoIdentityProviderClient, AdminGetUserCommand } from '@aws-sdk/client-cognito-identity-provider';

const ses = new SESClient({});
const ddbClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(ddbClient);
const cognito = new CognitoIdentityProviderClient({});

const FROM_EMAIL = process.env.FROM_EMAIL!;
const USER_DATA_TABLE = process.env.USER_DATA_TABLE!;
const USAGE_TABLE = process.env.USAGE_TABLE_NAME!;
const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;

interface SNSMessage {
  userId: string;
}

async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const response = await cognito.send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: userId
    }));

    const emailAttribute = response.UserAttributes?.find(attr => attr.Name === 'email');
    return emailAttribute?.Value || null;

  } catch (error) {
    console.error('Error getting user email:', error);
    throw error;
  }
}

async function getUserThreshold(userId: string): Promise<number | null> {
  try {
    const response = await docClient.send(new GetCommand({
      TableName: USER_DATA_TABLE,
      Key: {
        UserId: userId
      }
    }));

    return response.Item?.threshold || null;
  } catch (error) {
    console.error('Error getting threshold:', error);
    throw error;
  }
}

async function getLatestUsage(userId: string): Promise<any | null> {
  try {   
    const response = await docClient.send(new QueryCommand({
      TableName: USAGE_TABLE,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': userId
      },
      ProjectionExpression: 'EnergyUsage, #date',
      ExpressionAttributeNames: {
        '#date': 'Date'
      },
      ScanIndexForward: false, // descending order
      Limit: 1
    }));

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    return response.Items[0];
  } catch (error) {
    console.error('Error getting latest usage:', error);
    throw error;
  }
}

async function sendAlertEmail(email: string, threshold: number, latestUsage: any): Promise<void> {
  const params = {
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: '🚨 Energy Usage Alert!'
      },
      Body: {
        Text: {
          Data: `🚨 Energy Usage Alert!

Your latest energy reading of ${latestUsage.EnergyUsage} kWh (recorded on ${new Date(latestUsage.Date).toLocaleDateString()}) exceeds your alert threshold of ${threshold} kWh.

💡 Visit https://pge.dmitrygrinko.com to view your complete energy usage history and manage your alert settings.`
        }
      }
    }
  };

  try {
    await ses.send(new SendEmailCommand(params));
  } catch (error) {
    console.error('❌ Error sending email:', error);
    throw error;
  }
}

export const handler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message) as SNSMessage;
      const { userId } = message;

      // Get user's email from Cognito
      const email = await getUserEmail(userId);
      if (!email) {
        console.log(`No email found for user ${userId}`);
        continue;
      }

      // Get user's threshold
      const threshold = await getUserThreshold(userId);
      if (!threshold) {
        console.log(`No threshold found for user ${userId}`);
        continue;
      }

      // Get latest usage
      const latestUsage = await getLatestUsage(userId);
      if (!latestUsage) {
        console.log(`No usage data found for user ${userId}`);
        continue;
      }

      // Compare and send alert if needed
      if (latestUsage.EnergyUsage > threshold) {
        await sendAlertEmail(email, threshold, latestUsage);
      } else {
        console.log(`Latest usage (${latestUsage.EnergyUsage}) is within threshold (${threshold}) for user ${userId}`);
      }
      
    } catch (error) {
      console.error('Error processing SNS record:', error);
      throw error; // Rethrowing to trigger SNS retry
    }
  }
};
