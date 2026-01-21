/**
 * Webhook handler Lambda function.
 * Receives Evolution API webhooks, stores in S3, and queues for processing.
 */

import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  type EvolutionWebhookPayload,
  isMessagesUpsertEvent,
  isGroupMessage,
  isOwnMessage,
  extractTextFromMessage,
} from '@turkish-logistics/shared';

const sqs = new SQSClient({});
const s3 = new S3Client({});

const QUEUE_URL = process.env.MESSAGE_QUEUE_URL;
const S3_BUCKET = process.env.RAW_MESSAGES_BUCKET;

interface WebhookResponse {
  statusCode: number;
  body: string;
}

function response(statusCode: number, message: string): WebhookResponse {
  return {
    statusCode,
    body: JSON.stringify({ message }),
  };
}

function generateS3Key(instanceName: string, messageId: string): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `messages/${year}/${month}/${day}/${instanceName}/${messageId}.json`;
}

export async function handler(
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> {
  console.log('Received webhook event');

  // Validate request
  if (!event.body) {
    return response(400, 'Missing request body');
  }

  if (!QUEUE_URL) {
    console.error('MESSAGE_QUEUE_URL not configured');
    return response(500, 'Server configuration error');
  }

  if (!S3_BUCKET) {
    console.error('RAW_MESSAGES_BUCKET not configured');
    return response(500, 'Server configuration error');
  }

  let payload: EvolutionWebhookPayload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return response(400, 'Invalid JSON body');
  }

  // Only process messages.upsert events
  if (!isMessagesUpsertEvent(payload)) {
    console.log(`Ignoring event: ${payload.event}`);
    return response(200, 'Event ignored');
  }

  const messageData = payload.data;
  if (!messageData) {
    console.log('No message data in payload');
    return response(200, 'No message data');
  }

  // Skip own messages
  if (isOwnMessage(messageData)) {
    console.log('Skipping own message');
    return response(200, 'Own message ignored');
  }

  // Only process group messages
  if (!isGroupMessage(messageData)) {
    console.log('Skipping non-group message');
    return response(200, 'Non-group message ignored');
  }

  // Extract text content
  const text = extractTextFromMessage(messageData.message);
  if (!text || text.trim().length === 0) {
    console.log('Skipping message with no text');
    return response(200, 'No text content');
  }

  const instanceName = payload.instance || 'unknown';
  const messageId = messageData.key.id || `unknown-${Date.now()}`;
  const s3Key = generateS3Key(instanceName, messageId);

  // Store raw message in S3
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: s3Key,
        Body: JSON.stringify({
          payload,
          receivedAt: new Date().toISOString(),
        }),
        ContentType: 'application/json',
      })
    );
    console.log(`Stored message in S3: ${s3Key}`);
  } catch (err) {
    console.error('Failed to store message in S3:', err);
    return response(500, 'Failed to store message');
  }

  // Extract sender JID (participant in group messages)
  const senderJid = messageData.key.participant || messageData.key.remoteJid;

  // Queue message for processing
  const messagePayload = {
    instanceName,
    remoteJid: messageData.key.remoteJid,
    messageId,
    pushName: messageData.pushName,
    senderJid,
    text,
    timestamp: messageData.messageTimestamp,
    receivedAt: new Date().toISOString(),
    s3Bucket: S3_BUCKET,
    s3Key,
  };

  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: QUEUE_URL,
        MessageBody: JSON.stringify(messagePayload),
        MessageGroupId: messageData.key.remoteJid || 'default',
        MessageDeduplicationId: messageId,
      })
    );
    console.log(`Queued message: ${messageId}`);
  } catch (err) {
    console.error('Failed to queue message:', err);
    return response(500, 'Failed to queue message');
  }

  return response(200, 'Message stored and queued');
}
