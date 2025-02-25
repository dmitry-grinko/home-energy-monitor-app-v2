module "lambda_auth" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-auth-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/auth/lambda-auth.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "ses-permissions"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "ses:ListIdentities",
              "ses:VerifyEmailIdentity",
              "ses:DeleteIdentity",
              "ses:GetIdentityVerificationAttributes"
            ]
            Resource = "*"
          }
        ]
      })
    }
  ]

  environment_variables = {
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    COGNITO_CLIENT_ID    = module.cognito.client_id
  }

  depends_on = [module.cognito]
}

module "lambda_energy" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-energy-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/energy/lambda-energy.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:BatchGetItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:DeleteItem",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:UpdateItem"
            ]
            Resource = [
              module.dynamodb_energy_usage.table_arn,
              "${module.dynamodb_energy_usage.table_arn}/index/*"
            ]
          }
        ]
      })
    },
    {
      name = "sns-publish"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "sns:Publish"
            ]
            Resource = [
              module.sns-email-topic.topic_arn
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    TABLE_NAME           = module.dynamodb_energy_usage.table_name
    SNS_TOPIC_ARN        = module.sns-email-topic.topic_arn
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
  }

  depends_on = [module.dynamodb_energy_usage, module.sns-email-topic, module.sns-websocket-topic]
}

module "lambda_presigned_url" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-presigned-url-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/presigned-url/lambda-presigned-url.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "s3-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "s3:GetObject",
              "s3:PutObject",
              "s3:DeleteObject"
            ]
            Resource = [
              module.s3_csv_storage.bucket_arn,
              "${module.s3_csv_storage.bucket_arn}/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    TABLE_NAME           = module.dynamodb_energy_usage.table_name
    BUCKET_NAME          = module.s3_csv_storage.bucket_id
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
  }

  depends_on = [module.dynamodb_energy_usage]
}

module "lambda_trigger" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-trigger-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/trigger/lambda-trigger.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:BatchGetItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:DeleteItem",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:UpdateItem"
            ]
            Resource = [
              module.dynamodb_energy_usage.table_arn,
              "${module.dynamodb_energy_usage.table_arn}/index/*"
            ]
          }
        ]
      })
    },
    {
      name = "s3-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "s3:GetObject",
              "s3:PutObject",
              "s3:DeleteObject"
            ]
            Resource = [
              "${module.s3_csv_storage.bucket_arn}/*"
            ]
          }
        ]
      })
    },
    {
      name = "sns-publish"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "sns:Publish"
            ]
            Resource = [
              module.sns-email-topic.topic_arn,
              module.sns-websocket-topic.topic_arn
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    TABLE_NAME              = module.dynamodb_energy_usage.table_name
    BUCKET_NAME             = module.s3_csv_storage.bucket_id
    SNS_TOPIC_ARN           = module.sns-email-topic.topic_arn
    SNS_WEBSOCKET_TOPIC_ARN = module.sns-websocket-topic.topic_arn // TODO: lambda trigger should notify users
  }

  depends_on = [module.dynamodb_energy_usage, module.s3_csv_storage, module.sns-email-topic, module.sns-websocket-topic]
}


module "lambda_email" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-email-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/email/lambda-email.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "ses-send-email"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "ses:SendEmail",
              "ses:SendRawEmail"
            ]
            Resource = "*"
          }
        ]
      })
    },
    {
      name = "dynamodb-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:GetItem",
              "dynamodb:Query"
            ]
            Resource = [
              module.dynamodb_energy_usage.table_arn,
              module.dynamodb_user_data.table_arn,
              "${module.dynamodb_energy_usage.table_arn}/index/*",
              "${module.dynamodb_user_data.table_arn}/index/*"
            ]
          }
        ]
      })
    },
    {
      name = "cognito-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "cognito-idp:AdminGetUser"
            ]
            Resource = module.cognito.user_pool_arn
          }
        ]
      })
    }
  ]

  environment_variables = {
    FROM_EMAIL           = var.from-email
    USER_DATA_TABLE      = module.dynamodb_user_data.table_name
    USAGE_TABLE_NAME     = module.dynamodb_energy_usage.table_name
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
  }

  depends_on = [module.ses, module.dynamodb_energy_usage, module.dynamodb_user_data, module.cognito]
}


module "lambda_user_data" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-user-data-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/user-data/lambda-user-data.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-user-data-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:BatchGetItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:DeleteItem",
              "dynamodb:GetItem",
              "dynamodb:PutItem",
              "dynamodb:Query",
              "dynamodb:Scan",
              "dynamodb:UpdateItem"
            ]
            Resource = [
              module.dynamodb_user_data.table_arn,
              "${module.dynamodb_user_data.table_arn}/index/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    USER_DATA_TABLE      = module.dynamodb_user_data.table_name
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
  }

  depends_on = [module.dynamodb_user_data]
}

module "lambda_prediction" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-prediction-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/prediction/lambda-prediction.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:GetItem"
            ]
            Resource = [
              module.dynamodb_user_data.table_arn
            ]
          }
        ]
      })
    },
    {
      name = "sagemaker-runtime"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "sagemaker:InvokeEndpoint",
              "sagemaker:DescribeEndpoint"
            ]
            Resource = "*"
          }
        ]
      })
    },
    {
      name = "ssm-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "ssm:GetParameter"
            ]
            Resource = aws_ssm_parameter.sagemaker_endpoint.arn
          }
        ]
      })
    }
  ]

  environment_variables = {
    USER_DATA_TABLE      = module.dynamodb_user_data.table_name
    COGNITO_USER_POOL_ID = module.cognito.user_pool_id
    SAGEMAKER_ENDPOINT   = aws_ssm_parameter.sagemaker_endpoint.name
    ENVIRONMENT          = var.environment
  }

  depends_on = [module.dynamodb_user_data]
}

module "lambda_connection" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-connection-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/connection/lambda-connection.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-connections-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:PutItem",
              "dynamodb:DeleteItem",
              "dynamodb:GetItem",
              "dynamodb:UpdateItem",
              "dynamodb:Query"
            ]
            Resource = [
              module.dynamodb_connections.table_arn,
              "${module.dynamodb_connections.table_arn}/index/*"
            ]
          }
        ]
      })
    },
    {
      name = "execute-api"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "execute-api:ManageConnections"
            ]
            Resource = [
              "${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    CONNECTIONS_TABLE      = module.dynamodb_connections.table_name
    WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
  }

  depends_on = [module.dynamodb_connections]
}

module "lambda_process_data" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-process-data-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/process-data/lambda-process-data.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-energy-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:Scan"
            ]
            Resource = [
              module.dynamodb_energy_usage.table_arn
            ]
          }
        ]
      })
    },
    {
      name = "s3-model-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "s3:PutObject"
            ]
            Resource = [
              "${module.s3_csv_storage.bucket_arn}/model/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    ENERGY_TABLE = module.dynamodb_energy_usage.table_name
    BUCKET_NAME  = module.s3_csv_storage.bucket_id
  }

  depends_on = [
    module.dynamodb_energy_usage,
    module.s3_csv_storage
  ]
}

module "lambda_save_model" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-save-model-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/save-model/lambda-save-model.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "sagemaker-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "sagemaker:CreateEndpointConfig",
              "sagemaker:CreateEndpoint",
              "sagemaker:DescribeTrainingJob",
              "sagemaker:DeleteEndpoint",
              "sagemaker:DeleteEndpointConfig",
              "sagemaker:CreateModel"
            ]
            Resource = "*"
          }
        ]
      })
    },
    {
      name = "iam-pass-role"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "iam:PassRole"
            ]
            Resource = [
              module.sagemaker.role_arn
            ]
          }
        ]
      })
    },
    {
      name = "ssm-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "ssm:PutParameter"
            ]
            Resource = aws_ssm_parameter.sagemaker_endpoint.arn
          }
        ]
      })
    }
  ]

  environment_variables = {
    ENVIRONMENT        = var.environment
    SAGEMAKER_ROLE_ARN = module.sagemaker.role_arn
  }

  depends_on = [
    aws_ssm_parameter.sagemaker_endpoint,
    module.sagemaker
  ]
}

module "lambda_websocket" {
  source = "./modules/lambda"

  function_name      = "${var.project-name}-websocket-v2"
  environment        = var.environment
  runtime            = "nodejs20.x"
  handler            = "index.handler"
  log_retention_days = 14
  filename           = "../backend/lambdas/websocket/lambda-websocket.zip"
  tags               = local.tags

  additional_policies = [
    {
      name = "dynamodb-connections-access"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "dynamodb:Query"
            ]
            Resource = [
              module.dynamodb_connections.table_arn,
              "${module.dynamodb_connections.table_arn}/index/*"
            ]
          }
        ]
      })
    },
    {
      name = "execute-api"
      policy = jsonencode({
        Version = "2012-10-17"
        Statement = [
          {
            Effect = "Allow"
            Action = [
              "execute-api:ManageConnections"
            ]
            Resource = [
              "${aws_apigatewayv2_api.websocket.execution_arn}/${var.environment}/*"
            ]
          }
        ]
      })
    }
  ]

  environment_variables = {
    CONNECTIONS_TABLE      = module.dynamodb_connections.table_name
    WEBSOCKET_API_ENDPOINT = "https://${aws_apigatewayv2_api.websocket.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${var.environment}"
  }

  depends_on = [
    module.dynamodb_connections,
    aws_apigatewayv2_api.websocket,
    aws_apigatewayv2_stage.websocket
  ]
}
