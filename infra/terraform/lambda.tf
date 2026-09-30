locals {
  common_env = {
    STAGE                         = var.stage
    DATABASE_URL_PARAM            = aws_ssm_parameter.secret["database_url"].name
    PAYHERE_MERCHANT_SECRET_PARAM = aws_ssm_parameter.secret["payhere_merchant_secret"].name
    PAYHERE_MERCHANT_ID           = var.payhere_merchant_id
    PAYHERE_SANDBOX               = var.payhere_sandbox ? "1" : "0"
    DEFAULT_LOCATION_CODE         = "HOME"
    NODE_OPTIONS                  = "--enable-source-maps"
  }
  functions = {
    api = {
      handler = "index.api", timeout = 15, memory = 512
      env = tomap({
        ALLOWED_ORIGINS      = "${var.storefront_url},${var.admin_url}"
        STOREFRONT_URL       = var.storefront_url
        COGNITO_USER_POOL_ID = aws_cognito_user_pool.staff.id
        COGNITO_CLIENT_ID    = aws_cognito_user_pool_client.admin.id
        # The HTTP API resource does not depend on the Lambda (only its integration does), so no cycle.
        PUBLIC_API_URL                   = aws_apigatewayv2_api.http.api_endpoint
        STOREFRONT_DEPLOY_HOOK_URL_PARAM = aws_ssm_parameter.storefront_deploy_hook.name
      })
    }
    expire-holds = { handler = "index.handler", timeout = 60, memory = 256, env = tomap({}) }
    migrate = {
      handler = "index.handler", timeout = 120, memory = 256
      env     = tomap({ DATABASE_DIRECT_URL_PARAM = aws_ssm_parameter.secret["database_direct_url"].name })
    }
  }
}

data "archive_file" "fn" {
  for_each    = local.functions
  type        = "zip"
  source_dir  = "${var.api_dist_dir}/${each.key}"
  output_path = "${path.module}/.build/${each.key}.zip"
}

resource "aws_iam_role" "lambda" {
  name = "pavielle-${var.stage}-lambda"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "lambda.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy_attachment" "logs" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_caller_identity" "me" {}

resource "aws_iam_role_policy" "ssm" {
  role = aws_iam_role.lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["ssm:GetParameters", "ssm:GetParameter"]
      Resource = "arn:aws:ssm:${var.region}:${data.aws_caller_identity.me.account_id}:parameter${local.ssm_prefix}/*"
    }]
  })
}

resource "aws_cloudwatch_log_group" "fn" {
  for_each          = local.functions
  name              = "/aws/lambda/pavielle-${var.stage}-${each.key}"
  retention_in_days = 14
}

resource "aws_lambda_function" "fn" {
  for_each         = local.functions
  function_name    = "pavielle-${var.stage}-${each.key}"
  role             = aws_iam_role.lambda.arn
  runtime          = "nodejs22.x"
  architectures    = ["arm64"] # ~20% cheaper than x86
  handler          = each.value.handler
  filename         = data.archive_file.fn[each.key].output_path
  source_code_hash = data.archive_file.fn[each.key].output_base64sha256
  timeout          = each.value.timeout
  memory_size      = each.value.memory
  environment { variables = merge(local.common_env, each.value.env) }
  depends_on       = [aws_cloudwatch_log_group.fn]
}
