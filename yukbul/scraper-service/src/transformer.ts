/**
 * Transforms YukBul listings to Evolution API webhook format
 * This allows the existing AWS Lambda processor to handle YukBul data
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  YukbulListing,
  EvolutionWebhookPayload,
} from './types.js';

// Virtual group JID for YukBul messages
const YUKBUL_GROUP_JID = 'yukbul-loads@g.us';

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
 * Parse message timestamp from YukBul's ISO format
 */
function parseTimestamp(createdAt: string): number {
  try {
    const date = new Date(createdAt);
    return Math.floor(date.getTime() / 1000);
  } catch {
    return Math.floor(Date.now() / 1000);
  }
}

/**
 * Build a message string from YukBul listing data
 * Mimics the format of WhatsApp logistics messages
 */
function buildMessage(listing: YukbulListing): string {
  const origin = listing.origin_location?.[0];
  const dest = listing.destination_location?.[0];
  const trailers = listing.trailer_types?.map(t => t.trailer_type).join(', ') || '';

  const parts: string[] = [];

  // Origin - Destination
  const originStr = origin?.district && origin.district !== 'Merkez'
    ? `${origin.city}/${origin.district}`
    : origin?.city || '';
  const destStr = dest?.district && dest.district !== 'Merkez'
    ? `${dest.city}/${dest.district}`
    : dest?.city || '';

  if (originStr && destStr) {
    parts.push(`${originStr} - ${destStr}`);
  } else if (originStr) {
    parts.push(`${originStr}'den yük`);
  } else if (destStr) {
    parts.push(`${destStr}'e yük`);
  }

  // Vehicle type and trailers
  if (listing.vehicle_type) {
    let vehicleLine = listing.vehicle_type;
    if (trailers) {
      vehicleLine += ` (${trailers})`;
    }
    parts.push(vehicleLine);
  }

  // Cargo type and amount
  if (listing.cargo_type && listing.cargo_type !== 'Belirtilmemiş') {
    let cargoLine = listing.cargo_type;
    if (listing.cargo_amount && listing.cargo_amount !== '-') {
      cargoLine += ` - ${listing.cargo_amount}`;
    }
    parts.push(cargoLine);
  }

  // Price
  if (listing.price && listing.price > 0) {
    parts.push(`Fiyat: ${listing.price} TL`);
  }

  // Phone
  if (listing.phone_number) {
    parts.push(`Tel: ${listing.phone_number}`);
  }

  return parts.join('\n');
}

/**
 * Transform a YukBul listing to Evolution API webhook format
 */
export function transformToWebhookPayload(
  listing: YukbulListing,
  instanceName: string
): EvolutionWebhookPayload {
  const messageId = `yukbul-${listing.id}-${uuidv4().slice(0, 8)}`;
  const participantJid = phoneToJid(listing.phone_number);
  const timestamp = parseTimestamp(listing.created_at);
  const message = buildMessage(listing);

  return {
    event: 'messages.upsert',
    instance: instanceName,
    date_time: new Date().toISOString(),
    sender: 'yukbul-scraper',
    data: {
      key: {
        id: messageId,
        remoteJid: YUKBUL_GROUP_JID,
        fromMe: false,
        participant: participantJid,
      },
      pushName: `YukBul-${listing.phone_number}`,
      message: {
        conversation: message,
      },
      messageType: 'conversation',
      messageTimestamp: timestamp,
      owner: instanceName,
      source: 'yukbul',
    },
  };
}

/**
 * Transform multiple YukBul listings to webhook payloads
 */
export function transformListings(
  listings: YukbulListing[],
  instanceName: string
): EvolutionWebhookPayload[] {
  return listings.map((listing) => transformToWebhookPayload(listing, instanceName));
}
