import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface LogisticsStackProps extends cdk.StackProps {
  databaseSecretArn?: string;
}

export class LogisticsStack extends cdk.Stack {
  public readonly webhookUrl: cdk.CfnOutput;
  public readonly queryWebhookUrl: cdk.CfnOutput;
  public readonly rawMessagesBucket: s3.Bucket;
  public readonly messageQueue: sqs.Queue;
  public readonly conversationsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: LogisticsStackProps) {
    super(scope, id, props);

    // S3 bucket for raw messages
    this.rawMessagesBucket = new s3.Bucket(this, 'RawMessagesBucket', {
      bucketName: `turkish-logistics-raw-messages-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      lifecycleRules: [
        {
          id: 'ArchiveOldMessages',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: cdk.Duration.days(30),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Dead letter queue for failed messages
    const dlq = new sqs.Queue(this, 'MessageDLQ', {
      queueName: 'turkish-logistics-messages-dlq.fifo',
      fifo: true,
      retentionPeriod: cdk.Duration.days(14),
    });

    // SQS FIFO queue for message processing
    this.messageQueue = new sqs.Queue(this, 'MessageQueue', {
      queueName: 'turkish-logistics-messages.fifo',
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Database connection secret
    const databaseSecret = props?.databaseSecretArn
      ? secretsmanager.Secret.fromSecretCompleteArn(
          this,
          'DatabaseSecret',
          props.databaseSecretArn
        )
      : new secretsmanager.Secret(this, 'DatabaseSecret', {
          secretName: 'turkish-logistics/database',
          description: 'Database connection string for Turkish Logistics Bot',
          generateSecretString: {
            secretStringTemplate: JSON.stringify({
              host: 'localhost',
              port: 5432,
              database: 'logistics',
              username: 'logistics',
            }),
            generateStringKey: 'password',
            excludePunctuation: true,
          },
        });

    // Evolution webhook API key secret
    const webhookApiKeySecret = new secretsmanager.Secret(
      this,
      'WebhookApiKeySecret',
      {
        secretName: 'turkish-logistics/webhook-api-key',
        description: 'API key for Evolution API webhook authentication',
        generateSecretString: {
          excludePunctuation: true,
          passwordLength: 32,
        },
      }
    );

    // Lambda source path
    const lambdaSrcPath = path.join(__dirname, '../../lambda/src/handlers');

    // Webhook Lambda function with automatic bundling
    const webhookLambda = new NodejsFunction(this, 'WebhookHandler', {
      functionName: 'turkish-logistics-webhook',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(lambdaSrcPath, 'webhook.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        MESSAGE_QUEUE_URL: this.messageQueue.queueUrl,
        RAW_MESSAGES_BUCKET: this.rawMessagesBucket.bucketName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant webhook lambda permissions
    this.rawMessagesBucket.grantWrite(webhookLambda);
    this.messageQueue.grantSendMessages(webhookLambda);
    webhookApiKeySecret.grantRead(webhookLambda);

    // Processor Lambda function with automatic bundling
    const processorLambda = new NodejsFunction(this, 'ProcessorHandler', {
      functionName: 'turkish-logistics-processor',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(lambdaSrcPath, 'processor.ts'),
      timeout: cdk.Duration.seconds(60),
      memorySize: 512,
      environment: {
        NODE_OPTIONS: '--enable-source-maps',
      },
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant processor lambda permissions
    databaseSecret.grantRead(processorLambda);
    this.messageQueue.grantConsumeMessages(processorLambda);

    // Add SQS trigger to processor (no batching window for FIFO queues)
    processorLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(this.messageQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      })
    );

    // ==========================================
    // Phase 2: Query Agent Infrastructure
    // ==========================================

    // DynamoDB table for conversation history
    this.conversationsTable = new dynamodb.Table(this, 'ConversationsTable', {
      tableName: 'turkish-logistics-conversations',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Conversations are ephemeral
    });

    // OpenAI API key secret
    const openaiApiKeySecret = new secretsmanager.Secret(
      this,
      'OpenAIApiKeySecret',
      {
        secretName: 'turkish-logistics/openai-api-key',
        description: 'OpenAI API key for GPT agent',
      }
    );

    // WhatsApp Business API secrets
    const whatsappSecret = new secretsmanager.Secret(
      this,
      'WhatsAppSecret',
      {
        secretName: 'turkish-logistics/whatsapp',
        description: 'WhatsApp Business API credentials',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({
            phoneNumberId: 'YOUR_PHONE_NUMBER_ID',
            verifyToken: 'turkish-logistics-verify',
            appSecret: 'YOUR_APP_SECRET', // Required for webhook signature validation
          }),
          generateStringKey: 'accessToken',
        },
      }
    );

    // Query Lambda function (handles user queries via WhatsApp)
    const queryLambda = new NodejsFunction(this, 'QueryHandler', {
      functionName: 'turkish-logistics-query',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(lambdaSrcPath, 'query.ts'),
      timeout: cdk.Duration.seconds(60), // Allow time for GPT processing
      memorySize: 512,
      environment: {
        CONVERSATIONS_TABLE: this.conversationsTable.tableName,
        NODE_OPTIONS: '--enable-source-maps',
        NODE_TLS_REJECT_UNAUTHORIZED: '0', // For RDS SSL
        // Note: DATABASE_URL, OPENAI_API_KEY, WHATSAPP_* set manually or via secrets
        // WELCOME_VIDEO_MEDIA_ID: Set after uploading video via WhatsApp API
      },
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant query lambda permissions
    this.conversationsTable.grantReadWriteData(queryLambda);
    databaseSecret.grantRead(queryLambda);
    openaiApiKeySecret.grantRead(queryLambda);
    whatsappSecret.grantRead(queryLambda);

    // API Gateway for webhook endpoint
    const api = new apigateway.RestApi(this, 'WebhookApi', {
      restApiName: 'Turkish Logistics Webhook API',
      description: 'Receives Evolution API webhooks',
      deployOptions: {
        stageName: 'prod',
        throttlingRateLimit: 100,
        throttlingBurstLimit: 200,
      },
    });

    // Add webhook endpoint (for Evolution API / message ingestion)
    const webhook = api.root.addResource('webhook');
    webhook.addMethod('POST', new apigateway.LambdaIntegration(webhookLambda), {
      apiKeyRequired: false, // API key is validated in Lambda
    });

    // Add query endpoint (for WhatsApp Business API / user queries)
    const query = api.root.addResource('query');
    const queryIntegration = new apigateway.LambdaIntegration(queryLambda);
    query.addMethod('GET', queryIntegration); // Webhook verification
    query.addMethod('POST', queryIntegration); // Incoming messages

    // Payment Lambda function (handles PayTR payments)
    const paymentLambda = new NodejsFunction(this, 'PaymentHandler', {
      functionName: 'turkish-logistics-payment',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(lambdaSrcPath, 'payment.ts'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      environment: {
        CONVERSATIONS_TABLE: this.conversationsTable.tableName,
        NODE_OPTIONS: '--enable-source-maps',
        // Note: PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT set manually
        SUBSCRIPTION_PRICE: '100000', // 1000 TL in kuruş
      },
      tracing: lambda.Tracing.ACTIVE,
      bundling: {
        minify: true,
        sourceMap: true,
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant payment lambda permissions
    this.conversationsTable.grantReadWriteData(paymentLambda);

    // Add payment endpoint
    const payment = api.root.addResource('payment');
    const paymentIntegration = new apigateway.LambdaIntegration(paymentLambda);
    payment.addMethod('GET', paymentIntegration); // Generate payment link
    payment.addMethod('POST', paymentIntegration); // PayTR webhook callback
    payment.addMethod('OPTIONS', paymentIntegration); // CORS preflight

    // Outputs
    this.webhookUrl = new cdk.CfnOutput(this, 'WebhookUrl', {
      value: `${api.url}webhook`,
      description: 'Evolution API webhook URL (message ingestion)',
      exportName: 'TurkishLogisticsWebhookUrl',
    });

    this.queryWebhookUrl = new cdk.CfnOutput(this, 'QueryWebhookUrl', {
      value: `${api.url}query`,
      description: 'WhatsApp Business API webhook URL (user queries)',
      exportName: 'TurkishLogisticsQueryWebhookUrl',
    });

    new cdk.CfnOutput(this, 'RawMessagesBucketName', {
      value: this.rawMessagesBucket.bucketName,
      description: 'S3 bucket for raw messages',
      exportName: 'TurkishLogisticsRawMessagesBucket',
    });

    new cdk.CfnOutput(this, 'MessageQueueUrl', {
      value: this.messageQueue.queueUrl,
      description: 'SQS queue URL for messages',
      exportName: 'TurkishLogisticsMessageQueueUrl',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: databaseSecret.secretArn,
      description: 'Database connection secret ARN',
      exportName: 'TurkishLogisticsDatabaseSecretArn',
    });

    new cdk.CfnOutput(this, 'WebhookApiKeySecretArn', {
      value: webhookApiKeySecret.secretArn,
      description: 'Webhook API key secret ARN',
      exportName: 'TurkishLogisticsWebhookApiKeySecretArn',
    });

    // Phase 2 outputs
    new cdk.CfnOutput(this, 'ConversationsTableName', {
      value: this.conversationsTable.tableName,
      description: 'DynamoDB table for conversation history',
      exportName: 'TurkishLogisticsConversationsTable',
    });

    new cdk.CfnOutput(this, 'OpenAIApiKeySecretArn', {
      value: openaiApiKeySecret.secretArn,
      description: 'OpenAI API key secret ARN',
      exportName: 'TurkishLogisticsOpenAIApiKeySecretArn',
    });

    new cdk.CfnOutput(this, 'WhatsAppSecretArn', {
      value: whatsappSecret.secretArn,
      description: 'WhatsApp Business API credentials secret ARN',
      exportName: 'TurkishLogisticsWhatsAppSecretArn',
    });

    new cdk.CfnOutput(this, 'PaymentUrl', {
      value: `${api.url}payment`,
      description: 'PayTR payment endpoint URL',
      exportName: 'TurkishLogisticsPaymentUrl',
    });
  }
}
