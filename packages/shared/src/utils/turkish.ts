/**
 * Turkish text normalization utilities.
 * Handles Turkish special characters and case suffix stripping.
 */

/**
 * Turkish special characters to ASCII mapping
 */
const TURKISH_TO_ASCII: Record<string, string> = {
  // Lowercase
  'ç': 'c',
  'ğ': 'g',
  'ı': 'i',
  'i': 'i',
  'ö': 'o',
  'ş': 's',
  'ü': 'u',
  // Uppercase
  'Ç': 'c',
  'Ğ': 'g',
  'I': 'i', // Turkish dotless I -> i
  'İ': 'i', // Turkish dotted I -> i
  'Ö': 'o',
  'Ş': 's',
  'Ü': 'u',
};

/**
 * Turkish locative/ablative suffixes (from)
 */
const ORIGIN_SUFFIXES = ['dan', 'den', 'tan', 'ten', 'ndan', 'nden'];

/**
 * Turkish dative suffixes (to)
 */
const DESTINATION_SUFFIXES = ['a', 'e', 'ya', 'ye', 'na', 'ne'];

/**
 * All Turkish case suffixes
 */
const ALL_SUFFIXES = [...ORIGIN_SUFFIXES, ...DESTINATION_SUFFIXES];

/**
 * Convert Turkish special characters to ASCII equivalents.
 *
 * @example
 * normalizeToAscii("İstanbul") // "istanbul"
 * normalizeToAscii("Şırnak") // "sirnak"
 */
export function normalizeToAscii(text: string): string {
  let result = '';
  for (const char of text) {
    result += TURKISH_TO_ASCII[char] ?? char;
  }
  return result.toLowerCase();
}

/**
 * Strip Turkish case suffixes from a word.
 * Returns the stem and the removed suffix.
 *
 * @example
 * stripSuffix("antalyadan") // { stem: "antalya", suffix: "dan", isOrigin: true }
 * stripSuffix("istanbula") // { stem: "istanbul", suffix: "a", isOrigin: false }
 * stripSuffix("ankara") // { stem: "ankara", suffix: "", isOrigin: false }
 */
export function stripSuffix(word: string): {
  stem: string;
  suffix: string;
  isOrigin: boolean;
  isDestination: boolean;
} {
  // Remove apostrophes before processing (konak'tan -> konaktan)
  const lower = word.toLowerCase().replace(/[''`']/g, '');

  // Try origin suffixes first (longer ones first)
  for (const suffix of ORIGIN_SUFFIXES.sort((a, b) => b.length - a.length)) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
      return {
        stem: lower.slice(0, -suffix.length),
        suffix,
        isOrigin: true,
        isDestination: false,
      };
    }
  }

  // Try destination suffixes (longer ones first)
  for (const suffix of DESTINATION_SUFFIXES.sort((a, b) => b.length - a.length)) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
      return {
        stem: lower.slice(0, -suffix.length),
        suffix,
        isOrigin: false,
        isDestination: true,
      };
    }
  }

  return {
    stem: lower,
    suffix: '',
    isOrigin: false,
    isDestination: false,
  };
}

/**
 * Full normalization pipeline for location names.
 * 1. Convert Turkish chars to ASCII
 * 2. Strip case suffixes
 * 3. Lowercase
 *
 * @example
 * normalizeLocationName("İstanbul'dan") // "istanbul"
 * normalizeLocationName("ANTALYAYA") // "antalya"
 */
export function normalizeLocationName(text: string): string {
  // Step 1: Turkish char normalization
  const normalized = normalizeToAscii(text);

  // Step 2: Strip suffixes
  const { stem } = stripSuffix(normalized);

  // Step 3: Clean up (remove quotes, extra spaces)
  return stem.replace(/['"]/g, '').trim();
}

/**
 * Check if a word ends with an origin suffix
 */
export function hasOriginSuffix(word: string): boolean {
  const lower = normalizeToAscii(word);
  return ORIGIN_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Check if a word ends with a destination suffix
 */
export function hasDestinationSuffix(word: string): boolean {
  const lower = normalizeToAscii(word);
  return DESTINATION_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

/**
 * Extract direction indicators from text.
 * Returns words that appear to indicate origin or destination.
 */
export function extractDirectionIndicators(text: string): {
  originWords: string[];
  destinationWords: string[];
} {
  const words = text.split(/\s+/);
  const originWords: string[] = [];
  const destinationWords: string[] = [];

  for (const word of words) {
    if (hasOriginSuffix(word)) {
      originWords.push(word);
    } else if (hasDestinationSuffix(word)) {
      destinationWords.push(word);
    }
  }

  return { originWords, destinationWords };
}
