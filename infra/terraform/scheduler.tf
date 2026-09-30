# Safety net that releases expired stock holds. Hourly, not every few minutes: Neon suspends after
# 5 idle minutes, and a frequent job would keep the database awake (and billed) around the clock.
# Checkout also releases expired holds before reserving, so stock is never stuck for long.
resource "aws_iam_role" "scheduler" {
  name = "pavielle-${var.stage}-scheduler"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "scheduler.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke" {
  role = aws_iam_role.scheduler.id
  policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Action = "lambda:InvokeFunction", Resource = aws_lambda_function.fn["expire-holds"].arn }]
  })
}

resource "aws_scheduler_schedule" "expire_holds" {
  name                = "pavielle-${var.stage}-expire-holds"
  schedule_expression = "rate(1 hour)"
  flexible_time_window { mode = "OFF" }
  target {
    arn      = aws_lambda_function.fn["expire-holds"].arn
    role_arn = aws_iam_role.scheduler.arn
    retry_policy { maximum_retry_attempts = 0 }
  }
}
