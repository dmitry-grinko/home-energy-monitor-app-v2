# Data source for current region
data "aws_region" "current" {}

# WebSocket API Gateway
resource "aws_apigatewayv2_api" "websocket" {
  name                       = "${var.project-name}-websocket-v2"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"

  tags = local.tags
}

# WebSocket stage
resource "aws_apigatewayv2_stage" "websocket" {
  api_id = aws_apigatewayv2_api.websocket.id
  name   = var.environment

  default_route_settings {
    throttling_burst_limit   = 100
    throttling_rate_limit    = 50
    detailed_metrics_enabled = true
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.websocket_access_logs.arn
    format = jsonencode({
      requestId    = "$context.requestId"
      ip           = "$context.identity.sourceIp"
      requestTime  = "$context.requestTime"
      httpMethod   = "$context.httpMethod"
      routeKey     = "$context.routeKey"
      status       = "$context.status"
      connectionId = "$context.connectionId"
      error        = "$context.error.message"
    })
  }

  tags = local.tags
}

# CloudWatch Log Group for WebSocket access logs
resource "aws_cloudwatch_log_group" "websocket_access_logs" {
  name              = "/aws/apigateway/${var.project-name}-websocket-v2"
  retention_in_days = 14
  tags              = local.tags
}

# WebSocket routes
resource "aws_apigatewayv2_route" "websocket_connect" {
  api_id             = aws_apigatewayv2_api.websocket.id
  route_key          = "$connect"
  target             = "integrations/${aws_apigatewayv2_integration.websocket_connect.id}"
  authorization_type = "AWS_IAM"
}

resource "aws_apigatewayv2_route" "websocket_disconnect" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$disconnect"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_disconnect.id}"
}

# Default route for unmatched messages
resource "aws_apigatewayv2_route" "websocket_default" {
  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.websocket_default.id}"
}

# WebSocket integrations
resource "aws_apigatewayv2_integration" "websocket_connect" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"

  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  integration_method        = "POST"
  integration_uri           = module.lambda_connection.function_arn
  passthrough_behavior      = "WHEN_NO_MATCH"

  credentials_arn = aws_iam_role.apigateway_websocket.arn
}

resource "aws_apigatewayv2_integration" "websocket_disconnect" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"

  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  integration_method        = "POST"
  integration_uri           = module.lambda_connection.function_arn
  passthrough_behavior      = "WHEN_NO_MATCH"

  credentials_arn = aws_iam_role.apigateway_websocket.arn
}

# Default integration
resource "aws_apigatewayv2_integration" "websocket_default" {
  api_id           = aws_apigatewayv2_api.websocket.id
  integration_type = "AWS_PROXY"

  connection_type           = "INTERNET"
  content_handling_strategy = "CONVERT_TO_TEXT"
  integration_method        = "POST"
  integration_uri           = module.lambda_websocket.function_arn
  passthrough_behavior      = "WHEN_NO_MATCH"

  credentials_arn = aws_iam_role.apigateway_websocket.arn
}

# IAM role for API Gateway WebSocket
resource "aws_iam_role" "apigateway_websocket" {
  name = "${var.project-name}-apigateway-websocket-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# IAM policy for API Gateway WebSocket
resource "aws_iam_role_policy" "apigateway_websocket" {
  name = "${var.project-name}-apigateway-websocket-policy"
  role = aws_iam_role.apigateway_websocket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          module.lambda_connection.function_arn,
          module.lambda_websocket.function_arn
        ]
      }
    ]
  })
}

# Lambda permissions for API Gateway
resource "aws_lambda_permission" "apigateway_websocket" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_connection.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/*"
}

# Outputs
output "websocket_api_endpoint" {
  description = "WebSocket API endpoint URL"
  value       = "${aws_apigatewayv2_api.websocket.api_endpoint}/${var.environment}"
}

output "websocket_api_id" {
  description = "WebSocket API ID"
  value       = aws_apigatewayv2_api.websocket.id
}

output "websocket_api_execution_arn" {
  description = "WebSocket API execution ARN"
  value       = aws_apigatewayv2_api.websocket.execution_arn
} 