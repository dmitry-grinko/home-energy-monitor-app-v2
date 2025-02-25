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

const processDataForSageMaker = (records: EnergyUsageRecord[]): { training: string, validation: string } => {
  log.info('Processing data for SageMaker', { recordCount: records.length });

  // Sort by date
  const sortedRecords = records.sort((a, b) => a.Date.localeCompare(b.Date));

  // Split data - 80% training, 20% validation
  const splitIndex = Math.floor(sortedRecords.length * 0.8);
  const trainingRecords = sortedRecords.slice(0, splitIndex);
  const validationRecords = sortedRecords.slice(splitIndex);

  log.info('Split data', {
    totalRecords: records.length,
    trainingCount: trainingRecords.length,
    validationCount: validationRecords.length
  });

  // Create CSV header and content
  const csvHeader = 'date,usage';
  const trainingCsv = [
    csvHeader,
    ...trainingRecords.map(record => `${record.Date},${record.EnergyUsage}`)
  ].join('\n');

  const validationCsv = [
    csvHeader,
    ...validationRecords.map(record => `${record.Date},${record.EnergyUsage}`)
  ].join('\n');

  return { training: trainingCsv, validation: validationCsv };
};

const saveToS3 = async (data: { training: string, validation: string }): Promise<{ training: string, validation: string }> => {
  const trainingKey = 'model/training-data.csv';
  const validationKey = 'model/validation-data.csv';

  log.info('Saving data to S3', {
    bucket: BUCKET_NAME,
    trainingSize: data.training.length,
    validationSize: data.validation.length
  });

  try {
    // Save training data
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: trainingKey,
      Body: data.training,
      ContentType: 'text/csv'
    }));

    // Save validation data
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: validationKey,
      Body: data.validation,
      ContentType: 'text/csv'
    }));

    return {
      training: `s3://${BUCKET_NAME}/${trainingKey}`,
      validation: `s3://${BUCKET_NAME}/${validationKey}`
    };
  } catch (error) {
    log.error('Error saving to S3', error);
    throw error;
  }
};

export const handler = async (): Promise<{ trainingPath: string, validationPath: string }> => {
  log.info('Process Data lambda started');

  try {
    const records = await getAllEnergyData();
    
    if (records.length === 0) {
      log.error('No energy usage data found');
      throw new Error('No energy usage data found');
    }

    // Process and split data
    const processedData = processDataForSageMaker(records);

    // Save both datasets to S3
    const paths = await saveToS3(processedData);

    log.info('Process Data lambda completed successfully', paths);

    return {
      trainingPath: paths.training,
      validationPath: paths.validation
    };
  } catch (error) {
    log.error('Process Data lambda failed', error);
    throw error;
  }
};
