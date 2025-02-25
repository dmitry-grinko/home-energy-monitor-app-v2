resource "aws_cognito_user_pool_client" "client" {
  name         = "backend-client"
  user_pool_id = aws_cognito_user_pool.main.id

  # No client secret needed since we're using AWS SDK in Lambda
  generate_secret = false

  # Only enable the auth flows we need
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  # Token validity settings
  token_validity_units {
    access_token  = "hours"
    id_token     = "hours"
    refresh_token = "days"
  }

  access_token_validity = 1  # 1 hour
  id_token_validity = 1      # 1 hour
  refresh_token_validity = 30 # 30 days

  prevent_user_existence_errors = "ENABLED"
} 