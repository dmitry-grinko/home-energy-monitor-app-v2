resource "aws_apigatewayv2_api" "main" {
  name          = var.name
  protocol_type = "HTTP"
  cors_configuration {
    allow_origins = ["https://pge.dmitrygrinko.com", "http://localhost:4200", "https://lnaa2ljxrj.execute-api.us-east-1.amazonaws.com"]
    allow_methods = ["POST", "GET", "OPTIONS"]
    allow_headers = [
      "Content-Type",
      "Authorization",
      "X-Id-Token",
      "Cookie"
    ]
    expose_headers = ["Set-Cookie"]
    allow_credentials = true
    max_age = 300
  }
  tags = var.tags
}

resource "aws_apigatewayv2_stage" "main" {
  api_id = aws_apigatewayv2_api.main.id
  name   = var.environment
  auto_deploy = true
  
  default_route_settings {
    throttling_burst_limit = 5000
    throttling_rate_limit  = 10000
    detailed_metrics_enabled = true
  }
  
  tags = var.tags
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each = var.integrations
  
  api_id = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_method = "POST"
  integration_uri    = each.value.lambda_function_arn
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = {
    for idx, route in flatten([
      for integration_key, integration in var.integrations : [
        for route in integration.routes : {
          integration_key = integration_key
          method         = route.method
          path          = route.path
          authorization_type = route.authorization_type
        }
      ]
    ]) : "${route.method} ${route.path}" => route
  }

  api_id = aws_apigatewayv2_api.main.id
  route_key = "${each.value.method} ${each.value.path}"
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.value.integration_key].id}"
  authorization_type = each.value.authorization_type
}

resource "aws_lambda_permission" "api_gw" {
  for_each = var.integrations
  
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = each.value.lambda_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}