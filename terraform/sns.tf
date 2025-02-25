module "sns-email-topic" {
  source     = "./modules/sns-topic"
  topic_name = "${var.project-name}-email-topic-v2"
  tags       = local.tags
}

# sns-email-topic invokes the email lambda
resource "aws_lambda_permission" "sns-email" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_email.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = module.sns-email-topic.topic_arn
}

# the email lambda subscribes to the sns-email-topic
resource "aws_sns_topic_subscription" "email_lambda_subscription" {
  topic_arn = module.sns-email-topic.topic_arn
  protocol  = "lambda"
  endpoint  = module.lambda_email.function_arn
}

module "sns-websocket-topic" {
  source     = "./modules/sns-topic"
  topic_name = "${var.project-name}-websocket-topic-v2"
  tags       = local.tags
}

# sns-websocket-topic invokes the websocket lambda
resource "aws_lambda_permission" "sns-websocket" {
  statement_id  = "AllowSNSInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda_websocket.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = module.sns-websocket-topic.topic_arn
}

# the websocket lambda subscribes to the sns-websocket-topic
resource "aws_sns_topic_subscription" "websocket_lambda_subscription" {
  topic_arn = module.sns-websocket-topic.topic_arn
  protocol  = "lambda"
  endpoint  = module.lambda_websocket.function_arn
}