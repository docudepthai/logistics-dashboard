/**
 * Load type extraction from Turkish logistics messages.
 * Detects FTL (Full Truck Load) vs LTL (Less Than Truck Load / Parsiyel)
 */

import { normalizeToAscii } from '@turkish-logistics/shared';

export type LoadType = 'FTL' | 'LTL';

export interface ParsedLoadType {
  loadType: LoadType;
  originalText: string;
  confidence: number;
}

/**
 * FTL (Full Truck Load / Tam Yük) patterns
 */
const FTL_PATTERNS = [
  /\bkomple\s*yuk\b/i,
  /\bkomple\b/i,
  /\btam\s*yuk\b/i,
  /\bfull\b/i,
  /\bdolu\s*yuk\b/i,
  /\bdolu\b/i,
];

/**
 * LTL (Less Than Truck Load / Parsiyel) patterns
 */
const LTL_PATTERNS = [
  /\bparsiyel\s*yuk\b/i,
  /\bparsiyel\b/i,
  /\bparti\s*yuk\b/i,
  /\bparti\b/i,
  /\bparca\s*yuk\b/i,
  /\bltl\b/i,
];

/**
 * Extract load type from message text
 */
export function extractLoadType(text: string): ParsedLoadType | null {
  const normalized = normalizeToAscii(text);

  // Check LTL patterns first (more specific)
  for (const pattern of LTL_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        loadType: 'LTL',
        originalText: match[0],
        confidence: pattern.source.includes('\\s') ? 1.0 : 0.9, // Higher confidence for multi-word matches
      };
    }
  }

  // Check FTL patterns
  for (const pattern of FTL_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      return {
        loadType: 'FTL',
        originalText: match[0],
        confidence: pattern.source.includes('\\s') ? 1.0 : 0.9,
      };
    }
  }

  return null;
}
