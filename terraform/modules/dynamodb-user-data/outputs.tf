output "table_name" {
  value       = aws_dynamodb_table.user_data_table.name
  description = "Name of the DynamoDB table"
}

output "table_arn" {
  value       = aws_dynamodb_table.user_data_table.arn
  description = "ARN of the DynamoDB table"
}