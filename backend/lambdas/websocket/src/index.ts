import { SNSEvent } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE!;
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT!;

// Enhanced structured logging helper
const log = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      data,
      environment: process.env.environment,
      lambda: 'websocket',
      connectionTable: CONNECTIONS_TABLE,
      apiEndpoint: WEBSOCKET_API_ENDPOINT
    }, null, 2));
  },
  error: (message: string, error?: any) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      message,
      environment: process.env.environment,
      lambda: 'websocket',
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      context: {
        connectionTable: CONNECTIONS_TABLE,
        apiEndpoint: WEBSOCKET_API_ENDPOINT
      }
    }, null, 2));
  },
  debug: (message: string, data?: any) => {
    if (process.env.DEBUG === 'true') {
      console.log(JSON.stringify({
        level: 'DEBUG',
        timestamp: new Date().toISOString(),
        message,
        data,
        environment: process.env.environment,
        lambda: 'websocket'
      }, null, 2));
    }
  }
};

interface ConnectionRecord {
  UserId: string;
  ConnectionId: string;
  TTL: number;
  CreatedAt: string;
}

interface DynamoDBItem {
  [key: string]: any;
}

const getConnectionsForUser = async (userId: string): Promise<ConnectionRecord[]> => {
  log.debug('Starting getConnectionsForUser', { userId });

  try {
    const queryParams = {
      TableName: CONNECTIONS_TABLE,
      KeyConditionExpression: 'UserId = :userId',
      ExpressionAttributeValues: {
        ':userId': { S: userId }
      }
    };
    
    log.debug('DynamoDB query parameters', queryParams);

    const result = await ddbClient.send(new QueryCommand(queryParams));

    const connections = result.Items?.map((item: DynamoDBItem) => unmarshall(item) as ConnectionRecord) || [];
    
    log.info('Retrieved connections from DynamoDB', { 
      userId,
      connectionCount: connections.length,
      connections: connections.map((conn: ConnectionRecord) => ({
        connectionId: conn.ConnectionId,
        createdAt: conn.CreatedAt,
        ttl: new Date(conn.TTL * 1000).toISOString()
      }))
    });

    return connections;
  } catch (error) {
    log.error('DynamoDB query failed in getConnectionsForUser', {
      userId,
      error,
      tableName: CONNECTIONS_TABLE
    });
    throw error;
  }
};

const sendMessageToConnection = async (connectionId: string, message: any): Promise<void> => {
  log.debug('Starting sendMessageToConnection', { 
    connectionId,
    messageType: typeof message,
    messageSize: JSON.stringify(message).length
  });

  const apiClient = new ApiGatewayManagementApiClient({
    endpoint: WEBSOCKET_API_ENDPOINT
  });

  try {
    const command = new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(message))
    });

    log.debug('Sending WebSocket message', {
      connectionId,
      endpoint: WEBSOCKET_API_ENDPOINT,
      messagePreview: JSON.stringify(message).substring(0, 100) + '...'
    });

    await apiClient.send(command);
    
    log.info('WebSocket message sent successfully', { 
      connectionId,
      messageType: typeof message,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    if (error.statusCode === 410) {
      log.info('Connection is stale, will be removed', { 
        connectionId,
        statusCode: error.statusCode,
        errorType: error.name
      });
      return;
    }
    
    log.error('Failed to send WebSocket message', {
      connectionId,
      endpoint: WEBSOCKET_API_ENDPOINT,
      errorDetails: {
        name: error.name,
        message: error.message,
        statusCode: error.statusCode,
        requestId: error.$metadata?.requestId
      }
    });
    throw error;
  }
};

export const handler = async (event: SNSEvent): Promise<void> => {
  log.info('WebSocket lambda invoked', { 
    recordCount: event.Records.length,
    timestamp: new Date().toISOString()
  });

  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const userId = record.Sns.MessageAttributes.userId.Value;
      const messageId = record.Sns.MessageId;

      log.info('Processing SNS message', { 
        messageId,
        userId,
        messageType: typeof message,
        timestamp: record.Sns.Timestamp
      });

      const connections = await getConnectionsForUser(userId);

      if (connections.length === 0) {
        log.info('No active connections found', { 
          userId,
          messageId,
          timestamp: new Date().toISOString()
        });
        continue;
      }

      log.debug('Preparing to send messages to connections', {
        userId,
        messageId,
        connectionCount: connections.length
      });

      const results = await Promise.allSettled(
        connections.map(conn => 
          sendMessageToConnection(conn.ConnectionId, message)
        )
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      log.info('Finished processing SNS message', {
        messageId,
        userId,
        totalConnections: connections.length,
        successfulSends: succeeded,
        failedSends: failed,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      log.error('Failed to process SNS record', {
        recordId: record.Sns.MessageId,
        timestamp: record.Sns.Timestamp,
        error
      });
    }
  }

  log.info('WebSocket lambda execution completed', {
    timestamp: new Date().toISOString()
  });
};
