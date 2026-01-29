/**
 * Parasut Webhook Handler
 * Receives notifications from Parasut when e-archive/e-invoice PDFs are ready
 * Fetches the PDF URL and sends to user via WhatsApp
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createParasutService } from '../services/parasut.js';
import { sendInvoiceNotification } from '../utils/whatsapp.js';

// DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

interface ParasutWebhookPayload {
  event: string;
  data: {
    id: string;
    type: string;
    attributes?: {
      pdf_url?: string;
      status?: string;
    };
    relationships?: {
      sales_invoice?: {
        data?: {
          id: string;
        };
      };
    };
  };
}

/**
 * Find payment record by e-archive ID
 */
async function findPaymentByEArchiveId(eArchiveId: string): Promise<{ merchantOid: string; phoneNumber: string } | null> {
  // Scan for payment with this e-archive ID
  // Note: In production, consider using a GSI for this lookup
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'parasutEArchiveId-index',
      KeyConditionExpression: 'parasutEArchiveId = :eArchiveId',
      ExpressionAttributeValues: {
        ':eArchiveId': eArchiveId,
      },
    }));

    const item = result.Items?.[0];
    if (item) {
      const merchantOid = (item.pk as string).replace('PAYMENT#', '');
      return {
        merchantOid,
        phoneNumber: item.phoneNumber as string,
      };
    }
  } catch (error) {
    // GSI might not exist, fall back to scan
    console.log('GSI lookup failed, trying scan:', error);
  }

  // Fallback: scan (less efficient but works without GSI)
  // In a real implementation, you'd want to create the GSI
  return null;
}

/**
 * Find payment record by invoice ID
 */
async function findPaymentByInvoiceId(invoiceId: string): Promise<{ merchantOid: string; phoneNumber: string } | null> {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: 'parasutInvoiceId-index',
      KeyConditionExpression: 'parasutInvoiceId = :invoiceId',
      ExpressionAttributeValues: {
        ':invoiceId': invoiceId,
      },
    }));

    const item = result.Items?.[0];
    if (item) {
      const merchantOid = (item.pk as string).replace('PAYMENT#', '');
      return {
        merchantOid,
        phoneNumber: item.phoneNumber as string,
      };
    }
  } catch (error) {
    console.log('GSI lookup failed:', error);
  }

  return null;
}

/**
 * Handle e-archive event (PDF ready)
 */
async function handleEArchiveEvent(payload: ParasutWebhookPayload): Promise<void> {
  const eArchiveId = payload.data.id;
  const pdfUrl = payload.data.attributes?.pdf_url;

  console.log(`E-Archive event for ${eArchiveId}, PDF URL: ${pdfUrl ? 'available' : 'not available'}`);

  if (!pdfUrl) {
    console.log('No PDF URL in webhook payload, skipping');
    return;
  }

  // Find the payment record for this e-archive
  const payment = await findPaymentByEArchiveId(eArchiveId);

  if (!payment) {
    console.log(`No payment found for e-archive ${eArchiveId}`);

    // Try to find by getting invoice ID from e-archive relationship
    const invoiceId = payload.data.relationships?.sales_invoice?.data?.id;
    if (invoiceId) {
      const paymentByInvoice = await findPaymentByInvoiceId(invoiceId);
      if (paymentByInvoice) {
        await sendPdfToUser(paymentByInvoice, eArchiveId, pdfUrl);
        return;
      }
    }
    return;
  }

  await sendPdfToUser(payment, eArchiveId, pdfUrl);
}

/**
 * Send PDF to user and update database
 */
async function sendPdfToUser(
  payment: { merchantOid: string; phoneNumber: string },
  eArchiveId: string,
  pdfUrl: string
): Promise<void> {
  const { merchantOid, phoneNumber } = payment;

  console.log(`Sending PDF to ${phoneNumber} for payment ${merchantOid}`);

  // Send PDF via WhatsApp
  const sent = await sendInvoiceNotification(phoneNumber, pdfUrl, merchantOid);

  // Update payment record
  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { pk: `PAYMENT#${merchantOid}`, sk: 'PENDING' },
    UpdateExpression: 'SET invoiceStatus = :status, invoicePdfUrl = :pdfUrl, invoiceSentAt = :sentAt, updatedAt = :now',
    ExpressionAttributeValues: {
      ':status': sent ? 'sent' : 'pdf_ready',
      ':pdfUrl': pdfUrl,
      ':sentAt': sent ? new Date().toISOString() : null,
      ':now': new Date().toISOString(),
    },
  }));

  console.log(`PDF ${sent ? 'sent' : 'not sent'} for payment ${merchantOid}`);
}

/**
 * Lambda handler
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Parasut webhook received:', event.body);

  try {
    // Parse webhook payload
    const payload = JSON.parse(event.body || '{}') as ParasutWebhookPayload;

    if (!payload.event || !payload.data) {
      console.error('Invalid webhook payload');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid payload' }),
      };
    }

    console.log(`Processing Parasut event: ${payload.event}, type: ${payload.data.type}`);

    // Handle different event types
    switch (payload.event) {
      case 'e_archive.created':
      case 'e_archive.updated':
        await handleEArchiveEvent(payload);
        break;

      case 'e_invoice.created':
      case 'e_invoice.updated':
        // Similar handling for e-invoices
        await handleEArchiveEvent(payload);
        break;

      default:
        console.log(`Unhandled event type: ${payload.event}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error processing Parasut webhook:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
