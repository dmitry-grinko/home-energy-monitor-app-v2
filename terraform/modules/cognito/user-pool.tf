resource "aws_cognito_user_pool" "main" {
  name = "user-pool"

  # Use email as the only way to sign in
  username_attributes = ["email"]
  
  # Password policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Email verification
  auto_verified_attributes = ["email"]
  
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject = "Verify your email"
    email_message = "Thanks for signing up! Your verification code is {####}"
  }

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }
} 