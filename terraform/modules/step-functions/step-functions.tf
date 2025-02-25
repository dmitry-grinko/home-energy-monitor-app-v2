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
        Next = "NotifyProcessDataComplete"
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
            Next = "NotifyError"
          }
        ]
      }
      NotifyProcessDataComplete = {
        Type = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = var.websocket_sns_topic_arn
          Message = {
            "type": "ML_PIPELINE_STATUS"
            "data": {
              "step": "ProcessData"
              "status": "SUCCEEDED"
              "executionId.$": "$$.Execution.Id"
              "timestamp.$": "$$.State.EnteredTime"
            }
          }
        }
        Next = "TrainModel"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
      }
      TrainModel = {
        Type = "Task"
        Resource = "arn:aws:states:::sagemaker:createTrainingJob.sync"
        Parameters = {
          TrainingJobName = "training-${substr(uuid(), 0, 8)}"
          AlgorithmSpecification = {
            TrainingImage = "683313688378.dkr.ecr.us-east-1.amazonaws.com/sagemaker-xgboost:1.5-1"
            TrainingInputMode = "File"
          }
          RoleArn = var.sagemaker_role_arn
          InputDataConfig = [
            {
              ChannelName = "training"
              DataSource = {
                S3DataSource = {
                  S3Uri = "s3://${var.bucket_name}/model/training-data.csv"
                  S3DataType = "S3Prefix"
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
        Next = "NotifyTrainModelComplete"
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
            Next = "NotifyError"
          }
        ]
      }
      NotifyTrainModelComplete = {
        Type = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = var.websocket_sns_topic_arn
          Message = {
            "type": "ML_PIPELINE_STATUS"
            "data": {
              "step": "TrainModel"
              "status": "SUCCEEDED"
              "executionId.$": "$$.Execution.Id"
              "timestamp.$": "$$.State.EnteredTime"
            }
          }
        }
        Next = "SaveModel"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
      }
      SaveModel = {
        Type = "Task"
        Resource = var.save_model_lambda_arn
        Next = "NotifySaveModelComplete"
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
            Next = "NotifyError"
          }
        ]
      }
      NotifySaveModelComplete = {
        Type = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = var.websocket_sns_topic_arn
          Message = {
            "type": "ML_PIPELINE_STATUS"
            "data": {
              "step": "SaveModel"
              "status": "SUCCEEDED"
              "executionId.$": "$$.Execution.Id"
              "timestamp.$": "$$.State.EnteredTime"
            }
          }
        }
        End = true
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2
          }
        ]
      }
      NotifyError = {
        Type = "Task"
        Resource = "arn:aws:states:::sns:publish"
        Parameters = {
          TopicArn = var.websocket_sns_topic_arn
          Message = {
            "type": "ML_PIPELINE_STATUS"
            "data": {
              "step.$": "$$.State.Name"
              "status": "FAILED"
              "executionId.$": "$$.Execution.Id"
              "timestamp.$": "$$.State.EnteredTime"
              "error.$": "$.error"
              "cause.$": "$.cause"
            }
          }
        }
        Next = "HandleError"
        Retry = [
          {
            ErrorEquals = ["States.ALL"]
            IntervalSeconds = 2
            MaxAttempts = 3
            BackoffRate = 2
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
          "sagemaker:StopTrainingJob",
          "sagemaker:ListTags",
          "sagemaker:AddTags"
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
          "logs:PutLogEvents",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "iam:PassRole"
        ]
        Resource = [
          var.sagemaker_role_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "events:PutTargets",
          "events:PutRule",
          "events:DescribeRule"
        ]
        Resource = [
          "arn:aws:events:*:*:rule/StepFunctionsGetEventsForSageMakerTrainingJobsRule"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = [
          var.websocket_sns_topic_arn
        ]
      }
    ]
  })
} 