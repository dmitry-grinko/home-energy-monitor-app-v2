# IAM role for Lambda execution
data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "${var.function_name}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
  tags               = var.tags
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
} 



# Additional IAM policies
resource "aws_iam_role_policy" "additional_policies" {
  count  = length(var.additional_policies)
  name   = var.additional_policies[count.index].name
  role   = aws_iam_role.lambda_role.id
  policy = var.additional_policies[count.index].policy
}