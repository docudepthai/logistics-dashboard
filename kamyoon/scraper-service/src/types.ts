/**
 * Type definitions for Kamyoon scraper service
 */

// Kamyoon API response types
export interface KamyoonLoadOffer {
  $id: string;
  id: number;
  loadOfferGroupTitle: string;
  message: string;
  phoneNumber: string;
  messageHtml: string;
  messageSentTime: string;
  reactions: {
    $id: string;
    $values: unknown[];
  };
}

export interface KamyoonApiResponse {
  $id: string;
  $values: KamyoonLoadOffer[];
}

// Evolution API webhook format (matching AWS Lambda expectation)
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

export interface EvolutionMessageData {
  key: EvolutionMessageKey;
  pushName?: string;
  message?: EvolutionMessage;
  messageType?: string;
  messageTimestamp?: number;
  owner?: string;
  source?: string;
}

export interface EvolutionMessageKey {
  id: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
}

export interface EvolutionMessage {
  conversation?: string;
  extendedTextMessage?: {
    text?: string;
    contextInfo?: {
      quotedMessage?: EvolutionMessage;
      participant?: string;
    };
  };
}

// Service configuration
export interface ScraperConfig {
  kamyoonToken: string;
  webhookUrl: string;
  webhookApiKey: string;
  fetchSize: number;
  cronSchedule: string;
  instanceName: string;
}

// Processed message tracking
export interface ProcessedMessage {
  id: number;
  processedAt: Date;
}
