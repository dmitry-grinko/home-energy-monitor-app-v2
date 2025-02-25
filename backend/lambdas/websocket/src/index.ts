import { SNSEvent } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT!;

// Enhanced structured logging helper
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

interface ConnectionRecord {
  UserId: string;
  ConnectionId: string;
  TTL: number;
  CreatedAt: string;
}

const getConnectionsForUser = async (userId: string): Promise<ConnectionRecord[]> => {
  log.info('Getting connections for user', { userId });

  const queryParams = {
    TableName: CONNECTIONS_TABLE,
    KeyConditionExpression: 'UserId = :userId',
    ExpressionAttributeValues: {
      ':userId': { S: userId }
    }
  };

  const result = await ddbClient.send(new QueryCommand(queryParams));
  return result.Items?.map(item => unmarshall(item) as ConnectionRecord) || [];
};

const sendMessageToConnection = async (connectionId: string, message: any): Promise<void> => {
  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: WEBSOCKET_API_ENDPOINT
  });

  try {
    await apiClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(message))
    }));
    log.info('Message sent successfully', { connectionId });
  } catch (error: any) {
    if (error.statusCode === 410) {
      log.info('Connection is stale', { connectionId });
      return;
    }
    throw error;
  }
};

export const handler = async (event: SNSEvent): Promise<void> => {
  log.info('Processing SNS event', { recordCount: event.Records.length });

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      // Use hardcoded userId instead of getting it from MessageAttributes
      const userId = "1";
      
      log.info('Processing message for user', { userId, messageId: record.Sns.MessageId });

      const connections = await getConnectionsForUser(userId);
      
      if (connections.length === 0) {
        log.info('No active connections found for user', { userId });
        continue;
      }

      await Promise.all(
        connections.map(conn => sendMessageToConnection(conn.ConnectionId, message))
      );

      log.info('Message sent to all connections', { 
        userId, 
        connectionCount: connections.length 
      });

    } catch (error) {
      log.error('Failed to process SNS record', error);
    }
  }
};
