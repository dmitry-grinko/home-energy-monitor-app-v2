module "dynamodb_energy_usage" {
  source = "./modules/dynamodb-energy-usage"

  table_name = "energy-usage-table-${var.environment}-v2"
  tags       = local.tags
}

module "dynamodb_user_data" {
  source = "./modules/dynamodb-user-data"

  table_name = "user-data-table-${var.environment}-v2"
  tags       = local.tags
}

module "dynamodb_connections" {
  source = "./modules/dynamodb-connections"

  table_name = "connections-table-${var.environment}-v2"
  tags       = local.tags
}