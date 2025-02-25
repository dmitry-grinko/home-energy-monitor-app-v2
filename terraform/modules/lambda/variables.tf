variable "function_name" {
  type        = string
  description = "Name of the Lambda function"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "runtime" {
  type        = string
  description = "Runtime for Lambda function"
}

variable "handler" {
  type        = string
  description = "Handler for Lambda function"
}

variable "log_retention_days" {
  type        = number
  description = "Number of days to retain CloudWatch logs"
}

variable "filename" {
  type        = string
  description = "Path to the Lambda deployment package"
}

variable "tags" {
  type        = map(string)
  description = "Tags to apply to resources"
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "timeout" {
  type        = number
  description = "Timeout for Lambda function in seconds"
  default     = 30
}

variable "memory_size" {
  type        = number
  description = "Memory size for Lambda function in MB"
  default     = 128
}

variable "additional_policies" {
  description = "List of additional IAM policies to attach to the Lambda role"
  type = list(object({
    name   = string
    policy = string
  }))
  default = []
}