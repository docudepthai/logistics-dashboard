/**
 * Database entity types.
 */

/**
 * Raw message record
 */
export interface RawMessage {
  id: string;
  messageId: string;
  instanceName: string;
  remoteJid: string;
  senderJid?: string;
  messageType: string;
  content?: string;
  s3Bucket: string;
  s3Key: string;
  isProcessed: boolean;
  processedAt?: Date;
  processingError?: string;
  receivedAt: Date;
  messageTimestamp?: Date;
  createdAt: Date;
}

/**
 * Parsed job record
 */
export interface Job {
  id: string;
  messageId: string;
  sourceGroupJid: string;
  rawText: string;

  // Locations
  originMentioned?: string;
  originProvince?: string;
  originProvinceCode?: number;
  destinationMentioned?: string;
  destinationProvince?: string;
  destinationProvinceCode?: number;

  // Vehicle
  vehicleType?: string;
  isRefrigerated: boolean;

  // Contact
  contactPhone?: string;
  contactName?: string;

  // Cargo
  weight?: number;
  cargoType?: string;

  // Metadata
  confidenceScore?: number;
  postedAt?: Date;
  createdAt: Date;
  isActive: boolean;
}

/**
 * Source group record
 */
export interface SourceGroup {
  id: string;
  jid: string;
  displayName?: string;
  isActive: boolean;
  messageCount: number;
  createdAt: Date;
}

/**
 * Province reference record
 */
export interface ProvinceRecord {
  code: number;
  name: string;
  region: string;
}

/**
 * District reference record
 */
export interface DistrictRecord {
  id: string;
  name: string;
  provinceCode: number;
}

/**
 * Processing log record
 */
export interface ProcessingLog {
  id: string;
  rawMessageId: string;
  status: 'received' | 'queued' | 'processing' | 'parsed' | 'stored' | 'failed' | 'skipped';
  stage: string;
  errorCode?: string;
  errorMessage?: string;
  durationMs?: number;
  lambdaRequestId?: string;
  createdAt: Date;
}
