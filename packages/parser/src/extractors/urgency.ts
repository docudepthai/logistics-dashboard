/**
 * Urgency indicator extraction from Turkish logistics messages.
 */

import { normalizeToAscii } from '@turkish-logistics/shared';

/**
 * Urgency indicator patterns
 */
const URGENCY_PATTERNS = [
  // High urgency
  { pattern: 'acil', weight: 1.0 },
  { pattern: 'acele', weight: 0.9 },
  { pattern: 'hemen', weight: 0.9 },
  { pattern: 'simdiki', weight: 0.8 },
  { pattern: 'şimdiki', weight: 0.8 },
  { pattern: 'bugun', weight: 0.8 },
  { pattern: 'bugün', weight: 0.8 },
  { pattern: 'yarin', weight: 0.6 },
  { pattern: 'yarın', weight: 0.6 },
  { pattern: 'asap', weight: 1.0 },
  { pattern: 'ivedi', weight: 0.9 },
  { pattern: 'срочно', weight: 1.0 }, // Russian "urgent" (sometimes used)

  // Emphasis patterns
  { pattern: '!!!', weight: 0.7 },
  { pattern: 'cok acil', weight: 1.0 },
  { pattern: 'çok acil', weight: 1.0 },
];

/**
 * Extract urgency information from text
 */
export function extractUrgency(text: string): {
  isUrgent: boolean;
  indicators: string[];
  urgencyScore: number;
} {
  const normalizedText = normalizeToAscii(text).toLowerCase();
  const indicators: string[] = [];
  let maxScore = 0;

  for (const { pattern, weight } of URGENCY_PATTERNS) {
    const normalizedPattern = normalizeToAscii(pattern).toLowerCase();
    if (normalizedText.includes(normalizedPattern)) {
      indicators.push(pattern);
      maxScore = Math.max(maxScore, weight);
    }
  }

  return {
    isUrgent: indicators.length > 0,
    indicators,
    urgencyScore: maxScore,
  };
}
