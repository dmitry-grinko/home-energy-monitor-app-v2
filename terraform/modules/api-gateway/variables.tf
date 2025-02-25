variable "name" {
  type        = string
  description = "Name of the API Gateway"
}

variable "environment" {
  type        = string
  description = "Environment name"
}

variable "tags" {
  type        = map(string)
  description = "Resource tags"
}

variable "integrations" {
  type = map(object({
    lambda_function_arn  = string
    lambda_function_name = string
    routes = list(object({
      method = string
      path   = string
      authorization_type = optional(string, "NONE")
    }))
  }))
  description = "Map of Lambda integrations and their routes"
}

variable "connection_lambda_arn" {
  description = "ARN of the WebSocket connection lambda"
  type        = string
} 