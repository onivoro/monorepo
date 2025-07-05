#!/bin/bash

echo "Removing .npmignore files from libs directory..."

# Array of files to remove
files=(
  "libs/isomorphic/axios/.npmignore"
  "libs/isomorphic/common/.npmignore"
  "libs/server/aws-cloudwatch/.npmignore"
  "libs/server/aws-cognito/.npmignore"
  "libs/server/aws-credential-providers/.npmignore"
  "libs/server/aws-ecs/.npmignore"
  "libs/server/aws-iam/.npmignore"
  "libs/server/aws-kinesis/.npmignore"
  "libs/server/aws-redshift/.npmignore"
  "libs/server/aws-s3/.npmignore"
  "libs/server/aws-sns/.npmignore"
  "libs/server/aws-sqs/.npmignore"
  "libs/server/aws-sts/.npmignore"
  "libs/server/cli/.npmignore"
  "libs/server/common/.npmignore"
  "libs/server/mcp/.npmignore"
  "libs/server/open-ai/.npmignore"
  "libs/server/pino/.npmignore"
  "libs/server/process/.npmignore"
  "libs/server/resilience/.npmignore"
  "libs/server/sendgrid/.npmignore"
  "libs/server/twilio/.npmignore"
  "libs/server/typeorm-mysql/.npmignore"
  "libs/server/typeorm-postgres/.npmignore"
)

# Change to the correct directory
cd /Users/leenorris/github.com/onivoro/monorepo

removed=0
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    rm "$file"
    echo "✓ Removed: $file"
    ((removed++))
  else
    echo "- Not found: $file"
  fi
done

echo "Removed $removed out of ${#files[@]} .npmignore files."

# Verify no .npmignore files remain
remaining=$(find libs -name ".npmignore" | wc -l)
echo "Remaining .npmignore files in libs directory: $remaining"