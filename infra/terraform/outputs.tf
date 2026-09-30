output "api_url" {
  value = aws_apigatewayv2_api.http.api_endpoint
}
output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.staff.id
}
output "cognito_client_id" {
  value = aws_cognito_user_pool_client.admin.id
}
output "cognito_authority" {
  value = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.staff.id}"
}
output "cognito_domain" {
  value = "https://${aws_cognito_user_pool_domain.staff.domain}.auth.${var.region}.amazoncognito.com"
}
output "migrate_function" {
  value = aws_lambda_function.fn["migrate"].function_name
}
