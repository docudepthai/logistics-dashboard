/**
 * Turkish phone number parsing utilities.
 */

/**
 * Regex patterns for Turkish mobile phone numbers
 */
const PHONE_PATTERNS = [
  // Full format with country code: +90 5XX XXX XX XX
  /\+90\s*5\d{2}[\s\-\.]*\d{3}[\s\-\.]*\d{2}[\s\-\.]*\d{2}/g,
  // Standard format: 05XX XXX XX XX
  /05\d{2}[\s\-\.]*\d{3}[\s\-\.]*\d{2}[\s\-\.]*\d{2}/g,
  // Without leading 0: 5XX XXX XX XX
  /(?<!\d)5\d{2}[\s\-\.]*\d{3}[\s\-\.]*\d{2}[\s\-\.]*\d{2}/g,
  // Continuous digits: 05XXXXXXXXX
  /05\d{9}/g,
  // Continuous without leading 0: 5XXXXXXXXX
  /(?<!\d)5\d{9}/g,
  // With X placeholders (masked): 05XX XXX XX XX
  /05[xX\d]{2}[\s\-\.]*[xX\d]{3}[\s\-\.]*[xX\d]{2}[\s\-\.]*[xX\d]{2}/g,
];

export interface PhoneMatch {
  /** Original text as found in message */
  original: string;
  /** Normalized format: 05XXXXXXXXX */
  normalized: string;
  /** Start position in text */
  start: number;
  /** End position in text */
  end: number;
  /** Is this a mobile number (starts with 5) */
  isMobile: boolean;
  /** Contains masked digits (X) */
  isMasked: boolean;
}

/**
 * Extract all phone numbers from text.
 */
export function extractPhoneNumbers(text: string): PhoneMatch[] {
  const matches: PhoneMatch[] = [];
  const foundPositions = new Set<string>();

  for (const pattern of PHONE_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const posKey = `${match.index}-${match.index + match[0].length}`;

      // Skip if overlapping with already found
      let overlaps = false;
      for (const found of foundPositions) {
        const [start, end] = found.split('-').map(Number);
        if (
          (match.index >= start! && match.index < end!) ||
          (match.index + match[0].length > start! &&
            match.index + match[0].length <= end!)
        ) {
          overlaps = true;
          break;
        }
      }

      if (!overlaps) {
        const original = match[0];
        const normalized = normalizePhoneNumber(original);
        const isMasked = /[xX]/.test(original);

        matches.push({
          original,
          normalized,
          start: match.index,
          end: match.index + match[0].length,
          isMobile: normalized.startsWith('05') || normalized.startsWith('5'),
          isMasked,
        });

        foundPositions.add(posKey);
      }
    }
  }

  // Sort by position
  return matches.sort((a, b) => a.start - b.start);
}

/**
 * Normalize a phone number to standard format.
 * Returns format: 05XXXXXXXXX (or with X for masked digits)
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except x/X
  let digits = phone.replace(/[^\dxX]/g, '');

  // Remove country code if present
  if (digits.startsWith('90') && digits.length >= 12) {
    digits = '0' + digits.slice(2);
  }

  // Add leading 0 if missing
  if (digits.startsWith('5') && !digits.startsWith('05')) {
    digits = '0' + digits;
  }

  return digits.toLowerCase(); // Normalize X to x
}

/**
 * Format a phone number for display.
 * Returns format: 0XXX XXX XX XX
 */
export function formatPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length !== 11) {
    return normalized;
  }

  return `${normalized.slice(0, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7, 9)} ${normalized.slice(9, 11)}`;
}

/**
 * Validate if a string is a valid Turkish mobile phone number.
 */
export function isValidTurkishMobile(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Must be 11 digits starting with 05
  if (normalized.length !== 11) return false;
  if (!normalized.startsWith('05')) return false;
  // Check for valid operator prefixes (50, 51, 52, 53, 54, 55, 56, 57, 58, 59)
  const operatorPrefix = normalized.slice(2, 4);
  return operatorPrefix >= '00' && operatorPrefix <= '99';
}

/**
 * Mask a phone number for non-paying users.
 * Format: 05XX XXX XXXX (show only '05', mask the rest)
 */
export function maskPhoneNumber(phone: string): string {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length !== 11) {
    return 'XXXX XXX XXXX';
  }
  // Show only "05", mask the rest: 05XX XXX XXXX
  return '05XX XXX XXXX';
}

/**
 * Mask all phone numbers in a text string.
 * Replaces detected phone numbers with masked versions.
 */
export function maskPhoneNumbersInText(text: string): string {
  const matches = extractPhoneNumbers(text);
  if (matches.length === 0) {
    return text;
  }

  // Sort descending by position to replace from end (preserves positions)
  const sorted = [...matches].sort((a, b) => b.start - a.start);
  let result = text;
  for (const match of sorted) {
    const masked = maskPhoneNumber(match.original);
    result = result.slice(0, match.start) + masked + result.slice(match.end);
  }
  return result;
}
