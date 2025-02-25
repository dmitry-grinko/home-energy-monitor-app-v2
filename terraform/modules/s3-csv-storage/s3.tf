resource "aws_s3_bucket" "csv_storage" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Environment = var.environment
    Purpose     = "CSV Storage"
  }
}

# Enable versioning
resource "aws_s3_bucket_versioning" "csv_storage_versioning" {
  bucket = aws_s3_bucket.csv_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enable server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "csv_storage_encryption" {
  bucket = aws_s3_bucket.csv_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "csv_storage_public_access_block" {
  bucket = aws_s3_bucket.csv_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS configuration
resource "aws_s3_bucket_cors_configuration" "csv_storage_cors" {
  bucket = aws_s3_bucket.csv_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000 // 5 minutes
  }
}
