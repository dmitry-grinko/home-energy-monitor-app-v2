variable "name" {
  description = "Name prefix for all resources"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
}

variable "bucket_arn" {
  description = "ARN of the S3 bucket for model storage"
  type        = string
} 