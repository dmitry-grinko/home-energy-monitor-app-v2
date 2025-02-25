variable "bucket_name" {
  description = "Name of the S3 bucket"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "cloudfront_oai_iam_arn" {
  type        = string
  description = "IAM ARN of the CloudFront Origin Access Identity"
}
