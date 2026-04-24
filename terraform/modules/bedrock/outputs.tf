output "mantle_admin_policy_arn" {
  description = "ARN of the Mantle admin IAM policy"
  value       = var.ENABLE_MANTLE_ADMIN ? aws_iam_policy.mantle_admin[0].arn : null
}

output "marketplace_policy_arn" {
  description = "ARN of the Marketplace subscription IAM policy"
  value       = aws_iam_policy.marketplace_subscribe.arn
}

output "mantle_api_key_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the Mantle API key"
  value       = aws_secretsmanager_secret.mantle_api_key.arn
}

output "mantle_api_key_secret_name" {
  description = "Name of the Secrets Manager secret containing the Mantle API key"
  value       = aws_secretsmanager_secret.mantle_api_key.name
}

output "vpc_endpoint_bedrock_mantle_id" {
  description = "ID of the Bedrock Mantle PrivateLink VPC endpoint"
  value       = aws_vpc_endpoint.bedrock_mantle.id
}

output "bedrock_logging_role_arn" {
  description = "ARN of the Bedrock logging service role"
  value       = var.ENABLE_LOGGING ? aws_iam_role.bedrock_logging_role[0].arn : null
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for Bedrock invocation logs"
  value       = var.ENABLE_LOGGING ? aws_cloudwatch_log_group.bedrock_logs[0].name : null
}

output "guardrail_id" {
  description = "ID of the Bedrock guardrail"
  value       = var.ENABLE_GUARDRAILS ? aws_bedrock_guardrail.content_filter[0].guardrail_id : null
}

output "guardrail_version" {
  description = "Version of the Bedrock guardrail"
  value       = var.ENABLE_GUARDRAILS ? aws_bedrock_guardrail.content_filter[0].version : null
}
