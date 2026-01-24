/**
 * Type definitions for YukBul scraper service
 */

// YukBul API response types
export interface YukbulListing {
  id: number;
  price: number;
  origin: number;
  user_id: string | null;
  cargo_type: string;
  created_at: string;
  updated_at: string;
  destination: number;
  cargo_amount: string;
  phone_number: string;
  vehicle_type: string;
  trailer_types: YukbulTrailerType[];
  origin_location: YukbulLocation[];
  destination_location: YukbulLocation[];
}

export interface YukbulTrailerType {
  id: number;
  listing: number;
  created_at: string;
  trailer_type: string;
}

export interface YukbulLocation {
  id: number;
  city: string;
  district: string;
}

export interface YukbulApiResponse {
  items: YukbulListing[];
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
  yukbulApiKey: string;
  yukbulAuthToken: string;
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
