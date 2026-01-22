/**
 * Message processor Lambda function.
 * Processes queued messages, parses them, and stores results in database.
 */

import type { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { parse, isLikelyLogisticsMessage, extractAllRoutes } from '@turkish-logistics/parser';
import {
  createDatabaseClient,
  type DatabaseClient,
  rawMessages,
  jobs,
  eq,
} from '@turkish-logistics/database';

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

async function processRecord(record: SQSRecord): Promise<void> {
  const message: QueuedMessage = JSON.parse(record.body);
  console.log(`Processing message: ${message.messageId}`);

  const { text, remoteJid, messageId, pushName, senderJid, instanceName, s3Bucket, s3Key, timestamp } = message;

  // Extract sender phone from JID
  const senderPhone = extractPhoneFromJid(senderJid);

  // Quick filter: skip non-logistics messages early
  if (!isLikelyLogisticsMessage(text)) {
    console.log(`Skipping non-logistics message: ${messageId}`);
    return;
  }

  // Parse the message
  const parsed = parse(text);
  console.log(`Parsed message with confidence: ${parsed.confidenceLevel}`);

  // Extract ALL routes from multi-route messages
  const routes = extractAllRoutes(text);
  if (routes.length > 0) {
    console.log(`Extracted ${routes.length} routes from message`);
  }

  const { db } = getDbClient();

  // Store raw message
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
    .returning();

  console.log(`Stored raw message: ${rawMessage?.id}`);

  // Determine contact phone: prefer parsed phone, fallback to sender phone (if valid)
  const contactPhone = parsed.phones[0]?.original || senderPhone || null;
  const contactPhoneNormalized = parsed.phones[0]?.normalized || senderPhone || null;

  // Only create job for high/medium confidence messages WITH a valid phone number
  const hasValidConfidence = parsed.confidenceLevel === 'HIGH' || parsed.confidenceLevel === 'MEDIUM';

  if (hasValidConfidence && !contactPhone) {
    console.log(`Skipped job creation: no valid phone number for message ${messageId}`);
  }

  if (hasValidConfidence && contactPhone) {
    // For multi-route messages (3+ routes), create a job for each route
    // For single route or 2 routes, use the parsed origin/destination
    if (routes.length >= 2) {
      // Create multiple jobs - one for each distinct route
      console.log(`Multi-route message: creating ${routes.length} jobs`);

      for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        if (!route) continue;

        // Use route-specific messageId to avoid duplicates
        const routeMessageId = `${messageId}_route_${i}`;

        const [job] = await db
          .insert(jobs)
          .values({
            messageId: routeMessageId,
            sourceGroupJid: remoteJid,
            rawText: text,
            messageType: parsed.messageType,
            originMentioned: route.origin,
            originProvince: route.origin,
            originProvinceCode: route.originCode || null,
            originDistrict: null, // Routes don't have district info yet
            destinationMentioned: route.destination,
            destinationProvince: route.destination,
            destinationProvinceCode: route.destinationCode || null,
            destinationDistrict: null,
            vehicleType: route.vehicle || parsed.vehicle?.vehicleType || null,
            bodyType: route.bodyType || parsed.vehicle?.bodyType || null,
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
              isMultiRoute: true,
              routeIndex: i,
              totalRoutes: routes.length,
            },
            routes: null, // Don't duplicate routes in each job
            postedAt: timestamp ? new Date(timestamp * 1000) : new Date(),
          })
          .returning();

        console.log(`Created multi-route job ${i + 1}/${routes.length}: ${job?.id} (${route.origin} → ${route.destination})`);
      }
    } else {
      // Single route - use original behavior
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
          },
          routes: routes.length > 0 ? routes : null,
          postedAt: timestamp ? new Date(timestamp * 1000) : new Date(),
        })
        .returning();

      console.log(`Created job: ${job?.id} (type: ${parsed.messageType})`);
    }
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
