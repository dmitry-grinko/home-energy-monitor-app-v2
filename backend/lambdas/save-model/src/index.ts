import { SageMakerClient, CreateEndpointConfigCommand, CreateEndpointCommand, DescribeTrainingJobCommand } from '@aws-sdk/client-sagemaker';
import { SSMClient, PutParameterCommand } from '@aws-sdk/client-ssm';

const sagemakerClient = new SageMakerClient({ region: 'us-east-1' });
const ssmClient = new SSMClient({ region: 'us-east-1' });

const ENVIRONMENT = process.env.ENVIRONMENT!;

// Add structured logging helper
const log = {
  info: (message: string, data?: any) => {
    console.log(JSON.stringify({
      level: 'INFO',
      timestamp: new Date().toISOString(),
      message,
      data,
      lambda: 'save-model'
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
      lambda: 'save-model'
    }, null, 2));
  }
};

const createEndpoint = async (modelName: string): Promise<string> => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const endpointConfigName = `energy-prediction-config-${timestamp}`;
  const endpointName = `energy-prediction-endpoint-${timestamp}`;

  log.info('Creating endpoint configuration', { 
    modelName,
    endpointConfigName 
  });

  try {
    // Create endpoint configuration
    await sagemakerClient.send(new CreateEndpointConfigCommand({
      EndpointConfigName: endpointConfigName,
      ProductionVariants: [
        {
          InitialInstanceCount: 1,
          InstanceType: 'ml.t2.medium',
          ModelName: modelName,
          VariantName: 'AllTraffic',
          InitialVariantWeight: 1
        }
      ]
    }));

    log.info('Creating endpoint', { endpointName });

    // Create endpoint
    await sagemakerClient.send(new CreateEndpointCommand({
      EndpointName: endpointName,
      EndpointConfigName: endpointConfigName
    }));

    return endpointName;
  } catch (error) {
    log.error('Failed to create endpoint', error);
    throw error;
  }
};

const saveEndpointToParameterStore = async (endpointName: string): Promise<void> => {
  log.info('Saving endpoint to Parameter Store', { endpointName });

  try {
    await ssmClient.send(new PutParameterCommand({
      Name: `/${ENVIRONMENT}/sagemaker/endpoint-url`,
      Value: endpointName,
      Type: 'String',
      Overwrite: true
    }));

    log.info('Endpoint saved to Parameter Store successfully');
  } catch (error) {
    log.error('Failed to save endpoint to Parameter Store', error);
    throw error;
  }
};

export const handler = async (event: any): Promise<void> => {
  log.info('Save Model lambda started', { event });

  try {
    const trainingJobName = event.TrainingJobName;

    // Get training job details
    const trainingJob = await sagemakerClient.send(new DescribeTrainingJobCommand({
      TrainingJobName: trainingJobName
    }));

    if (!trainingJob.ModelArtifacts?.S3ModelArtifacts) {
      throw new Error('No model artifacts found');
    }

    // Create endpoint
    const endpointName = await createEndpoint(trainingJobName);

    // Save endpoint to Parameter Store
    await saveEndpointToParameterStore(endpointName);

    log.info('Save Model lambda completed successfully', {
      trainingJobName,
      endpointName
    });
  } catch (error) {
    log.error('Save Model lambda failed', error);
    throw error;
  }
};
