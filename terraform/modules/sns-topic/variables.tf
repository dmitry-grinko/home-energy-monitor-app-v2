variable "topic_name" {
  description = "Name of the SNS topic"
  type        = string
}

variable "tags" {
  description = "Tags to be applied to the SNS topic"
  type        = map(string)
  default     = {}
} 