output "table_name" {
  value       = aws_dynamodb_table.connections_table.name
  description = "Name of the DynamoDB table"
}

output "table_arn" {
  value       = aws_dynamodb_table.connections_table.arn
  description = "ARN of the DynamoDB table"
}