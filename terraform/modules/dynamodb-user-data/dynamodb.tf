resource "aws_dynamodb_table" "user_data_table" {
  name           = var.table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "UserId"

  attribute {
    name = "UserId"
    type = "S"  # String type for user ID
  }

  # Adding TTL for data retention
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  tags = var.tags
}
