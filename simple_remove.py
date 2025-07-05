import os

files = [
    "/Users/leenorris/github.com/onivoro/monorepo/libs/isomorphic/common/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-cloudwatch/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-cognito/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-credential-providers/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-ecs/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-iam/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-kinesis/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-redshift/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-s3/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-sns/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-sqs/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/aws-sts/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/cli/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/common/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/mcp/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/open-ai/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/pino/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/process/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/resilience/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/sendgrid/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/twilio/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/typeorm-mysql/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/server/typeorm-postgres/.npmignore",
    "/Users/leenorris/github.com/onivoro/monorepo/libs/isomorphic/axios/.npmignore"
]

for file in files:
    if os.path.exists(file):
        os.remove(file)
        print(f"Removed: {file}")
    else:
        print(f"File not found: {file}")