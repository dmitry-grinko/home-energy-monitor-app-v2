# SES Domain Identity
resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

# Domain verification record
resource "aws_route53_record" "ses_verification" {
  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = "600"
  records = [aws_ses_domain_identity.main.verification_token]
}

# DKIM records
resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_route53_record" "dkim" {
  count   = 3
  zone_id = var.route53_zone_id
  name    = "${element(aws_ses_domain_dkim.main.dkim_tokens, count.index)}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = "600"
  records = ["${element(aws_ses_domain_dkim.main.dkim_tokens, count.index)}.dkim.amazonses.com"]
}

# IAM policy for sending emails
resource "aws_iam_policy" "ses_send_email" {
  name        = "ses-send-email-policy"
  description = "Policy for sending emails via SES"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ses:SendEmail",
          "ses:SendRawEmail"
        ]
        Resource = aws_ses_domain_identity.main.arn
      }
    ]
  })
}

# Variables
variable "domain_name" {
  type        = string
  description = "Domain name for SES configuration"
}

variable "route53_zone_id" {
  type        = string
  description = "Route53 hosted zone ID for domain verification records"
}

# Outputs
output "ses_domain_identity_arn" {
  value       = aws_ses_domain_identity.main.arn
  description = "ARN of the SES domain identity"
}

output "ses_send_email_policy_arn" {
  value       = aws_iam_policy.ses_send_email.arn
  description = "ARN of the IAM policy for sending emails"
}
