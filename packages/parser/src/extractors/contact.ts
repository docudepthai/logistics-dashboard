/**
 * Contact name extraction from Turkish logistics messages.
 */

import { normalizeToAscii, type ParsedContact } from '@turkish-logistics/shared';

/**
 * Common Turkish titles/honorifics
 */
const TITLES = ['bey', 'hanim', 'hanım', 'abi', 'abla', 'hoca', 'usta'];

/**
 * Patterns to extract contact names
 */
const CONTACT_PATTERNS = [
  // "Ahmet bey", "Mehmet Bey"
  /([A-ZÇĞİÖŞÜa-zçğıöşü]+)\s+(bey|hanim|hanım|abi|abla)/gi,
  // "bey Ahmet" (less common but possible)
  /(bey|hanim|hanım)\s+([A-ZÇĞİÖŞÜa-zçğıöşü]+)/gi,
  // Name right before phone number: "Ahmet 0532..."
  /([A-ZÇĞİÖŞÜa-zçğıöşü]+)\s+(?:0?5\d{2})/gi,
];

/**
 * Common Turkish first names (expanded list for better matching)
 */
const COMMON_NAMES = new Set([
  'ahmet', 'mehmet', 'mustafa', 'ali', 'hasan', 'huseyin', 'ibrahim',
  'ismail', 'osman', 'yusuf', 'murat', 'hakan', 'serkan', 'burak',
  'emre', 'can', 'cem', 'kemal', 'selim', 'fatih', 'kadir', 'adem',
  'omer', 'recep', 'suleyman', 'yasin', 'erkan', 'gokhan', 'volkan',
  'ayse', 'fatma', 'emine', 'hatice', 'zeynep', 'elif', 'merve',
  'esra', 'seda', 'aysel', 'sevgi', 'hulya', 'serap', 'nilay',
  'deniz', 'umut', 'onur', 'baris', 'caner', 'enes', 'furkan',
]);

/**
 * Extract contact information from text
 */
export function extractContact(text: string): ParsedContact | null {
  for (const pattern of CONTACT_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);

    if (match) {
      let name: string;
      let title: string | undefined;

      // Determine which group is name and which is title
      const group1 = match[1]!.toLowerCase();
      const group2 = match[2]?.toLowerCase();

      if (TITLES.includes(group1)) {
        title = group1;
        name = match[2] || '';
      } else if (group2 && TITLES.includes(group2)) {
        name = match[1]!;
        title = group2;
      } else {
        name = match[1]!;
      }

      // Validate the name
      const normalizedName = normalizeToAscii(name).toLowerCase();
      if (normalizedName.length < 2) continue;

      // Check if it's a common name or looks like a name (starts with capital)
      const isLikelyName =
        COMMON_NAMES.has(normalizedName) ||
        /^[A-ZÇĞİÖŞÜ]/.test(name);

      if (isLikelyName) {
        return {
          name: capitalizeFirst(name),
          title,
          originalText: match[0],
        };
      }
    }
  }

  return null;
}

/**
 * Capitalize first letter of a name
 */
function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
