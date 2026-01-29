/**
 * Invoice Generation Lambda Handler
 * Triggered by SQS queue when payment is successful
 * Generates invoices via Parasut and sends PDF to user via WhatsApp
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createParasutService, type InvoiceData, type CompanyData } from '../services/parasut.js';
import {
  sendInvoiceNotification,
  sendPaymentSuccessNotification,
  sendInvoiceFailureNotification,
} from '../utils/whatsapp.js';

// DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

interface InvoiceJobMessage {
  merchantOid: string;
  phoneNumber: string;
  totalAmount: number;
  paidAt: string;
}

interface StoredInvoiceData {
  invoiceType: 'none' | 'company';
  companyData?: CompanyData;
}

/**
 * Process a single invoice job
 */
async function processInvoiceJob(message: InvoiceJobMessage): Promise<void> {
  const { merchantOid, phoneNumber, totalAmount } = message;

  console.log(`Processing invoice for payment ${merchantOid}, phone ${phoneNumber}, amount ${totalAmount}`);

  // Get invoice data from DynamoDB (if user requested company invoice)
  let invoiceData: InvoiceData = { invoiceType: 'none' };

  try {
    const invoiceDataResult = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { pk: `PAYMENT#${merchantOid}`, sk: 'INVOICE_DATA' },
    }));

    if (invoiceDataResult.Item) {
      const stored = invoiceDataResult.Item as StoredInvoiceData;
      invoiceData = {
        invoiceType: stored.invoiceType,
        companyData: stored.companyData,
      };
      console.log(`Found invoice data: type=${invoiceData.invoiceType}`);
    } else {
      console.log('No invoice data found, using minimal invoice');
    }
  } catch (error) {
    console.error('Error fetching invoice data:', error);
    // Continue with minimal invoice
  }

  // Create Parasut service
  const parasut = createParasutService();

  if (!parasut) {
    console.error('Parasut service not available, skipping invoice generation');
    // Still send payment success notification
    await sendPaymentSuccessNotification(phoneNumber);

    // Update payment record
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `PAYMENT#${merchantOid}`, sk: 'PENDING' },
      UpdateExpression: 'SET invoiceStatus = :status, invoiceError = :error, updatedAt = :now',
      ExpressionAttributeValues: {
        ':status': 'skipped',
        ':error': 'Parasut service not configured',
        ':now': new Date().toISOString(),
      },
    }));
    return;
  }

  // Generate invoice
  const result = await parasut.createInvoice(
    { merchantOid, totalAmount },
    invoiceData
  );

  if (result.success) {
    // Send payment success notification immediately
    await sendPaymentSuccessNotification(phoneNumber);
    console.log(`Payment success notification sent to ${phoneNumber}`);

    // If PDF is ready, send it; otherwise it will be sent via Parasut webhook later
    let invoiceStatus = 'pending_pdf';
    if (result.pdfUrl) {
      const sent = await sendInvoiceNotification(phoneNumber, result.pdfUrl, merchantOid);
      invoiceStatus = sent ? 'sent' : 'pdf_ready';
      console.log(`Invoice PDF ${sent ? 'sent' : 'ready but not sent'} for ${merchantOid}`);
    }

    // Update payment record
    // Note: result.eArchiveId is actually the trackable_job_id from Parasut
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `PAYMENT#${merchantOid}`, sk: 'PENDING' },
      UpdateExpression: 'SET invoiceStatus = :status, parasutInvoiceId = :invoiceId, parasutTrackableJobId = :jobId, invoicePdfUrl = :pdfUrl, phoneNumber = :phone, updatedAt = :now',
      ExpressionAttributeValues: {
        ':status': invoiceStatus,
        ':invoiceId': result.invoiceId,
        ':jobId': result.eArchiveId || null, // This is actually trackable_job_id
        ':pdfUrl': result.pdfUrl || null,
        ':phone': phoneNumber,
        ':now': new Date().toISOString(),
      },
    }));

    console.log(`Invoice created for ${merchantOid}, status: ${invoiceStatus}`);
  } else {
    // Invoice generation failed
    console.error(`Invoice generation failed for ${merchantOid}:`, result.error);

    // Send failure notification to user
    await sendInvoiceFailureNotification(phoneNumber);

    // Update payment record with error
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `PAYMENT#${merchantOid}`, sk: 'PENDING' },
      UpdateExpression: 'SET invoiceStatus = :status, invoiceError = :error, updatedAt = :now',
      ExpressionAttributeValues: {
        ':status': 'failed',
        ':error': result.error || 'Unknown error',
        ':now': new Date().toISOString(),
      },
    }));

    // Throw error to trigger SQS retry
    throw new Error(`Invoice generation failed: ${result.error}`);
  }
}

/**
 * Process a single SQS record
 */
async function processRecord(record: SQSRecord): Promise<void> {
  const message = JSON.parse(record.body) as InvoiceJobMessage;

  // Validate message
  if (!message.merchantOid || !message.phoneNumber || !message.totalAmount) {
    console.error('Invalid invoice job message:', record.body);
    return; // Don't retry invalid messages
  }

  await processInvoiceJob(message);
}

/**
 * Lambda handler
 */
export async function handler(event: SQSEvent): Promise<{ batchItemFailures: Array<{ itemIdentifier: string }> }> {
  console.log(`Processing ${event.Records.length} invoice jobs`);

  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error(`Failed to process record ${record.messageId}:`, error);
      // Mark as failed for retry
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  // Return partial batch failures for SQS to retry
  return { batchItemFailures };
}
