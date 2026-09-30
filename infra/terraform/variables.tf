variable "region" {
  description = "AWS region. Must match the Neon project region; Neon has no Mumbai region, so Singapore is the closest to Sri Lanka."
  type        = string
  default     = "ap-southeast-1"
}
variable "stage" {
  type    = string
  default = "prod"
}
variable "storefront_url" {
  description = "Public storefront URL (Cloudflare Pages custom domain), e.g. https://pavielle.lk"
  type        = string
}
variable "admin_url" {
  description = "Admin app URL (Cloudflare Pages), e.g. https://admin.pavielle.lk"
  type        = string
}
variable "payhere_merchant_id" {
  type = string
}
variable "payhere_sandbox" {
  type    = bool
  default = true
}
variable "cognito_domain_prefix" {
  description = "Prefix for the Cognito managed login domain (must be globally unique)"
  type        = string
}
variable "budget_email" {
  description = "Where to send AWS cost alerts"
  type        = string
}
variable "monthly_budget_usd" {
  type    = number
  default = 10
}
variable "api_dist_dir" {
  description = "Path to the built API bundles (services/api/dist)"
  type        = string
  default     = "../../services/api/dist"
}
