resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_cloudfront_origin_access_identity" "oai" {
  comment = "OAI for ${var.website_domain}-${random_string.suffix.result}"
}

resource "aws_cloudfront_distribution" "website_cdn" {
  enabled             = true
  is_ipv6_enabled    = true
  default_root_object = "index.html"
  aliases            = [var.website_domain]

  origin {
    domain_name = var.bucket_regional_domain_name
    origin_id   = "S3-${var.website_domain}-${random_string.suffix.result}"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${var.website_domain}-${random_string.suffix.result}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  price_class = "PriceClass_100"

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  tags = var.tags

  web_acl_id = var.waf_arn
}
