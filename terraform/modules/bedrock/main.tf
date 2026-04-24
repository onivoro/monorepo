data "aws_caller_identity" "current" {}

locals {
  tags = {
    prefix = var.PREFIX
    module = "bedrock"
  }
}

# -----------------------------------------------------------------------------
# IAM: Mantle Inference Access
# -----------------------------------------------------------------------------

resource "aws_iam_role_policy_attachment" "mantle_inference" {
  role       = var.ECS_TASK_ROLE_NAME
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockMantleInferenceAccess"
}

# -----------------------------------------------------------------------------
# IAM: Mantle Admin (API key and project management)
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "mantle_admin" {
  count       = var.ENABLE_MANTLE_ADMIN ? 1 : 0
  name        = "${var.PREFIX}-mantle-admin"
  description = "Allows Mantle project and API key management"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "MantleAdmin"
        Effect = "Allow"
        Action = [
          "bedrock:CreateMantleProject",
          "bedrock:DeleteMantleProject",
          "bedrock:ListMantleProjects",
          "bedrock:GetMantleProject",
          "bedrock:CreateMantleApiKey",
          "bedrock:DeleteMantleApiKey",
          "bedrock:ListMantleApiKeys"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "mantle_admin" {
  count      = var.ENABLE_MANTLE_ADMIN ? 1 : 0
  role       = var.ECS_TASK_ROLE_NAME
  policy_arn = aws_iam_policy.mantle_admin[0].arn
}

# -----------------------------------------------------------------------------
# IAM: AWS Marketplace Subscription (for third-party models)
# -----------------------------------------------------------------------------

resource "aws_iam_policy" "marketplace_subscribe" {
  name        = "${var.PREFIX}-marketplace-subscribe"
  description = "Allows AWS Marketplace subscriptions for third-party Bedrock models"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "MarketplaceSubscribe"
        Effect = "Allow"
        Action = [
          "aws-marketplace:Subscribe",
          "aws-marketplace:Unsubscribe",
          "aws-marketplace:ViewSubscriptions"
        ]
        Resource = "*"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "ecs_marketplace" {
  role       = var.ECS_TASK_ROLE_NAME
  policy_arn = aws_iam_policy.marketplace_subscribe.arn
}

# -----------------------------------------------------------------------------
# Mantle API Key: IAM User + Service-Specific Credential + Secrets Manager
# -----------------------------------------------------------------------------

resource "aws_iam_user" "mantle_api_key_user" {
  name = "${var.PREFIX}-mantle-api-key-user"
  tags = local.tags
}

resource "aws_iam_user_policy_attachment" "mantle_api_key_user_inference" {
  user       = aws_iam_user.mantle_api_key_user.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonBedrockMantleInferenceAccess"
}

resource "aws_iam_user_policy_attachment" "mantle_api_key_user_marketplace" {
  user       = aws_iam_user.mantle_api_key_user.name
  policy_arn = aws_iam_policy.marketplace_subscribe.arn
}

resource "aws_iam_service_specific_credential" "mantle_api_key" {
  service_name = "bedrock.amazonaws.com"
  user_name    = aws_iam_user.mantle_api_key_user.name
}

resource "aws_secretsmanager_secret" "mantle_api_key" {
  name        = "${var.PREFIX}/mantle-api-key"
  description = "Bedrock Mantle OpenAI-compatible API key for ${var.PREFIX}"
  tags        = local.tags
}

resource "aws_secretsmanager_secret_version" "mantle_api_key" {
  secret_id = aws_secretsmanager_secret.mantle_api_key.id
  secret_string = jsonencode({
    api_key  = aws_iam_service_specific_credential.mantle_api_key.service_password
    user_name = aws_iam_service_specific_credential.mantle_api_key.service_user_name
    endpoint = "https://bedrock-mantle.${var.AWS_REGION}.api.aws/v1"
  })
}

# -----------------------------------------------------------------------------
# VPC Endpoint: Bedrock Mantle (PrivateLink)
# -----------------------------------------------------------------------------

resource "aws_security_group" "bedrock_mantle_vpce" {
  name        = "${var.PREFIX}-bedrock-mantle-vpce-sg"
  description = "Allows HTTPS inbound to Bedrock Mantle VPC endpoint from within the VPC"
  vpc_id      = var.AWS_VPC_ID

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.VPC_CIDR_BLOCK]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_vpc_endpoint" "bedrock_mantle" {
  vpc_id              = var.AWS_VPC_ID
  service_name        = "com.amazonaws.${var.AWS_REGION}.bedrock-mantle"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.SUBNET_IDS
  security_group_ids  = [aws_security_group.bedrock_mantle_vpce.id]
  private_dns_enabled = true

  tags = merge(local.tags, { Name = "${var.PREFIX}-bedrock-mantle-vpce" })
}

# -----------------------------------------------------------------------------
# Logging: CloudWatch + Bedrock Invocation Logging
# -----------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "bedrock_logs" {
  count             = var.ENABLE_LOGGING ? 1 : 0
  name              = "${var.PREFIX}-bedrock-invocations"
  retention_in_days = var.LOG_RETENTION_DAYS

  tags = local.tags
}

resource "aws_iam_role" "bedrock_logging_role" {
  count = var.ENABLE_LOGGING ? 1 : 0
  name  = "${var.PREFIX}-bedrock-logging-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_policy" "bedrock_logging_write" {
  count       = var.ENABLE_LOGGING ? 1 : 0
  name        = "${var.PREFIX}-bedrock-logging-write"
  description = "Allows Bedrock to write model invocation logs to CloudWatch"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.bedrock_logs[0].arn}:*"
      }
    ]
  })

  tags = local.tags
}

resource "aws_iam_role_policy_attachment" "bedrock_logging_attach" {
  count      = var.ENABLE_LOGGING ? 1 : 0
  role       = aws_iam_role.bedrock_logging_role[0].name
  policy_arn = aws_iam_policy.bedrock_logging_write[0].arn
}

resource "aws_bedrock_model_invocation_logging_configuration" "logging" {
  count = var.ENABLE_LOGGING ? 1 : 0

  logging_config {
    embedding_data_delivery_enabled = false
    image_data_delivery_enabled     = false
    text_data_delivery_enabled      = true

    cloudwatch_config {
      log_group_name = aws_cloudwatch_log_group.bedrock_logs[0].name
      role_arn       = aws_iam_role.bedrock_logging_role[0].arn
    }
  }
}

# -----------------------------------------------------------------------------
# Optional: Guardrails
# -----------------------------------------------------------------------------

resource "aws_bedrock_guardrail" "content_filter" {
  count                     = var.ENABLE_GUARDRAILS ? 1 : 0
  name                      = "${var.PREFIX}-guardrail"
  blocked_input_messaging   = var.GUARDRAIL_BLOCKED_MESSAGE
  blocked_outputs_messaging = var.GUARDRAIL_BLOCKED_MESSAGE
  description               = "Content filtering guardrail for ${var.PREFIX}"

  content_policy_config {
    filters_config {
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
      type            = "HATE"
    }
    filters_config {
      input_strength  = "MEDIUM"
      output_strength = "MEDIUM"
      type            = "INSULTS"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "SEXUAL"
    }
    filters_config {
      input_strength  = "HIGH"
      output_strength = "HIGH"
      type            = "VIOLENCE"
    }
    filters_config {
      input_strength  = "NONE"
      output_strength = "NONE"
      type            = "MISCONDUCT"
    }
  }

  tags = local.tags
}
