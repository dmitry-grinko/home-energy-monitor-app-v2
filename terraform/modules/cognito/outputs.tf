output "user_pool_id" {
  value       = aws_cognito_user_pool.main.id
  description = "The ID of the Cognito User Pool"
}

output "client_id" {
  value       = aws_cognito_user_pool_client.client.id
  description = "The ID of the Cognito User Pool Client"
}

output "user_pool_arn" {
  value = aws_cognito_user_pool.main.arn
} 