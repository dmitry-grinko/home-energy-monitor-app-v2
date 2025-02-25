locals {
  tags = {
    Environment = var.environment
    Name        = var.project-name
  }
}

data "aws_acm_certificate" "existing" {
  domain      = var.root-domain
  statuses    = ["ISSUED"]
  most_recent = true
}

data "aws_route53_zone" "main" {
  name = var.root-domain
}

module "waf" {
  source             = "./modules/waf"
  waf_name           = "my-waf"
  waf_description    = "My WAF for the application"
  ip_set_name        = "blocked-ip-addresses"
  ip_set_description = "IP set for blocking specific IPs"
  blocked_ips        = ["192.0.2.0/32", "203.0.113.0/32"] # Replace with your IPs
}

module "cloudfront" {
  source                      = "./modules/cloud-front"
  website_domain              = "${var.subdomain-name}.${var.root-domain}"
  bucket_regional_domain_name = module.s3_frontend.bucket_regional_domain_name
  acm_certificate_arn         = data.aws_acm_certificate.existing.arn
  waf_arn                     = module.waf.waf_arn
  tags = {
    Environment = var.environment
  }
  depends_on = [module.waf]
}

module "s3_frontend" {
  source = "./modules/s3-frontend"

  bucket_name            = var.bucket-name
  environment            = var.environment
  cloudfront_oai_iam_arn = module.cloudfront.cloudfront_oai_iam_arn
}

module "s3_csv_storage" {
  source = "./modules/s3-csv-storage"

  bucket_name     = "csv-storage-bucket-${var.environment}"
  environment     = var.environment
  allowed_origins = ["https://${var.subdomain-name}.${var.root-domain}", "http://localhost:4200"]
}

resource "aws_route53_record" "static_website" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "${var.subdomain-name}.${var.root-domain}"
  type    = "A"

  alias {
    name                   = module.cloudfront.cloudfront_distribution_domain_name
    zone_id                = module.cloudfront.cloudfront_distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

module "cognito" {
  source = "./modules/cognito"
  tags   = local.tags
}

resource "aws_lambda_permission" "allow_s3" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_trigger.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = module.s3_csv_storage.bucket_arn
}

resource "aws_s3_bucket_notification" "bucket_notification" {
  bucket = module.s3_csv_storage.bucket_id

  lambda_function {
    lambda_function_arn = module.lambda_trigger.function_arn
    events              = ["s3:ObjectCreated:*"]
    filter_prefix       = "user-uploads/"
    filter_suffix       = ".csv"
  }

  depends_on = [
    aws_lambda_permission.allow_s3,
    module.s3_csv_storage
  ]
}

module "api_gateway" {
  source = "./modules/api-gateway"

  name        = "${var.project-name}-api"
  environment = var.environment
  tags        = local.tags

  integrations = {
    auth = {
      lambda_function_arn  = module.lambda_auth.function_arn
      lambda_function_name = module.lambda_auth.function_name
      routes = [
        {
          method = "POST"
          path   = "/auth/login"
        },
        {
          method = "POST"
          path   = "/auth/signup"
        },
        {
          method = "POST"
          path   = "/auth/resend-code"
        },
        {
          method = "POST"
          path   = "/auth/verify"
        },
        {
          method = "POST"
          path   = "/auth/refresh"
        },
        {
          method = "POST"
          path   = "/auth/logout"
        },
        {
          method = "POST"
          path   = "/auth/forgot-password"
        },
        {
          method = "POST"
          path   = "/auth/password-reset"
        },
        {
          method = "OPTIONS"
          path   = "/{proxy+}"
        }
      ]
    },
    energy = {
      lambda_function_arn  = module.lambda_energy.function_arn
      lambda_function_name = module.lambda_energy.function_name
      routes = [
        {
          method = "POST"
          path   = "/energy/input"
        },
        {
          method = "GET"
          path   = "/energy/history"
        },
        {
          method = "GET"
          path   = "/energy/download"
        },
        {
          method = "GET"
          path   = "/energy/summary"
        },
      ]
    },
    presigned-url = {
      lambda_function_arn  = module.lambda_presigned_url.function_arn
      lambda_function_name = module.lambda_presigned_url.function_name
      routes = [
        {
          method = "GET"
          path   = "/presigned-url"
        }
      ]
    },
    alert = {
      lambda_function_arn  = module.lambda_user_data.function_arn
      lambda_function_name = module.lambda_user_data.function_name
      routes = [
        {
          method = "POST"
          path   = "/alerts"
        },
        {
          method = "GET"
          path   = "/alerts"
        }
      ]
    },
    prediction = {
      lambda_function_arn  = module.lambda_prediction.function_arn
      lambda_function_name = module.lambda_prediction.function_name
      routes = [
        {
          method = "GET"
          path   = "/prediction"
        },
      ]
    },
    model = {
      lambda_function_arn  = module.lambda_process_data.function_arn
      lambda_function_name = module.lambda_process_data.function_name
      routes = [
        {
          method = "POST"
          path   = "/train"
        }
      ]
    }
  }

  connection_lambda_arn = module.lambda_connection.function_arn
}

module "ses" {
  source          = "./modules/ses"
  domain_name     = var.root-domain
  route53_zone_id = data.aws_route53_zone.main.zone_id
}

# SageMaker IAM Role and Policy
resource "aws_iam_role" "sagemaker_role" {
  name = "sagemaker_role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "sagemaker.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# Add new ECR policy for SageMaker
resource "aws_iam_role_policy" "sagemaker_ecr_policy" {
  name = "sagemaker_ecr_policy"
  role = aws_iam_role.sagemaker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
        Resource = "arn:aws:ecr:us-east-1:*:repository/*"
      }
    ]
  })
}

resource "aws_iam_role_policy" "sagemaker_s3_policy" {
  name = "sagemaker_s3_policy"
  role = aws_iam_role.sagemaker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          module.s3_csv_storage.bucket_arn,
          "${module.s3_csv_storage.bucket_arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "sagemaker_cloudwatch_policy" {
  role       = aws_iam_role.sagemaker_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchFullAccess"
}

resource "aws_iam_role_policy_attachment" "sagemaker_full_access" {
  role       = aws_iam_role.sagemaker_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSageMakerFullAccess"
}

resource "aws_lambda_permission" "websocket_connection" {
  statement_id  = "AllowWebSocketInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_connection.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
}

# Add Step Functions module
module "step_functions" {
  source = "./modules/step-functions"

  name                    = "${var.project-name}-ml-pipeline"
  tags                    = local.tags
  bucket_name             = module.s3_csv_storage.bucket_id
  sagemaker_role_arn      = aws_iam_role.sagemaker_role.arn
  process_data_lambda_arn = module.lambda_process_data.function_arn
  save_model_lambda_arn   = module.lambda_save_model.function_arn
}

# Add CloudWatch Logs permissions for SageMaker
resource "aws_iam_role_policy" "sagemaker_cloudwatch_policy" {
  name = "sagemaker_cloudwatch_policy"
  role = aws_iam_role.sagemaker_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}


