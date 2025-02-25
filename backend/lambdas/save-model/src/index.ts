import { SageMakerClient, CreateModelCommand, CreateEndpointConfigCommand, CreateEndpointCommand, DescribeTrainingJobCommand } from '@aws-sdk/client-sagemaker';
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

const createModel = async (trainingJobName: string, modelArtifacts: string, roleArn: string): Promise<string> => {
  const modelName = `model-${trainingJobName}`;
  
  log.info('Creating model', { 
    modelName,
    modelArtifacts 
  });

  try {
    await sagemakerClient.send(new CreateModelCommand({
      ModelName: modelName,
      PrimaryContainer: {
        Image: "382416733822.dkr.ecr.us-east-1.amazonaws.com/linear-learner:1",
        ModelDataUrl: modelArtifacts,
        Environment: {
          SAGEMAKER_PROGRAM: "train",
          SAGEMAKER_SUBMIT_DIRECTORY: "/opt/ml/model/code",
          SAGEMAKER_CONTAINER_LOG_LEVEL: "20",
          SAGEMAKER_REGION: "us-east-1"
        }
      },
      ExecutionRoleArn: roleArn
    }));

    return modelName;
  } catch (error) {
    log.error('Failed to create model', error);
    throw error;
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
    // Save endpoint name
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
  log.info('Save Model lambda started', { 
    event,
    environment: process.env.ENVIRONMENT,
    sagemakerRoleArn: process.env.SAGEMAKER_ROLE_ARN 
  });

  try {
    const trainingJobName = event.TrainingJobName;
    const roleArn = process.env.SAGEMAKER_ROLE_ARN!;

    // Get training job details
    log.info('Getting training job details', { trainingJobName });
    const trainingJob = await sagemakerClient.send(new DescribeTrainingJobCommand({
      TrainingJobName: trainingJobName
    }));

    log.info('Training job details retrieved', {
      modelArtifacts: trainingJob.ModelArtifacts,
      trainingJobStatus: trainingJob.TrainingJobStatus,
      failureReason: trainingJob.FailureReason
    });

    if (!trainingJob.ModelArtifacts?.S3ModelArtifacts) {
      throw new Error('No model artifacts found');
    }

    // Create model
    log.info('Creating SageMaker model', {
      modelArtifacts: trainingJob.ModelArtifacts.S3ModelArtifacts,
      roleArn
    });

    const modelName = await createModel(
      trainingJobName,
      trainingJob.ModelArtifacts.S3ModelArtifacts,
      roleArn
    );

    // Create endpoint
    log.info('Creating endpoint', { modelName });
    const endpointName = await createEndpoint(modelName);

    // Save endpoint to Parameter Store
    log.info('Saving endpoint to Parameter Store', { endpointName });
    await saveEndpointToParameterStore(endpointName);

    log.info('Save Model lambda completed successfully', {
      trainingJobName,
      modelName,
      endpointName,
      modelArtifacts: trainingJob.ModelArtifacts.S3ModelArtifacts
    });
  } catch (error) {
    log.error('Save Model lambda failed', error);
    throw error;
  }
};
