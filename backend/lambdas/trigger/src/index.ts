import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { Readable } from 'stream';
import { parse } from 'csv-parse';

// Initialize clients outside the handler
const s3Client = new S3Client({ region: 'us-east-1' });
const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);
const snsClient = new SNSClient({ region: 'us-east-1' });

const tableName = process.env.TABLE_NAME;
const snsTopicArn = process.env.SNS_TOPIC_ARN;
const snsWebsocketTopicArn = process.env.SNS_WEBSOCKET_TOPIC_ARN;

if (!tableName) {
  throw new Error('TABLE_NAME environment variable is not set');
}

if (!snsTopicArn) {
  throw new Error('SNS_TOPIC_ARN environment variable is not set');
}

if (!snsWebsocketTopicArn) {
  throw new Error('SNS_WEBSOCKET_TOPIC_ARN environment variable is not set'); // TODO: Implement this logic later
}

interface CsvRow {
  Date: string;
  Usage: string;
}

async function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function isValidPath(key: string): boolean {
  // Path should be: /user-uploads/<userId>/<filename>.csv
  const pathParts = key.split('/');
  
  // Check if we have at least 3 parts (userId, user-uploads, and filename)
  if (pathParts.length < 3) return false;
  
  // Check if the second part is 'user-uploads'
  if (pathParts[0] !== 'user-uploads') return false;
  
  // Check if file ends with .csv
  if (!pathParts[pathParts.length - 1].toLowerCase().endsWith('.csv')) return false;
  
  return true;
}

export const handler = async (event: S3Event) => {
  try {
    // Process each record in the S3 event
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      console.log('Bucket', bucket);
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      console.log('Key', key);

      // Validate the path structure
      if (!isValidPath(key)) {
        console.log(`Skipping file ${key} - Invalid path structure`);
        continue;
      }

      // Extract userId from the file path (user-uploads/{userId}/...)
      const userId = key.split('/')[1];
      console.log('UserId', userId);
      // Get the file from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await s3Client.send(getObjectCommand);
      console.log('Response', response);
      if (!response.Body) {
        console.error('No body in S3 response');
        continue;
      }

      // Convert stream to string
      const csvContent = await streamToString(response.Body as Readable);

      // Parse CSV
      const records: CsvRow[] = await new Promise((resolve, reject) => {
        parse(csvContent, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
        }, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const currentDate = new Date();

      // Store each row in DynamoDB
      for (const row of records) {
        const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days TTL

        const item = {
          UserId: userId,
          Date: row.Date,
          CreatedAt: currentDate.toISOString(),
          EnergyUsage: parseInt(row.Usage, 10), // USAGE is reserved word in DynamoDB, so we use EnergyUsage instead https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ReservedWords.html
          TTL: ttl,
          Source: 'CSV file'
        };
        console.log('Item', item);

        // Save to DynamoDB
        await ddbDocClient.send(new PutCommand({
          TableName: tableName,
          Item: item
        }));
      }

      // Send single SNS notification after processing all records for this file
      await snsClient.send(new PublishCommand({
        TopicArn: snsTopicArn,
        Message: JSON.stringify({
          userId: userId,
          recordCount: records.length,
          fileName: key
        }),
        MessageAttributes: {
          'userId': {
            DataType: 'String',
            StringValue: userId
          }
        }
      }));
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully processed all records' })
    };
  } catch (error) {
    console.error('Error processing S3 event:', error);
    throw error;
  }
};
