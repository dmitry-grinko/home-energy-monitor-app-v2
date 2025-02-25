output "website_bucket_name" {
  value       = aws_s3_bucket.this.id
  description = "Name of the S3 bucket"
}

output "website_endpoint" {
  value       = aws_s3_bucket_website_configuration.this.website_endpoint
  description = "S3 static website hosting endpoint"
}

output "bucket_arn" {
  value       = aws_s3_bucket.this.arn
  description = "ARN of the S3 bucket"
} 

output "bucket_regional_domain_name" {
  value       = aws_s3_bucket.this.bucket_regional_domain_name
  description = "Regional domain name of the S3 bucket"
}
