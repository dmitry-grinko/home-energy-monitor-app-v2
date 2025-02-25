resource "aws_dynamodb_table" "connections_table" {
  name           = var.table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "UserId"
  range_key      = "ConnectionId"

  attribute {
    name = "UserId"
    type = "S"  # String type for user ID
  }

  attribute {
    name = "ConnectionId"
    type = "S"
  }

  # Adding TTL for data retention
  ttl {
    attribute_name = "TTL"
    enabled        = true
  }

  tags = var.tags
}
