output "cloudfront_distribution_id" {
  value       = aws_cloudfront_distribution.website_cdn.id
  description = "The ID of the CloudFront distribution"
}

output "cloudfront_distribution_domain_name" {
  value       = aws_cloudfront_distribution.website_cdn.domain_name
  description = "The domain name of the CloudFront distribution"
}

output "cloudfront_distribution_arn" {
  value       = aws_cloudfront_distribution.website_cdn.arn
  description = "The ARN of the CloudFront distribution"
}

output "cloudfront_origin_access_identity_path" {
  value       = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
  description = "The path for the CloudFront Origin Access Identity"
} 

output "cloudfront_distribution_hosted_zone_id" {
  value       = aws_cloudfront_distribution.website_cdn.hosted_zone_id
  description = "The hosted zone ID of the CloudFront distribution"
}

output "cloudfront_oai_iam_arn" {
  value = aws_cloudfront_origin_access_identity.oai.iam_arn
}
