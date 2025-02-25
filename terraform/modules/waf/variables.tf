variable "waf_name" {
  description = "The name of the WAF Web ACL"
  type        = string
}

variable "waf_description" {
  description = "The description of the WAF Web ACL"
  type        = string
  default     = "Managed by Terraform"
}

variable "ip_set_name" {
  description = "The name of the IP set"
  type        = string
}

variable "ip_set_description" {
  description = "The description of the IP set"
  type        = string
  default     = "IP set for blocking specific IPs"
}

variable "blocked_ips" {
  description = "List of IP addresses to block"
  type        = list(string)
} 