/**
 * Atlas-1 Model Client
 * HTTP client for calling Atlas parse_intent endpoint
 */

import { Intent } from './intents.js';
import { PROVINCES, getProvinceByName } from '@turkish-logistics/shared/constants';
import { normalizeToAscii } from '@turkish-logistics/shared/utils';

const ATLAS_URL = 'https://wpaggregatorbotacs--atlas-logistics-atlasmodel-parse-intent.modal.run';
const ATLAS_TIMEOUT = 30000; // 30 seconds for cold starts

// Build province lookup patterns with Turkish suffixes
const PROVINCE_PATTERNS = buildProvincePatterns();

export interface AtlasResponse {
  success: boolean;
  intent: Intent;
  origin: string | null;
  destination: string | null;
  vehicle_type: string | null;
  cargo_type: string | null;
  raw_response?: string;
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Call Atlas to parse user intent and extract locations
 */
export async function parseIntent(
  message: string,
  history?: ConversationMessage[]
): Promise<AtlasResponse> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ATLAS_TIMEOUT);

    const response = await fetch(ATLAS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history: history || [],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Atlas] HTTP error: ${response.status}`);
      return fallbackResponse(message);
    }

    const data = await response.json() as {
      success?: boolean;
      intent?: string;
      origin?: string | null;
      destination?: string | null;
      vehicle_type?: string | null;
      cargo_type?: string | null;
      raw_response?: string;
      error?: string;
    };

    if (data.error) {
      console.error(`[Atlas] API error: ${data.error}`);
      return fallbackResponse(message);
    }

    console.log(`[Atlas] Parsed: intent=${data.intent}, origin=${data.origin}, dest=${data.destination}`);

    return {
      success: data.success ?? true,
      intent: (data.intent || 'other') as Intent,
      origin: data.origin || null,
      destination: data.destination || null,
      vehicle_type: data.vehicle_type || null,
      cargo_type: data.cargo_type || null,
      raw_response: data.raw_response,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Atlas] Request timed out');
    } else {
      console.error('[Atlas] Request failed:', error);
    }
    return fallbackResponse(message);
  }
}

/**
 * Build province patterns for regex matching with Turkish suffixes
 */
function buildProvincePatterns(): Map<string, { name: string; normalized: string }> {
  const patterns = new Map<string, { name: string; normalized: string }>();

  for (const province of PROVINCES) {
    // Add base name
    patterns.set(province.normalized, { name: province.name, normalized: province.normalized });

    // Add aliases
    for (const alias of province.aliases) {
      patterns.set(alias.toLowerCase(), { name: province.name, normalized: province.normalized });
    }
  }

  return patterns;
}

/**
 * Extract locations from message using pattern matching
 * Handles Turkish suffixes like -dan/-den (from), -a/-e/-ya/-ye (to), -dayim/-deyim (I'm at)
 */
function extractLocationsFromMessage(message: string): { origin: string | null; destination: string | null } {
  const normalized = normalizeToAscii(message.toLowerCase());
  const words = normalized.split(/[\s,.']+/);

  let origin: string | null = null;
  let destination: string | null = null;

  // Origin suffixes: -dan, -den, -tan, -ten (from), -dayim, -deyim, -dayım, -da, -de (I'm at)
  const originSuffixes = ['dan', 'den', 'tan', 'ten', 'dayim', 'deyim', 'dayim', 'da', 'de'];

  // Destination suffixes: -a, -e, -ya, -ye (to)
  const destSuffixes = ['a', 'e', 'ya', 'ye'];

  for (const word of words) {
    if (!word || word.length < 3) continue;

    // Check for origin suffixes (longer suffixes first)
    for (const suffix of originSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        const base = word.slice(0, -suffix.length);
        const province = findProvince(base);
        if (province && !origin) {
          origin = province.normalized;
          break;
        }
      }
    }

    // Check for destination suffixes
    for (const suffix of destSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        const base = word.slice(0, -suffix.length);
        const province = findProvince(base);
        if (province && !destination) {
          destination = province.normalized;
          break;
        }
      }
    }

    // Check for bare province names (no suffix)
    const province = findProvince(word);
    if (province) {
      // If we don't have origin yet, this is origin
      // If we have origin but not destination, this is destination
      if (!origin) {
        origin = province.normalized;
      } else if (!destination && province.normalized !== origin) {
        destination = province.normalized;
      }
    }
  }

  return { origin, destination };
}

/**
 * Find province by name or partial match
 */
function findProvince(name: string): { name: string; normalized: string } | null {
  // Direct lookup
  const direct = PROVINCE_PATTERNS.get(name);
  if (direct) return direct;

  // Try without common suffixes that might still be attached
  const cleaned = name
    .replace(/[yi]$/, '')  // Remove trailing y/i (vowel harmony leftovers)
    .replace(/['']$/, ''); // Remove apostrophe

  const cleaned2 = PROVINCE_PATTERNS.get(cleaned);
  if (cleaned2) return cleaned2;

  // Partial match for longer names
  for (const [pattern, province] of PROVINCE_PATTERNS.entries()) {
    if (pattern.startsWith(name) && name.length >= 4) {
      return province;
    }
    if (name.startsWith(pattern) && pattern.length >= 4) {
      return province;
    }
  }

  return null;
}

/**
 * Fallback keyword-based intent detection when Atlas is unavailable
 * Now includes proper location extraction!
 */
function fallbackResponse(message: string): AtlasResponse {
  const msg = message.toLowerCase().trim();

  // Simple keyword matching as fallback
  let intent: Intent = 'other';

  // Greetings
  if (/^(merhaba|selam|sa|slm|mrb|hey|hi|günaydın|iyi akşamlar)$/i.test(msg)) {
    intent = 'greeting';
  }
  // Thanks
  else if (/^(teşekkür|sağol|eyvallah|tşk|thanks)/.test(msg)) {
    intent = 'thanks';
  }
  // Goodbye
  else if (/^(görüşürüz|bye|bb|hoşçakal)/.test(msg)) {
    intent = 'goodbye';
  }
  // Pagination
  else if (/^(devam|daha|sonraki|fazla)/.test(msg)) {
    intent = 'pagination';
  }
  // Bot identity
  else if (/sen (kimsin|nesin|bot|robot|insan|gerçek)/i.test(msg)) {
    intent = 'bot_identity';
  }
  // Help
  else if (/^(yardım|help|nasıl kullan)/i.test(msg)) {
    intent = 'help';
  }
  // Pricing
  else if (/(ücret|fiyat|kaç para|bedava|ücretsiz)/i.test(msg)) {
    intent = 'pricing';
  }
  // Vehicle info - user mentions having a vehicle
  else if (/(bende|benim|var).*(tır|kamyon|doblo|van|minibüs|kamyonet|frigorifik|dorse)/i.test(msg) ||
           /(tır|kamyon|doblo|van|minibüs|kamyonet|frigorifik).*(var|bende|benim)/i.test(msg)) {
    intent = 'vehicle_info';
  }
  // Check for locations -> search intent
  else {
    const { origin, destination } = extractLocationsFromMessage(message);
    if (origin || destination) {
      intent = 'search';
      console.log(`[Atlas] Fallback parsed locations: origin=${origin}, dest=${destination}`);
      return {
        success: false, // Still fallback
        intent,
        origin,
        destination,
        vehicle_type: null,
        cargo_type: null,
      };
    }
    // Don't assume short messages are searches - this caused false positives
    // Only mark as search if we found actual locations above
  }

  console.log(`[Atlas] Fallback: intent=${intent}`);

  return {
    success: false,
    intent,
    origin: null,
    destination: null,
    vehicle_type: null,
    cargo_type: null,
  };
}

/**
 * Check if Atlas is available (for health checks)
 */
export async function isAtlasAvailable(): Promise<boolean> {
  try {
    const response = await fetch(ATLAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
