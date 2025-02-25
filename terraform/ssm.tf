# Parameter Store for SageMaker endpoint and model path
resource "aws_ssm_parameter" "sagemaker_endpoint" {
  name        = "/${var.environment}/sagemaker/endpoint-url"
  description = "SageMaker endpoint URL for energy usage prediction"
  type        = "String"
  value       = "placeholder" # Will be updated by Save Model lambda

  tags = local.tags
}

resource "aws_ssm_parameter" "model_path" {
  name        = "/${var.environment}/sagemaker/model-path"
  description = "S3 path to the latest SageMaker model"
  type        = "String"
  value       = "s3://${var.bucket-name}/model/latest"

  tags = local.tags
} 