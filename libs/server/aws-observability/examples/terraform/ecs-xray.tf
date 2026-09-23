# Baseline ECS wiring for @onivoro/server-aws-observability.
# Adapt names, regions, log groups, and task definition shape to the consuming service.

locals {
  xray_daemon_container = {
    name      = "xray-daemon"
    # Pin a specific tag, e.g. public.ecr.aws/xray/aws-xray-daemon:<version>.
    image     = var.xray_daemon_image
    essential = false
    portMappings = [
      {
        containerPort = 2000
        hostPort      = 2000
        protocol      = "udp"
      }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = var.xray_daemon_log_group_name
        awslogs-region        = var.aws_region
        awslogs-stream-prefix = "xray"
      }
    }
  }

  app_observability_environment = [
    { name = "AWS_XRAY_CONTEXT_MISSING", value = "LOG_ERROR" },
    { name = "AWS_XRAY_DAEMON_ADDRESS", value = "127.0.0.1:2000" },
    # ECS otherwise sends EMF metrics to a CloudWatch agent; Local writes them to stdout.
    { name = "AWS_EMF_ENVIRONMENT", value = "Local" }
  ]
}

resource "aws_iam_role_policy" "xray_write" {
  name = "${var.service_name}-xray-write"
  role = var.task_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords",
          "xray:GetSamplingRules",
          "xray:GetSamplingTargets",
          "xray:GetSamplingStatisticSummaries"
        ]
        Resource = "*"
      }
    ]
  })
}

# CloudWatch Logs permissions for stdout/EMF usually come from the ECS execution
# role's AmazonECSTaskExecutionRolePolicy. Add explicit logs permissions only if
# your service does not already attach that managed policy.
