/**
 * AI-powered parser using OpenAI GPT-4o-mini.
 * Uses JSON mode for reliable structured output.
 */

import OpenAI from 'openai';
import {
  createEmptyParsedMessage,
  type ParsedMessage,
  type ParsedLocation,
  type ParsedVehicle,
  type ParsedPhone,
  type MessageType,
  getProvinceByName,
} from '@turkish-logistics/shared';
import { calculateConfidence } from './confidence.js';

/**
 * Structured response from GPT-4o-mini
 */
interface AIParseResult {
  origin?: {
    province: string;
    district?: string;
  };
  destination?: {
    province: string;
    district?: string;
  };
  vehicleType?: string;
  bodyType?: string;
  isRefrigerated: boolean;
  phones: string[];
  weight?: {
    value: number;
    unit: string;
  };
  cargoType?: string;
  contactName?: string;
  messageType: 'CARGO_AVAILABLE' | 'VEHICLE_WANTED' | 'VEHICLE_AVAILABLE' | 'UNKNOWN';
  isUrgent: boolean;
  additionalLocations?: Array<{
    province: string;
    district?: string;
  }>;
}

const SYSTEM_PROMPT = `You are a Turkish logistics message parser. Extract structured data from Turkish logistics/freight messages.

Return a JSON object with:
- origin: { province: string, district?: string } - Starting location (look for "dan", "den" suffixes or first location)
- destination: { province: string, district?: string } - Ending location (look for "a", "e", "ya", "ye" suffixes or second location)
- vehicleType: "TIR" | "KAMYON" | "KAMYONET" | "KIRKAYAK" | "10 TEKER" | "6 TEKER" | null - Vehicle type mentioned
  - "TIR" = standard truck/semi
  - "KAMYON" = truck
  - "KAMYONET" = small truck/van
  - "KIRKAYAK" or "40 AYAK" = 40-foot container
  - "10 TEKER" = 10-wheeler
  - "6 TEKER" = 6-wheeler
- bodyType: "TENTELI" | "KAPALI" | "ACIK" | "DAMPERLI" | "1360" | null - Vehicle body/trailer type
  - "TENTELI" = tarpaulin/curtain-sided
  - "KAPALI" = closed/box
  - "ACIK" = open/flatbed
  - "DAMPERLI" = tipper/dump
  - "1360" or "13.60" = 13.60 meter trailer (standard TIR length, NOT weight!)
- isRefrigerated: boolean - true if "frigo", "frigorifik", "termokin", "soğutmalı" mentioned
- phones: string[] - All phone numbers found (Turkish mobile format)
- weight: { value: number, unit: "ton" | "kg" } | null - ONLY actual cargo weight (e.g., "15 ton", "5000 kg"). DO NOT confuse with:
  - Vehicle measurements like "1360" (13.60 meters)
  - "8 metre" (vehicle length)
  - Dimensions or vehicle specs
- cargoType: string | null - Type of cargo (e.g., "palet", "gıda", "tekstil", "demir", "makine", "seramik")
- contactName: string | null - Contact person name if mentioned (look for Turkish names near phone numbers)
- messageType: "CARGO_AVAILABLE" | "VEHICLE_WANTED" | "VEHICLE_AVAILABLE" | "UNKNOWN"
  - CARGO_AVAILABLE: Message offers cargo/freight (yük var, yükleme, etc.) - this is most common
  - VEHICLE_WANTED: Looking for a vehicle (araç aranıyor, TIR lazım, ihtiyaç var, etc.)
  - VEHICLE_AVAILABLE: Vehicle is available (boş araç, müsait, etc.)
- isUrgent: boolean - true if "acil", "hemen", "bugün", "yarın" mentioned
- additionalLocations: Array of other locations mentioned besides origin/destination

Important Turkish logistics terms:
- "Parsiyel" or "Parça" = partial/LTL load
- "Komple" = full truckload (FTL)
- "Hafif" = light cargo
- Districts like "Çerkezköy" (Tekirdag), "Akhisar" (Manisa), "Kızıltepe" (Mardin) should map to their provinces.

Turkish province names should be normalized (e.g., "İstanbul" -> "Istanbul", "Muğla" -> "Mugla").
Phone numbers should be in format: 05XXXXXXXXX (11 digits).`;

let openaiClient: OpenAI | null = null;

/**
 * Get or create OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Parse a message using GPT-4o-mini with JSON mode
 */
export async function parseWithAI(message: string): Promise<ParsedMessage> {
  const result = createEmptyParsedMessage(message);

  if (!message || message.trim().length === 0) {
    result.warnings.push('Empty message');
    return result;
  }

  try {
    const client = getOpenAIClient();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      result.warnings.push('No response from AI');
      return result;
    }

    const aiResult: AIParseResult = JSON.parse(content);

    // Map AI result to ParsedMessage
    result.messageType = aiResult.messageType as MessageType;
    result.isUrgent = aiResult.isUrgent;

    // Map origin
    if (aiResult.origin?.province) {
      result.origin = mapLocationToProvince(
        aiResult.origin.province,
        aiResult.origin.district
      );
    }

    // Map destination
    if (aiResult.destination?.province) {
      result.destination = mapLocationToProvince(
        aiResult.destination.province,
        aiResult.destination.district
      );
    }

    // Map additional locations
    const allLocations: ParsedLocation[] = [];
    if (result.origin) allLocations.push(result.origin);
    if (result.destination) allLocations.push(result.destination);

    if (aiResult.additionalLocations) {
      for (const loc of aiResult.additionalLocations) {
        const mapped = mapLocationToProvince(loc.province, loc.district);
        if (mapped) {
          allLocations.push(mapped);
        }
      }
    }
    result.mentionedLocations = allLocations;

    // Map vehicle
    if (aiResult.vehicleType || aiResult.bodyType) {
      result.vehicle = {
        vehicleType: aiResult.vehicleType || null,
        bodyType: aiResult.bodyType || null,
        isRefrigerated: aiResult.isRefrigerated,
        originalText: [aiResult.vehicleType, aiResult.bodyType].filter(Boolean).join(' '),
      } as ParsedVehicle;
    }

    // Map phones
    result.phones = aiResult.phones.map((phone) => ({
      original: phone,
      normalized: normalizePhone(phone),
      isMasked: /[xX*]/.test(phone),
    })) as ParsedPhone[];

    // Map weight
    if (aiResult.weight) {
      result.weight = {
        value: aiResult.weight.value,
        unit: aiResult.weight.unit as 'ton' | 'kg',
        originalText: `${aiResult.weight.value} ${aiResult.weight.unit}`,
      };
    }

    // Map cargo type
    if (aiResult.cargoType) {
      result.cargoType = aiResult.cargoType;
    }

    // Map contact
    if (aiResult.contactName) {
      result.contact = {
        name: aiResult.contactName,
        originalText: aiResult.contactName,
      };
    }

    // Calculate confidence
    const confidence = calculateConfidence(result);
    result.confidenceScore = confidence.score;
    result.confidenceLevel = confidence.level;
    result.confidenceFactors = confidence.factors;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    result.warnings.push(`AI parsing failed: ${errorMessage}`);
  }

  return result;
}

/**
 * Map a province name to ParsedLocation
 */
function mapLocationToProvince(
  provinceName: string,
  districtName?: string
): ParsedLocation | undefined {
  const province = getProvinceByName(provinceName);
  if (province) {
    return {
      originalText: provinceName,
      provinceName: province.name,
      provinceCode: province.code,
      districtName,
      isDistrict: !!districtName,
      confidence: 1.0,
    };
  }

  // Try without Turkish characters
  const normalized = provinceName
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');

  const normalizedProvince = getProvinceByName(normalized);
  if (normalizedProvince) {
    return {
      originalText: provinceName,
      provinceName: normalizedProvince.name,
      provinceCode: normalizedProvince.code,
      districtName,
      isDistrict: !!districtName,
      confidence: 0.9,
    };
  }

  return undefined;
}

/**
 * Normalize phone number to 05XXXXXXXXX format
 */
function normalizePhone(phone: string): string {
  let digits = phone.replace(/[^\dxX*]/g, '');

  // Remove country code
  if (digits.startsWith('90') && digits.length >= 12) {
    digits = '0' + digits.slice(2);
  }

  // Add leading 0 if missing
  if (digits.startsWith('5') && !digits.startsWith('05')) {
    digits = '0' + digits;
  }

  return digits.toLowerCase();
}

/**
 * Check if AI parsing is available (API key is set)
 */
export function isAIParsingAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
