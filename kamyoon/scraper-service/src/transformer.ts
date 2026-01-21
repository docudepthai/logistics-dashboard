/**
 * Transforms Kamyoon load offers to Evolution API webhook format
 * This allows the existing AWS Lambda processor to handle Kamyoon data
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  KamyoonLoadOffer,
  EvolutionWebhookPayload,
} from './types.js';

// Virtual group JID for Kamyoon messages
const KAMYOON_GROUP_JID = 'kamyoon-loads@g.us';

/**
 * Normalize Turkish phone number to WhatsApp JID format
 * 05551234567 -> 905551234567@s.whatsapp.net
 */
function phoneToJid(phone: string): string {
  // Remove all non-digits
  let normalized = phone.replace(/\D/g, '');

  // Convert local Turkish format (0XXX) to international (90XXX)
  if (normalized.startsWith('0') && normalized.length === 11) {
    normalized = '90' + normalized.slice(1);
  }

  // Add Turkish country code if missing
  if (!normalized.startsWith('90') && normalized.length === 10) {
    normalized = '90' + normalized;
  }

  return `${normalized}@s.whatsapp.net`;
}

/**
 * Parse message timestamp from Kamyoon's ISO format
 */
function parseTimestamp(messageSentTime: string): number {
  try {
    const date = new Date(messageSentTime);
    return Math.floor(date.getTime() / 1000);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Transform a Kamyoon load offer to Evolution API webhook format
 */
export function transformToWebhookPayload(
  offer: KamyoonLoadOffer,
  instanceName: string
): EvolutionWebhookPayload {
  const messageId = `kamyoon-${offer.id}-${uuidv4().slice(0, 8)}`;
  const participantJid = phoneToJid(offer.phoneNumber);
  const timestamp = parseTimestamp(offer.messageSentTime);

  return {
    event: 'messages.upsert',
    instance: instanceName,
    date_time: new Date().toISOString(),
    sender: 'kamyoon-scraper',
    data: {
      key: {
        id: messageId,
        remoteJid: KAMYOON_GROUP_JID,
        fromMe: false,
        participant: participantJid,
      },
      pushName: `Kamyoon-${offer.phoneNumber}`,
      message: {
        conversation: offer.message,
      },
      messageType: 'conversation',
      messageTimestamp: timestamp,
      owner: instanceName,
      source: 'kamyoon',
    },
  };
}

/**
 * Transform multiple Kamyoon offers to webhook payloads
 */
export function transformOffers(
  offers: KamyoonLoadOffer[],
  instanceName: string
): EvolutionWebhookPayload[] {
  return offers.map((offer) => transformToWebhookPayload(offer, instanceName));
}
