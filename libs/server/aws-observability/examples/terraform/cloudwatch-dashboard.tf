# Optional dashboard widgets for EMF metrics emitted by MetricsService and the
# HTTP metrics interceptor. Keep dimension names aligned with module config.

resource "aws_cloudwatch_dashboard" "service_observability" {
  dashboard_name = "${var.service_name}-observability"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "HTTP Requests"
          region = var.aws_region
          metrics = [
            [var.metrics_namespace, "HttpRequestCount", "Service", var.service_name]
          ]
          stat   = "Sum"
          period = 60
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title  = "HTTP Duration"
          region = var.aws_region
          metrics = [
            [var.metrics_namespace, "HttpRequestDurationMs", "Service", var.service_name]
          ]
          stat   = "p95"
          period = 60
        }
      }
    ]
  })
}
