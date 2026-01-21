/**
 * Weight/tonnage extraction from Turkish logistics messages.
 */

import { normalizeToAscii, type ParsedWeight } from '@turkish-logistics/shared';

/**
 * Weight extraction patterns
 */
const WEIGHT_PATTERNS = [
  // "15 ton", "15 TON", "15 Ton"
  /(\d+(?:[.,]\d+)?)\s*(?:ton|TON|Ton)/gi,
  // "15 T", "15T"
  /(\d+(?:[.,]\d+)?)\s*T(?!\w)/gi,
  // "15 tonluk"
  /(\d+(?:[.,]\d+)?)\s*tonluk/gi,
  // "15 kg", "15 KG"
  /(\d+(?:[.,]\d+)?)\s*(?:kg|KG|Kg)/gi,
  // "15.000 kg" (Turkish number format with dots)
  /(\d{1,3}(?:\.\d{3})*)\s*(?:kg|KG)/gi,
];

/**
 * Extract weight information from text
 */
export function extractWeight(text: string): ParsedWeight | null {
  const normalizedText = text; // Keep original for number extraction

  for (const pattern of WEIGHT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(normalizedText);

    if (match) {
      let valueStr = match[1]!;

      // Handle Turkish number format (1.500 -> 1500)
      if (valueStr.includes('.') && !valueStr.includes(',')) {
        // Check if it's a thousand separator (e.g., 1.500)
        const parts = valueStr.split('.');
        if (parts.length > 1 && parts[parts.length - 1]!.length === 3) {
          valueStr = valueStr.replace(/\./g, '');
        }
      }

      // Convert comma to dot for decimal
      valueStr = valueStr.replace(',', '.');

      const value = parseFloat(valueStr);
      if (isNaN(value)) continue;

      // Determine unit from the matched text
      const matchedText = match[0].toLowerCase();
      let unit = 'ton';
      if (matchedText.includes('kg')) {
        unit = 'kg';
      }

      // Convert kg to tons if value is large
      let finalValue = value;
      let finalUnit = unit;
      if (unit === 'kg' && value >= 1000) {
        finalValue = value / 1000;
        finalUnit = 'ton';
      }

      return {
        value: finalValue,
        unit: finalUnit,
        originalText: match[0],
      };
    }
  }

  return null;
}
