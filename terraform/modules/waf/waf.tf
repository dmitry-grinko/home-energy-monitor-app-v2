resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_wafv2_ip_set" "blocked_ips" {
  name        = "${var.ip_set_name}-${random_string.suffix.result}"
  scope       = "CLOUDFRONT"
  description = var.ip_set_description

  ip_address_version = "IPV4"
  addresses          = var.blocked_ips
}

resource "aws_wafv2_web_acl" "this" {
  name        = "${var.waf_name}-${random_string.suffix.result}"
  scope       = "CLOUDFRONT"
  description = var.waf_description

  default_action {
    allow {}
  }

  rule {
    name     = "BlockSpecificIPs"
    priority = 1

    action {
      block {}
    }

    statement {
      ip_set_reference_statement {
        arn = aws_wafv2_ip_set.blocked_ips.arn
      }
    }

    visibility_config {
      sampled_requests_enabled = true
      cloudwatch_metrics_enabled = true
      metric_name = "BlockSpecificIPs"
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = var.waf_name
    sampled_requests_enabled   = true
  }
}
