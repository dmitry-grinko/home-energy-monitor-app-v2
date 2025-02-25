output "cloudfront_distribution_domain_name" {
  value       = module.cloudfront.cloudfront_distribution_domain_name
  description = "S3 static website endpoint URL"
}

output "website_bucket_name" {
  value       = module.s3_frontend.website_bucket_name
  description = "Name of the created S3 bucket"
} 