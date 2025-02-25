resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}

# S3 bucket for static website hosting
resource "aws_s3_bucket" "this" {
  bucket = "${var.bucket_name}"
  
  force_destroy = true

  tags = {
    Name        = "${var.bucket_name}"
    Environment = var.environment
  }
}

# Enable versioning
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Configure public access block - make it private
resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable website hosting
resource "aws_s3_bucket_website_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

# Single bucket policy to allow CloudFront OAI access
resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontOAI"
        Effect    = "Allow"
        Principal = {
          AWS = var.cloudfront_oai_iam_arn
        }
        Action   = ["s3:GetObject", "s3:ListBucket"]
        Resource = [
          aws_s3_bucket.this.arn,
          "${aws_s3_bucket.this.arn}/*"
        ]
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.this]
}

