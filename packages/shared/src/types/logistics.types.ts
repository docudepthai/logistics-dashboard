/**
 * Logistics message parsing types.
 */

/**
 * Possible province for ambiguous district
 */
export interface PossibleProvince {
  provinceName: string;
  provinceCode: number;
}

/**
 * Parsed location with normalization info
 */
export interface ParsedLocation {
  /** Original text as found in message */
  originalText: string;
  /** Normalized province name */
  provinceName: string;
  /** Province plate code (1-81) */
  provinceCode: number;
  /** District name if matched */
  districtName?: string;
  /** Was this matched from a district */
  isDistrict: boolean;
  /** Match confidence (0-1) */
  confidence: number;
  /** Is this an ambiguous district (exists in multiple provinces) */
  isAmbiguous?: boolean;
  /** All possible provinces if district is ambiguous */
  possibleProvinces?: PossibleProvince[];
}

/**
 * Parsed vehicle information
 */
export interface ParsedVehicle {
  /** Vehicle type (TIR, KAMYON, etc.) */
  vehicleType?: string;
  /** Body type (TENTELI, FRIGO, etc.) */
  bodyType?: string;
  /** Original matched text */
  originalText: string;
  /** Is refrigerated */
  isRefrigerated: boolean;
}

/**
 * Parsed phone number
 */
export interface ParsedPhone {
  /** Original text */
  original: string;
  /** Normalized format: 05XXXXXXXXX */
  normalized: string;
  /** Contains masked digits */
  isMasked: boolean;
}

/**
 * Parsed weight/tonnage
 */
export interface ParsedWeight {
  /** Weight value */
  value: number;
  /** Unit (ton, kg) */
  unit: string;
  /** Original text */
  originalText: string;
}

/**
 * Parsed contact information
 */
export interface ParsedContact {
  /** Contact name */
  name: string;
  /** Title (bey, hanim) */
  title?: string;
  /** Original text */
  originalText: string;
}

/**
 * Confidence level for parsed results
 */
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW';

/**
 * Message type classification
 */
export type MessageType =
  | 'VEHICLE_WANTED' // "TIR ARANIYOR"
  | 'CARGO_AVAILABLE' // "yük var"
  | 'VEHICLE_AVAILABLE' // "boş araç var"
  | 'UNKNOWN';

/**
 * Load type - FTL (Full Truck Load) or LTL (Less Than Truck Load / Parsiyel)
 */
export type LoadType = 'FTL' | 'LTL';

/**
 * Complete parsed message result
 */
export interface ParsedMessage {
  /** Original message text */
  originalMessage: string;
  /** Detected message type */
  messageType: MessageType;

  /** Origin location */
  origin?: ParsedLocation;
  /** Destination location */
  destination?: ParsedLocation;
  /** All mentioned locations */
  mentionedLocations: ParsedLocation[];

  /** Vehicle information */
  vehicle?: ParsedVehicle;

  /** Extracted phone numbers */
  phones: ParsedPhone[];
  /** Contact information */
  contact?: ParsedContact;

  /** Weight/tonnage */
  weight?: ParsedWeight;
  /** Cargo type description */
  cargoType?: string;
  /** Load type - FTL or LTL (parsiyel) */
  loadType?: LoadType;

  /** Is marked as urgent */
  isUrgent: boolean;
  /** Urgency indicator words found */
  urgencyIndicators: string[];

  /** Overall confidence level */
  confidenceLevel: ConfidenceLevel;
  /** Confidence score (0-1) */
  confidenceScore: number;
  /** Individual confidence factors */
  confidenceFactors: Record<string, number>;

  /** Parsing warnings/notes */
  warnings: string[];
}

/**
 * Factory function to create an empty parsed message
 */
export function createEmptyParsedMessage(originalMessage: string): ParsedMessage {
  return {
    originalMessage,
    messageType: 'UNKNOWN',
    mentionedLocations: [],
    phones: [],
    isUrgent: false,
    urgencyIndicators: [],
    confidenceLevel: 'VERY_LOW',
    confidenceScore: 0,
    confidenceFactors: {},
    warnings: [],
  };
}
