/**
 * Evolution API webhook types for MESSAGES_UPSERT event.
 */

/**
 * Evolution API webhook payload
 */
export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionMessageData;
  destination?: string;
  date_time?: string;
  sender?: string;
  server_url?: string;
  apikey?: string;
}

/**
 * Message data from Evolution API
 */
export interface EvolutionMessageData {
  key: EvolutionMessageKey;
  pushName?: string;
  message?: EvolutionMessage;
  messageType?: string;
  messageTimestamp?: number;
  owner?: string;
  source?: string;
}

/**
 * Message key identifying the message
 */
export interface EvolutionMessageKey {
  /** Unique message ID */
  id: string;
  /** Remote JID - ends with @g.us for groups, @s.whatsapp.net for individuals */
  remoteJid: string;
  /** True if message was sent by us */
  fromMe: boolean;
  /** Participant JID (only for group messages) */
  participant?: string;
}

/**
 * Message content
 */
export interface EvolutionMessage {
  /** Simple text message */
  conversation?: string;
  /** Extended text message (with links, formatting, or replies) */
  extendedTextMessage?: {
    text?: string;
    contextInfo?: {
      quotedMessage?: EvolutionMessage;
      participant?: string;
    };
  };
  /** Image message */
  imageMessage?: {
    url?: string;
    mimetype?: string;
    caption?: string;
  };
  /** Document message */
  documentMessage?: {
    url?: string;
    mimetype?: string;
    fileName?: string;
    caption?: string;
  };
  /** Location message */
  locationMessage?: {
    degreesLatitude?: number;
    degreesLongitude?: number;
  };
  /** Contact message */
  contactMessage?: {
    displayName?: string;
    vcard?: string;
  };
}

/**
 * Check if a webhook payload is a valid messages.upsert event
 */
export function isMessagesUpsertEvent(
  payload: EvolutionWebhookPayload
): boolean {
  return payload.event === 'messages.upsert';
}

/**
 * Check if the message is from a group
 */
export function isGroupMessage(data: EvolutionMessageData): boolean {
  return data.key.remoteJid.endsWith('@g.us');
}

/**
 * Check if the message is from the bot itself
 */
export function isOwnMessage(data: EvolutionMessageData): boolean {
  return data.key.fromMe;
}

/**
 * Extract text content from a message
 */
export function extractTextFromMessage(
  message: EvolutionMessage | undefined
): string | undefined {
  if (!message) return undefined;

  // Check simple conversation first
  if (message.conversation) {
    return message.conversation;
  }

  // Check extended text message
  if (message.extendedTextMessage?.text) {
    return message.extendedTextMessage.text;
  }

  // Check image/document captions
  if (message.imageMessage?.caption) {
    return message.imageMessage.caption;
  }

  if (message.documentMessage?.caption) {
    return message.documentMessage.caption;
  }

  return undefined;
}
