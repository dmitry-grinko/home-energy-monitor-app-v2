resource "aws_sfn_state_machine" "ml_pipeline" {
  name     = "${var.name}-ml-pipeline"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    Comment = "ML Pipeline for Energy Usage Prediction"
    StartAt = "ProcessData"
    States = {
      ProcessData = {
        Type = "Task"
        Resource = var.process_data_lambda_arn
        Next = "TrainModel"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 30
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next = "HandleError"
          }
        ]
      }
      TrainModel = {
        Type = "Task"
        Resource = "arn:aws:states:::sagemaker:createTrainingJob.sync"
        Parameters = {
          TrainingJobName = "States.Format('energy-prediction-{}', $$.Execution.StartTime)"
          AlgorithmSpecification = {
            TrainingImage = "433757028032.dkr.ecr.us-east-1.amazonaws.com/xgboost:1"
            TrainingInputMode = "File"
          }
          RoleArn = var.sagemaker_role_arn
          InputDataConfig = [
            {
              ChannelName = "train"
              DataSource = {
                S3DataSource = {
                  S3DataType = "S3Prefix"
                  S3Uri = "$.s3Path"
                  S3DataDistributionType = "FullyReplicated"
                }
              }
              ContentType = "text/csv"
            }
          ]
          OutputDataConfig = {
            S3OutputPath = "s3://${var.bucket_name}/model/output"
          }
          ResourceConfig = {
            InstanceCount = 1
            InstanceType = "ml.m4.xlarge"
            VolumeSizeInGB = 10
          }
          StoppingCondition = {
            MaxRuntimeInSeconds = 3600
          }
        }
        Next = "SaveModel"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 60
            MaxAttempts = 2
            BackoffRate = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next = "HandleError"
          }
        ]
      }
      SaveModel = {
        Type = "Task"
        Resource = var.save_model_lambda_arn
        End = true
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 30
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
        Catch = [
          {
            ErrorEquals = ["States.ALL"]
            Next = "HandleError"
          }
        ]
      }
      HandleError = {
        Type = "Fail"
        Error = "StatesError"
        Cause = "Error handling ML pipeline execution"
      }
    }
  })

  logging_configuration {
    level = "ALL"
    include_execution_data = true
    log_destination = "${aws_cloudwatch_log_group.step_functions.arn}:*"
  }

  tags = var.tags
}

resource "aws_cloudwatch_log_group" "step_functions" {
  name              = "/aws/step-functions/${var.name}-ml-pipeline"
  retention_in_days = 14
  tags             = var.tags
}

# IAM role for Step Functions
resource "aws_iam_role" "step_functions_role" {
  name = "${var.name}-step-functions-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# IAM policy for Step Functions
resource "aws_iam_role_policy" "step_functions_policy" {
  name = "${var.name}-step-functions-policy"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          var.process_data_lambda_arn,
          var.save_model_lambda_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sagemaker:CreateTrainingJob",
          "sagemaker:DescribeTrainingJob",
          "sagemaker:StopTrainingJob"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:GetLogDelivery",
          "logs:UpdateLogDelivery",
          "logs:DeleteLogDelivery",
          "logs:ListLogDeliveries",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
} 