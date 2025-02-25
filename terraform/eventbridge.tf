# Schedule for ML pipeline
resource "aws_cloudwatch_event_rule" "ml_pipeline_schedule" {
  name                = "${var.project-name}-ml-pipeline-schedule"
  description         = "Trigger ML pipeline every 3 days"
  schedule_expression = "rate(3 days)"

  tags = local.tags
}

resource "aws_cloudwatch_event_target" "ml_pipeline_target" {
  rule      = aws_cloudwatch_event_rule.ml_pipeline_schedule.name
  target_id = "MLPipelineExecution"
  arn       = module.step_functions.state_machine_arn
  role_arn  = aws_iam_role.eventbridge_sfn_role.arn
}

# IAM role for EventBridge to invoke Step Functions
resource "aws_iam_role" "eventbridge_sfn_role" {
  name = "${var.project-name}-eventbridge-sfn-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
      }
    ]
  })

  tags = local.tags
}

# IAM policy for EventBridge to invoke Step Functions
resource "aws_iam_role_policy" "eventbridge_sfn_policy" {
  name = "${var.project-name}-eventbridge-sfn-policy"
  role = aws_iam_role.eventbridge_sfn_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "states:StartExecution"
        ]
        Resource = [
          module.step_functions.state_machine_arn
        ]
      }
    ]
  })
} 