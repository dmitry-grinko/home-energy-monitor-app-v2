variable "aws-region" {
  description = "AWS region"
  type        = string
}

variable "aws-access-key-id" {
  description = "AWS access key"
  type        = string
}

variable "aws-secret-access-key" {
  description = "AWS secret key"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
  default     = "dev"
}

variable "project-name" {
  description = "Name of the project used for resource naming"
  type        = string
}

variable "bucket-name" {
  description = "Name of the S3 bucket for static website"
  type        = string
}

variable "subdomain-name" {
  description = "Subdomain name for the static website"
  type        = string
}

variable "root-domain" {
  description = "Root domain name (e.g., example.com)"
  type        = string
}

variable "from-email" {
  description = "Email address to send alerts from"
  type        = string
}
