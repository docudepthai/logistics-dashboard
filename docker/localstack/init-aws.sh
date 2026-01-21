#!/bin/bash
set -e

echo "Initializing LocalStack resources..."

# Create S3 bucket for raw messages
awslocal s3 mb s3://logistics-raw-messages
echo "Created S3 bucket: logistics-raw-messages"

# Create Dead Letter Queue first
awslocal sqs create-queue --queue-name logistics-message-dlq
echo "Created DLQ: logistics-message-dlq"

# Get DLQ ARN
DLQ_ARN=$(awslocal sqs get-queue-attributes \
  --queue-url http://localhost:4566/000000000000/logistics-message-dlq \
  --attribute-names QueueArn \
  --query 'Attributes.QueueArn' \
  --output text)

# Create main processing queue with DLQ
awslocal sqs create-queue \
  --queue-name logistics-message-queue \
  --attributes '{
    "VisibilityTimeout": "180",
    "RedrivePolicy": "{\"deadLetterTargetArn\":\"'$DLQ_ARN'\",\"maxReceiveCount\":\"3\"}"
  }'
echo "Created SQS queue: logistics-message-queue"

# Create Secrets Manager secret for database credentials
awslocal secretsmanager create-secret \
  --name logistics/database/credentials \
  --secret-string '{"username":"logistics_user","password":"logistics_dev","host":"localhost","port":5432,"dbname":"logistics"}'
echo "Created secret: logistics/database/credentials"

echo "LocalStack initialization complete!"
