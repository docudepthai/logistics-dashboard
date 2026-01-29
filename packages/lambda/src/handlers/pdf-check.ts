/**
 * PDF Check Lambda Handler
 * Scheduled to run every 2 minutes
 * Checks pending e-archive PDFs and sends to users when ready
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { createParasutService } from '../services/parasut.js';
import { sendInvoiceNotification } from '../utils/whatsapp.js';

// DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

interface PendingPdfRecord {
  pk: string;
  sk: string;
  phoneNumber: string;
  parasutTrackableJobId?: string; // The job ID returned from e-archive creation
  parasutEArchiveId?: string; // Legacy field, may contain job ID
  parasutInvoiceId?: string;
  invoiceStatus: string;
  createdAt?: string;
}

/**
 * Check if trackable job is done and get e-archive ID from invoice
 */
async function getEArchiveIdFromInvoice(
  accessToken: string,
  companyId: string,
  invoiceId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/sales_invoices/${invoiceId}?include=active_e_document`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.log(`Failed to get invoice ${invoiceId}: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      data: {
        relationships?: {
          active_e_document?: {
            data?: { id: string; type: string };
          };
        };
      };
    };

    const eDocData = data.data.relationships?.active_e_document?.data;
    if (eDocData?.id) {
      console.log(`Found e-archive ID ${eDocData.id} for invoice ${invoiceId}`);
      return eDocData.id;
    }

    console.log(`No active e-document found for invoice ${invoiceId}`);
    return null;
  } catch (error) {
    console.error(`Error getting e-archive from invoice ${invoiceId}:`, error);
    return null;
  }
}

/**
 * Get PDF URL from e-archive using the e-archive/pdf endpoint
 */
async function getPdfUrlFromEArchive(
  accessToken: string,
  companyId: string,
  eArchiveId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `https://api.parasut.com/v4/${companyId}/e_archives/${eArchiveId}/pdf`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.log(`Failed to get PDF for e-archive ${eArchiveId}: ${response.status}`);
      return null;
    }

    const data = await response.json() as {
      data: { attributes: { url?: string } };
    };

    return data.data.attributes.url || null;
  } catch (error) {
    console.error(`Error getting PDF URL for e-archive ${eArchiveId}:`, error);
    return null;
  }
}

/**
 * Check PDF status - handles both job ID and invoice ID
 */
async function checkPdfStatus(
  trackableJobId: string | undefined,
  invoiceId: string | undefined
): Promise<string | null> {
  const parasut = createParasutService();
  if (!parasut) {
    console.log('Parasut service not available');
    return null;
  }

  if (!invoiceId) {
    console.log('No invoice ID available');
    return null;
  }

  try {
    const accessToken = await parasut.getAccessToken();
    const companyId = process.env.PARASUT_COMPANY_ID;

    if (!companyId) {
      console.log('PARASUT_COMPANY_ID not configured');
      return null;
    }

    // If we have a trackable job ID, check if it's done first
    if (trackableJobId) {
      const jobResponse = await fetch(
        `https://api.parasut.com/v4/${companyId}/trackable_jobs/${trackableJobId}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (jobResponse.ok) {
        const jobData = await jobResponse.json() as {
          data: { attributes: { status: string } };
        };
        const jobStatus = jobData.data.attributes.status;
        console.log(`Trackable job ${trackableJobId}: status=${jobStatus}`);

        if (jobStatus !== 'done') {
          console.log('E-archive job still processing');
          return null;
        }
      }
    }

    // Get the actual e-archive ID from the invoice
    const eArchiveId = await getEArchiveIdFromInvoice(accessToken, companyId, invoiceId);
    if (!eArchiveId) {
      console.log('E-archive not ready yet');
      return null;
    }

    // Get the PDF URL
    const pdfUrl = await getPdfUrlFromEArchive(accessToken, companyId, eArchiveId);
    if (pdfUrl) {
      console.log(`Got PDF URL for e-archive ${eArchiveId}`);
    }

    return pdfUrl;
  } catch (error) {
    console.error('Error checking PDF status:', error);
    return null;
  }
}

/**
 * Lambda handler
 */
export async function handler(): Promise<{ processed: number; sent: number }> {
  console.log('Starting PDF check...');
  console.log(`Using table: ${TABLE_NAME}`);

  // Find all payments with pending_pdf status (with pagination)
  const pendingRecords: PendingPdfRecord[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let totalScanned = 0;

  do {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'invoiceStatus = :status',
      ExpressionAttributeValues: {
        ':status': 'pending_pdf',
      },
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    totalScanned += scanResult.ScannedCount || 0;
    pendingRecords.push(...(scanResult.Items || []) as PendingPdfRecord[]);
    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  console.log(`Scanned ${totalScanned} items total, found ${pendingRecords.length} pending PDF records`);
  if (pendingRecords.length > 0) {
    console.log('Records:', JSON.stringify(pendingRecords.map(r => ({ pk: r.pk, phone: r.phoneNumber }))))
  }

  let processed = 0;
  let sent = 0;

  for (const record of pendingRecords) {
    processed++;
    const merchantOid = record.pk.replace('PAYMENT#', '');

    // Need either trackable job ID or invoice ID
    const jobId = record.parasutTrackableJobId || record.parasutEArchiveId; // Legacy fallback
    if (!record.parasutInvoiceId || !record.phoneNumber) {
      console.log(`Skipping ${merchantOid}: missing invoiceId or phoneNumber`);
      continue;
    }

    // Check if PDF is ready
    const pdfUrl = await checkPdfStatus(jobId, record.parasutInvoiceId);

    if (pdfUrl) {
      // Send PDF to user
      console.log(`Sending PDF to ${record.phoneNumber} for ${merchantOid}`);
      const messageSent = await sendInvoiceNotification(record.phoneNumber, pdfUrl, merchantOid);

      // Update record with PDF URL and sent status
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk: record.pk, sk: record.sk },
        UpdateExpression: 'SET invoiceStatus = :status, invoicePdfUrl = :pdfUrl, invoiceSentAt = :sentAt, updatedAt = :now',
        ExpressionAttributeValues: {
          ':status': messageSent ? 'sent' : 'pdf_ready',
          ':pdfUrl': pdfUrl,
          ':sentAt': messageSent ? new Date().toISOString() : null,
          ':now': new Date().toISOString(),
        },
      }));

      if (messageSent) sent++;
      console.log(`PDF ${messageSent ? 'sent' : 'ready but not sent'} for ${merchantOid}`);
    } else {
      // Check if record is too old (> 1 hour)
      const createdAt = record.createdAt ? new Date(record.createdAt) : new Date();
      const age = Date.now() - createdAt.getTime();
      const maxAge = 60 * 60 * 1000; // 1 hour

      if (age > maxAge) {
        console.log(`Record ${merchantOid} too old (${Math.round(age / 60000)}min), marking as failed`);
        await docClient.send(new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk: record.pk, sk: record.sk },
          UpdateExpression: 'SET invoiceStatus = :status, invoiceError = :error, updatedAt = :now',
          ExpressionAttributeValues: {
            ':status': 'pdf_timeout',
            ':error': 'PDF not available after 1 hour',
            ':now': new Date().toISOString(),
          },
        }));
      }
    }

    // Small delay between API calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`PDF check complete: processed=${processed}, sent=${sent}`);
  return { processed, sent };
}
