# Secrets are created here with placeholder values; set real values once with the AWS CLI so they
# never appear in Terraform state or code:
#   aws ssm put-parameter --overwrite --type SecureString --name /pavielle/prod/database-url --value '<neon pooled url>'
# Standard-tier parameters are free.
locals {
  ssm_prefix = "/pavielle/${var.stage}"
  secrets = {
    database_url            = "database-url"            # Neon *pooled* connection string (host contains -pooler)
    database_direct_url     = "database-direct-url"     # Neon direct connection string (migrations)
    payhere_merchant_secret = "payhere-merchant-secret"
  }
}

resource "aws_ssm_parameter" "secret" {
  for_each = local.secrets
  name     = "${local.ssm_prefix}/${each.value}"
  type     = "SecureString"
  value    = "CHANGE_ME"
  lifecycle { ignore_changes = [value] }
}

resource "aws_ssm_parameter" "storefront_deploy_hook" {
  name  = "${local.ssm_prefix}/storefront-deploy-hook-url"
  type  = "SecureString"
  value = "CHANGE_ME"
  lifecycle { ignore_changes = [value] }
}
