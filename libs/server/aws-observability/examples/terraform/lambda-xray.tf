# Baseline Lambda wiring for @onivoro/server-aws-observability.
# Adapt names and role references to the consuming function.

resource "aws_lambda_function" "example" {
  function_name = var.function_name
  role          = var.lambda_role_arn

  tracing_config {
    mode = "Active"
  }

  environment {
    variables = {
      AWS_XRAY_CONTEXT_MISSING = "LOG_ERROR"
    }
  }
}

resource "aws_iam_role_policy" "lambda_xray_write" {
  name = "${var.function_name}-xray-write"
  role = var.lambda_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "xray:PutTraceSegments",
          "xray:PutTelemetryRecords"
        ]
        Resource = "*"
      }
    ]
  })
}

# Lambda basic execution role permissions provide CloudWatch log writes. EMF
# custom metrics are extracted from those logs by CloudWatch.
