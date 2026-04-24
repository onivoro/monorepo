variable "PREFIX" {
  description = "Resource naming prefix"
  type        = string
}

variable "AWS_REGION" {
  description = "AWS region for endpoint service names"
  type        = string
}

variable "ECS_TASK_ROLE_NAME" {
  description = "Name of the ECS task execution role to attach Mantle policies to"
  type        = string
}

variable "AWS_VPC_ID" {
  description = "VPC ID for Bedrock Mantle PrivateLink endpoint"
  type        = string
}

variable "SUBNET_IDS" {
  description = "Subnet IDs for Bedrock Mantle PrivateLink endpoint placement"
  type        = list(string)
}

variable "VPC_CIDR_BLOCK" {
  description = "VPC CIDR block to allow inbound HTTPS to the Mantle VPC endpoint"
  type        = string
}

variable "BEDROCK_MODEL_IDS" {
  description = "List of Bedrock Mantle model identifiers to use"
  type        = list(string)
  default     = ["moonshotai.kimi-k2.5"]
}

variable "ENABLE_MANTLE_ADMIN" {
  description = "Whether to create Mantle admin policy for API key and project management"
  type        = bool
  default     = true
}

variable "ENABLE_LOGGING" {
  description = "Whether to configure Bedrock model invocation logging"
  type        = bool
  default     = true
}

variable "ENABLE_GUARDRAILS" {
  description = "Whether to create Bedrock content filtering guardrails"
  type        = bool
  default     = false
}

variable "LOG_RETENTION_DAYS" {
  description = "CloudWatch log group retention in days"
  type        = number
  default     = 30
}

variable "GUARDRAIL_BLOCKED_MESSAGE" {
  description = "Message returned when a guardrail blocks content"
  type        = string
  default     = "Request blocked by content filter."
}
