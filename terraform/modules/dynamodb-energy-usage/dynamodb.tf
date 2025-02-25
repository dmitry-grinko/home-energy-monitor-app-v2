resource "aws_dynamodb_table" "energy_usage_table" {
  name           = var.table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "UserId"
  range_key      = "Date"

  attribute {
    name = "UserId"
    type = "S"  # String type for user ID
  }

  attribute {
    name = "Date"
    type = "S"  # String type for date in format YYYY-MM-DD
  }

  # Adding TTL for data retention
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  tags = var.tags
}
