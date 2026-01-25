/**
 * Message processor Lambda function.
 * Processes queued messages, parses them, and stores results in database.
 * Also sends proactive notifications when new jobs match pending user searches.
 */

import type { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { parseWithAI, isAIParsingAvailable } from '@turkish-logistics/parser';
import {
  createDatabaseClient,
  type DatabaseClient,
  rawMessages,
  jobs,
  eq,
} from '@turkish-logistics/database';
import { ConversationStore, type PendingNotification } from '@turkish-logistics/agent';

interface QueuedMessage {
  instanceName: string;
  remoteJid: string;
  messageId: string;
  pushName?: string;
  senderJid?: string;
  text: string;
  timestamp?: number;
  receivedAt: string;
  s3Bucket: string;
  s3Key: string;
}

/**
 * Extract phone number from WhatsApp JID
 * Format: 905551234567@s.whatsapp.net -> 05551234567
 * Returns null for linked device IDs (@lid) which are not real phone numbers
 */
function extractPhoneFromJid(jid: string | undefined): string | null {
  if (!jid) return null;

  // Skip linked device IDs - these are not real phone numbers
  if (jid.endsWith('@lid')) return null;

  // Extract number before @
  const match = jid.match(/^(\d+)@/);
  if (!match?.[1]) return null;

  let phone: string = match[1];

  // Convert Turkish country code (90) to local format (0)
  if (phone.startsWith('90') && phone.length >= 12) {
    phone = '0' + phone.slice(2);
  }

  return phone;
}

// Singleton database client for connection reuse across Lambda invocations
let dbClient: DatabaseClient | null = null;

function getDbClient(): DatabaseClient {
  if (!dbClient) {
    dbClient = createDatabaseClient({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true',
      max: 1, // Lambda should use single connection
      idleTimeoutMillis: 120000,
      connectionTimeoutMillis: 5000,
    });
  }
  return dbClient;
}

// Singleton ConversationStore for pending notifications
let conversationStore: ConversationStore | null = null;

function getConversationStore(): ConversationStore {
  if (!conversationStore) {
    conversationStore = new ConversationStore({
      tableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
      region: process.env.AWS_REGION || 'eu-central-1',
    });
  }
  return conversationStore;
}

/**
 * Send a WhatsApp notification to a user about a matching job
 */
async function sendWhatsAppNotification(phoneNumber: string, message: string): Promise<boolean> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn('[Notification] WhatsApp credentials not configured');
    return false;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Notification] WhatsApp API error: ${response.status} - ${errorText}`);
      return false;
    }

    console.log(`[Notification] Sent to ${phoneNumber}`);
    return true;
  } catch (error) {
    console.error('[Notification] Failed to send WhatsApp message:', error);
    return false;
  }
}

/**
 * Check for pending notifications matching a new job and send notifications
 */
async function notifyMatchingUsers(
  origin: string | null,
  destination: string | null,
  jobDetails: { weight?: string; vehicleType?: string; contactPhone?: string }
): Promise<void> {
  if (!origin) return;

  const store = getConversationStore();
  const originLower = origin.toLowerCase();
  const destLower = destination?.toLowerCase();

  try {
    // Query pending notifications for this route
    const pendingNotifications = await store.getPendingNotificationsByRoute(originLower, destLower);

    if (pendingNotifications.length === 0) {
      return;
    }

    console.log(`[Notification] Found ${pendingNotifications.length} pending notifications for ${originLower} → ${destLower || 'ANY'}`);

    // Build notification message
    const routeStr = destLower ? `${originLower}-${destLower}` : `${originLower}`;
    const details: string[] = [];
    if (jobDetails.weight) details.push(`${jobDetails.weight} ton`);
    if (jobDetails.vehicleType) details.push(jobDetails.vehicleType);
    const detailsStr = details.length > 0 ? `, ${details.join(', ')}` : '';
    const phoneStr = jobDetails.contactPhone ? ` tel: ${jobDetails.contactPhone}` : '';

    const message = `abi ${routeStr} yuku geldi!${detailsStr}${phoneStr}`;

    // Send notification to each user and delete the pending record
    for (const notification of pendingNotifications) {
      try {
        const sent = await sendWhatsAppNotification(notification.userId, message);
        if (sent) {
          // Delete the pending notification after successful send
          await store.deletePendingNotification(notification.pk, notification.sk);
          console.log(`[Notification] Notified ${notification.userId} and deleted pending record`);
        }
      } catch (err) {
        console.error(`[Notification] Failed to process notification for ${notification.userId}:`, err);
      }
    }
  } catch (error) {
    console.error('[Notification] Error processing notifications:', error);
    // Don't fail the job creation if notifications fail
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const message: QueuedMessage = JSON.parse(record.body);
  console.log(`Processing message: ${message.messageId}`);

  const { text, remoteJid, messageId, pushName, senderJid, instanceName, s3Bucket, s3Key, timestamp } = message;

  // Extract sender phone from JID
  const senderPhone = extractPhoneFromJid(senderJid);

  // Skip very short messages (unlikely to be logistics)
  if (!text || text.trim().length < 10) {
    console.log(`Skipping short message: ${messageId}`);
    return;
  }

  // Check if AI parsing is available
  if (!isAIParsingAvailable()) {
    console.error('OPENAI_API_KEY not configured - cannot parse messages');
    throw new Error('AI parsing not available');
  }

  // Parse the message using GPT-4o-mini for accurate location extraction
  const parsed = await parseWithAI(text);
  console.log(`AI parsed message with confidence: ${parsed.confidenceLevel}`);

  if (parsed.warnings.length > 0) {
    console.log(`Parser warnings: ${parsed.warnings.join(', ')}`);
  }

  const { db } = getDbClient();

  // Store raw message (handle duplicates gracefully)
  const [rawMessage] = await db
    .insert(rawMessages)
    .values({
      messageId,
      instanceName,
      remoteJid,
      senderJid: senderJid || null,
      messageType: 'text',
      content: text,
      rawPayload: { pushName, timestamp, senderPhone },
      s3Bucket,
      s3Key,
      isProcessed: false,
      messageTimestamp: timestamp ? new Date(timestamp * 1000) : null,
    })
    .onConflictDoNothing({ target: rawMessages.messageId })
    .returning();

  // If rawMessage is null, it means duplicate - check if already processed
  if (!rawMessage) {
    const existing = await db
      .select({ isProcessed: rawMessages.isProcessed })
      .from(rawMessages)
      .where(eq(rawMessages.messageId, messageId))
      .limit(1);

    if (existing[0]?.isProcessed) {
      console.log(`Message already processed: ${messageId}`);
      return;
    }
    console.log(`Duplicate message, continuing to create jobs: ${messageId}`);
  } else {
    console.log(`Stored raw message: ${rawMessage.id}`);
  }

  // Determine contact phone: prefer parsed phone, fallback to sender phone (if valid)
  const contactPhone = parsed.phones[0]?.original || senderPhone || null;
  const contactPhoneNormalized = parsed.phones[0]?.normalized || senderPhone || null;

  // Only create job for high/medium confidence messages WITH a valid phone number
  const hasValidConfidence = parsed.confidenceLevel === 'HIGH' || parsed.confidenceLevel === 'MEDIUM';

  if (hasValidConfidence && !contactPhone) {
    console.log(`Skipped job creation: no valid phone number for message ${messageId}`);
  }

  if (hasValidConfidence && contactPhone) {
    // Create a single job with the AI-parsed origin/destination
    const [job] = await db
      .insert(jobs)
      .values({
        messageId,
        sourceGroupJid: remoteJid,
        rawText: text,
        messageType: parsed.messageType,
        originMentioned: parsed.origin?.originalText || null,
        originProvince: parsed.origin?.provinceName || null,
        originProvinceCode: parsed.origin?.provinceCode || null,
        originDistrict: parsed.origin?.districtName || null,
        destinationMentioned: parsed.destination?.originalText || null,
        destinationProvince: parsed.destination?.provinceName || null,
        destinationProvinceCode: parsed.destination?.provinceCode || null,
        destinationDistrict: parsed.destination?.districtName || null,
        vehicleType: parsed.vehicle?.vehicleType || null,
        bodyType: parsed.vehicle?.bodyType || null,
        isRefrigerated: parsed.vehicle?.isRefrigerated || false,
        contactPhone,
        contactPhoneNormalized,
        contactName: parsed.contact?.name || null,
        senderJid: senderJid || null,
        senderPhone: senderPhone || null,
        weight: parsed.weight?.value?.toString() || null,
        weightUnit: parsed.weight?.unit || 'ton',
        cargoType: parsed.cargoType || null,
        loadType: parsed.loadType || null,
        isUrgent: parsed.isUrgent,
        confidenceScore: parsed.confidenceScore.toFixed(2),
        confidenceLevel: parsed.confidenceLevel,
        parsedFields: {
          allPhones: parsed.phones.map((p) => p.normalized),
          urgencyIndicators: parsed.urgencyIndicators,
          confidenceFactors: parsed.confidenceFactors,
          mentionedLocations: parsed.mentionedLocations.map((l) => ({
            provinceName: l.provinceName,
            provinceCode: l.provinceCode,
            districtName: l.districtName,
          })),
          parsedByAI: true,
        },
        routes: null,
        postedAt: timestamp ? new Date(timestamp * 1000) : new Date(),
      })
      .returning();

    console.log(`Created job: ${job?.id} (${parsed.origin?.provinceName || '?'} → ${parsed.destination?.provinceName || '?'})`);

    // === PROACTIVE NOTIFICATION: Notify users who searched for this route ===
    await notifyMatchingUsers(
      parsed.origin?.provinceName || null,
      parsed.destination?.provinceName || null,
      {
        weight: parsed.weight?.value?.toString(),
        vehicleType: parsed.vehicle?.vehicleType || undefined,
        contactPhone: contactPhone || undefined,
      }
    );
  } else if (!hasValidConfidence) {
    console.log(`Skipped job creation: confidence too low (${parsed.confidenceLevel})`);
  }

  // Always mark message as processed
  await db
    .update(rawMessages)
    .set({
      isProcessed: true,
      processedAt: new Date(),
    })
    .where(eq(rawMessages.messageId, messageId));
}

export async function handler(event: SQSEvent, _context: Context): Promise<void> {
  console.log(`Processing ${event.Records.length} messages`);

  const results = await Promise.allSettled(
    event.Records.map((record) => processRecord(record))
  );

  // Log any failures
  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected'
  );

  if (failures.length > 0) {
    console.error(`${failures.length} messages failed processing:`);
    failures.forEach((f, i) => console.error(`  ${i + 1}: ${f.reason}`));

    // For partial batch failure, throw to trigger retry
    if (failures.length === results.length) {
      throw new Error('All messages failed processing');
    }
  }

  console.log(
    `Processed ${results.length - failures.length}/${results.length} messages successfully`
  );
}
