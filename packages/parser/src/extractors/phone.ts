/**
 * Phone number extraction from Turkish logistics messages.
 * Re-exports from shared utils with additional context.
 */

import {
  extractPhoneNumbers as extractPhones,
  type PhoneMatch,
  type ParsedPhone,
} from '@turkish-logistics/shared';

/**
 * Extract phone numbers from text and convert to ParsedPhone format
 */
export function extractPhoneNumbers(text: string): ParsedPhone[] {
  const matches = extractPhones(text);

  return matches.map((match: PhoneMatch) => ({
    original: match.original,
    normalized: match.normalized,
    isMasked: match.isMasked,
  }));
}

/**
 * Extract the primary (first) phone number
 */
export function extractPrimaryPhone(text: string): ParsedPhone | undefined {
  const phones = extractPhoneNumbers(text);
  return phones[0];
}
