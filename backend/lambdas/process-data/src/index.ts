import { DynamoDBClient, ScanCommand } from '@aws-sdk/client-dynamodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { unmarshall } from '@aws-sdk/util-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'us-east-1' });
const s3Client = new S3Client({ region: 'us-east-1' });

const ENERGY_TABLE = process.env.ENERGY_TABLE!;
const BUCKET_NAME = process.env.BUCKET_NAME!;

interface EnergyUsageRecord {
  UserId: string;
  Date: string;
  EnergyUsage: number;
  TTL?: number;
}

// Add structured logging helper
const log = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      data,
      lambda: 'process-data'
    }, null, 2));
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
      } : error,
      lambda: 'process-data'
    }, null, 2));
  }
};

const getAllEnergyData = async (): Promise<EnergyUsageRecord[]> => {
  log.info('Fetching all energy usage data');
  
  const records: EnergyUsageRecord[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    try {
      const command = new ScanCommand({
        TableName: ENERGY_TABLE,
        ExclusiveStartKey: lastEvaluatedKey
      });

      const response = await ddbClient.send(command);
      
      const items = response.Items?.map(item => unmarshall(item) as EnergyUsageRecord) || [];
      records.push(...items);
      
      lastEvaluatedKey = response.LastEvaluatedKey;

      log.info('Fetched batch of records', {
        batchSize: items.length,
        totalRecords: records.length,
        hasMoreData: !!lastEvaluatedKey
      });
    } catch (error) {
      log.error('Error fetching energy data', error);
      throw error;
    }
  } while (lastEvaluatedKey);

  return records;
};

const processDataForSageMaker = (records: EnergyUsageRecord[]): string => {
  log.info('Processing data for SageMaker', { recordCount: records.length });

  // Sort by date
  const sortedRecords = records.sort((a, b) => a.Date.localeCompare(b.Date));

  // Create CSV content
  const csvRows = [
    'date,usage',  // header
    ...sortedRecords.map(record => `${record.Date},${record.EnergyUsage}`)
  ];

  return csvRows.join('\n');
};

const saveToS3 = async (data: string): Promise<string> => {
  // Simplify timestamp to be more SageMaker-friendly
  const timestamp = new Date().getTime();
  
  // Simplify the key format
  const key = `model/training-${timestamp}.csv`;

  log.info('Saving data to S3', {
    bucket: BUCKET_NAME,
    key,
    dataSize: data.length
  });

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: data,
      ContentType: 'text/csv'
    }));

    // Ensure S3 URI format matches exactly what SageMaker expects
    const s3Uri = `s3://${BUCKET_NAME}/${key}`;
    log.info('Data saved successfully', { s3Uri });
    return s3Uri;
  } catch (error) {
    log.error('Error saving to S3', error);
    throw error;
  }
};

export const handler = async (): Promise<{ s3Path: string }> => {
  log.info('Process Data lambda started');

  try {
    // Get all energy usage data
    const records = await getAllEnergyData();
    
    if (records.length === 0) {
      log.error('No energy usage data found');
      throw new Error('No energy usage data found');
    }

    // Process data for SageMaker
    const processedData = processDataForSageMaker(records);

    // Save to S3
    const s3Path = await saveToS3(processedData);

    log.info('Process Data lambda completed successfully', { s3Path });

    return { s3Path };
  } catch (error) {
    log.error('Process Data lambda failed', error);
    throw error;
  }
};
