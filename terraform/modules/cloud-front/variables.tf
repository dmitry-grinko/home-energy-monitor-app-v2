variable "website_domain" {
  type        = string
  description = "Domain name for the website"
}

variable "bucket_regional_domain_name" {
  type        = string
  description = "The regional domain name of the S3 bucket"
}

variable "acm_certificate_arn" {
  type        = string
  description = "ARN of ACM certificate for the domain"
}

variable "tags" {
  type        = map(string)
  description = "Tags to be applied to the CloudFront distribution"
  default     = {}
}

variable "waf_arn" {
  description = "ARN of the WAF Web ACL to associate with the CloudFront distribution"
  type        = string
} 