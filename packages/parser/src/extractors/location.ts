/**
 * Location extraction from Turkish logistics messages.
 * Handles provinces, districts, and route detection.
 */

import {
  normalizeToAscii,
  stripSuffix,
  getProvinceByName,
  getProvinceByCode,
  getDistrictsByName,
  type ParsedLocation,
  type PossibleProvince,
} from '@turkish-logistics/shared';

/**
 * Common Turkish words that happen to match district names - should be ignored
 */
const COMMON_WORDS_TO_SKIP = new Set([
  'arac',    // "araç" = vehicle, matches Araç district in Kastamonu
  'alan',    // "alan" = field/area, matches Alan district
  'bey',     // common word/title
  'ova',     // "ova" = plain, too generic
]);

/**
 * Check if a number token looks like a plate code based on context
 * Returns false for times (HH:MM), measurements (58 km), etc.
 */
function looksLikePlateCode(token: string, originalText: string): boolean {
  // Find the token in original text with surrounding context
  const normalizedText = normalizeToAscii(originalText).toLowerCase();

  // Need to find exact matches - the token might appear multiple times
  // Look for the token as a standalone number (with boundaries)
  const tokenRegex = new RegExp(`(^|[^0-9])${token}([^0-9]|$)`);
  const match = tokenRegex.exec(normalizedText);

  if (!match) return true; // Can't find context, allow it

  const tokenIndex = match.index + (match[1]?.length || 0);

  // Get surrounding text (15 chars before and after)
  const start = Math.max(0, tokenIndex - 15);
  const end = Math.min(normalizedText.length, tokenIndex + token.length + 15);
  const context = normalizedText.slice(start, end);

  // Skip if it looks like a time (e.g., "20:00", "12:00", "08:30")
  // Match: token followed by colon and digits, or digits and colon before token
  const timePattern = new RegExp(`${token}:\\d{2}|\\d{1,2}:${token}`);
  if (timePattern.test(context)) {
    return false;
  }

  // Skip if followed by measurement units (km, m, ton, kg, etc.)
  const measurementPattern = new RegExp(`${token}\\s*(km|m|ton|kg|lt|saat|dakika|gun|arac|tir)`);
  if (measurementPattern.test(context)) {
    return false;
  }

  // Skip if it looks like a price or currency
  const currencyPattern = new RegExp(`${token}\\s*(tl|lira|euro|dolar|\\$|€)`);
  if (currencyPattern.test(context)) {
    return false;
  }

  // Skip if preceded by "saat" (hour) - e.g., "saat 20"
  const hourPattern = new RegExp(`saat\\s*${token}`);
  if (hourPattern.test(context)) {
    return false;
  }

  // Skip if it's in a range pattern like "20:00 - 12:00" or "20-12"
  const rangePattern = new RegExp(`${token}\\s*[-–—]\\s*\\d|\\d\\s*[-–—]\\s*${token}`);
  if (rangePattern.test(context)) {
    return false;
  }

  return true;
}

/**
 * Route patterns to detect origin -> destination
 */
const ROUTE_PATTERNS = [
  // "ANTALYA - ISTANBUL" or "ANTALYA — ISTANBUL"
  /(\S+)\s*[-–—]\s*(\S+)/g,
  // "Mersin >> Ankara" or "Mersin > Ankara"
  /(\S+)\s*>+\s*(\S+)/g,
  // "antalyadan izmire" or "istanbul'dan ankara'ya"
  /(\S+)[''']?dan\s+(\S+)[''']?[ayeı]a?/gi,
  /(\S+)[''']?den\s+(\S+)[''']?[eyeı]e?/gi,
  /(\S+)[''']?tan\s+(\S+)[''']?[ayeı]a?/gi,
  /(\S+)[''']?ten\s+(\S+)[''']?[eyeı]e?/gi,
];

/**
 * Extract all locations from text
 */
export function extractLocations(text: string): ParsedLocation[] {
  const locations: ParsedLocation[] = [];
  const foundNormalized = new Set<string>();

  // Normalize the text for matching
  const normalizedText = normalizeToAscii(text);

  // Try route patterns first
  for (const pattern of ROUTE_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      for (let i = 1; i <= 2; i++) {
        const part = match[i];
        if (part) {
          const location = matchLocation(part, text);
          if (location && !foundNormalized.has(location.provinceName)) {
            locations.push(location);
            foundNormalized.add(location.provinceName);
          }
        }
      }
    }
  }

  // Token-by-token matching (include / + and apostrophes as separators)
  const tokens = normalizedText.split(/[\s,;:\-\>\<\(\)\[\]\/\+\.''`']+/);

  for (const token of tokens) {
    if (token.length < 2) continue;

    const location = matchLocation(token, text);
    if (location && !foundNormalized.has(location.provinceName)) {
      locations.push(location);
      foundNormalized.add(location.provinceName);
    }
  }

  return locations;
}

/**
 * Try to match a token to a known location
 */
function matchLocation(token: string, originalText: string): ParsedLocation | null {
  // First, normalize without stripping suffix
  const normalized = normalizeToAscii(token).toLowerCase();

  // Skip common words that aren't locations
  if (COMMON_WORDS_TO_SKIP.has(normalized)) {
    return null;
  }

  // Try province match first (with full name)
  const province = getProvinceByName(normalized);
  if (province) {
    return {
      originalText: findOriginalText(token, originalText),
      provinceName: province.name,
      provinceCode: province.code,
      isDistrict: false,
      confidence: 1.0,
    };
  }

  // Try district match
  const districts = getDistrictsByName(normalized);
  if (districts.length > 0) {
    const [firstDistrict] = districts;
    const isAmbiguous = districts.length > 1;

    // Build possible provinces list for ambiguous districts
    const possibleProvinces: PossibleProvince[] | undefined = isAmbiguous
      ? districts.map(d => ({ provinceName: d.provinceName, provinceCode: d.provinceCode }))
      : undefined;

    return {
      originalText: findOriginalText(token, originalText),
      provinceName: firstDistrict!.provinceName,
      provinceCode: firstDistrict!.provinceCode,
      districtName: firstDistrict!.name,
      isDistrict: true,
      confidence: isAmbiguous ? 0.7 : 0.9, // Lower confidence for ambiguous districts
      isAmbiguous,
      possibleProvinces,
    };
  }

  // Try with suffix stripped
  const { stem } = stripSuffix(normalized);
  if (stem !== normalized) {
    const provinceFromStem = getProvinceByName(stem);
    if (provinceFromStem) {
      return {
        originalText: findOriginalText(token, originalText),
        provinceName: provinceFromStem.name,
        provinceCode: provinceFromStem.code,
        isDistrict: false,
        confidence: 0.95,
      };
    }

    const districtsFromStem = getDistrictsByName(stem);
    if (districtsFromStem.length > 0) {
      const [firstDistrict] = districtsFromStem;
      const isAmbiguous = districtsFromStem.length > 1;

      const possibleProvinces: PossibleProvince[] | undefined = isAmbiguous
        ? districtsFromStem.map(d => ({ provinceName: d.provinceName, provinceCode: d.provinceCode }))
        : undefined;

      return {
        originalText: findOriginalText(token, originalText),
        provinceName: firstDistrict!.provinceName,
        provinceCode: firstDistrict!.provinceCode,
        districtName: firstDistrict!.name,
        isDistrict: true,
        confidence: isAmbiguous ? 0.6 : 0.85, // Lower confidence for ambiguous + suffix stripped
        isAmbiguous,
        possibleProvinces,
      };
    }
  }

  // Try plate code match (e.g., "34" for Istanbul)
  // Only if the number looks like a real plate code (not a time, measurement, etc.)
  const plateCode = parseInt(normalized, 10);
  if (!isNaN(plateCode) && plateCode >= 1 && plateCode <= 81) {
    // Check context to avoid false positives like "20:00" or "58 km"
    if (looksLikePlateCode(token, originalText)) {
      const provinceByCode = getProvinceByCode(plateCode);
      if (provinceByCode) {
        return {
          originalText: token,
          provinceName: provinceByCode.name,
          provinceCode: provinceByCode.code,
          isDistrict: false,
          confidence: 0.8,
        };
      }
    }
  }

  return null;
}

/**
 * Find the original text in the source message
 */
function findOriginalText(normalizedToken: string, originalText: string): string {
  // Try to find a case-insensitive match in the original text
  const regex = new RegExp(escapeRegex(normalizedToken), 'i');
  const match = originalText.match(regex);
  return match ? match[0] : normalizedToken;
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Resolve a location name to its province (checking both provinces and districts)
 */
function resolveLocation(name: string): { provinceName: string; provinceCode: number } | null {
  // Skip common words that aren't locations
  if (COMMON_WORDS_TO_SKIP.has(name)) {
    return null;
  }

  // Try province match first
  const province = getProvinceByName(name);
  if (province) {
    return { provinceName: province.name, provinceCode: province.code };
  }

  // Try district match
  const districts = getDistrictsByName(name);
  if (districts.length > 0) {
    // Use the first matching district's province
    const district = districts[0];
    return { provinceName: district!.provinceName, provinceCode: district!.provinceCode };
  }

  // Try with suffix stripped
  const { stem } = stripSuffix(name);
  if (stem !== name) {
    const provinceFromStem = getProvinceByName(stem);
    if (provinceFromStem) {
      return { provinceName: provinceFromStem.name, provinceCode: provinceFromStem.code };
    }

    const districtsFromStem = getDistrictsByName(stem);
    if (districtsFromStem.length > 0) {
      const district = districtsFromStem[0];
      return { provinceName: district!.provinceName, provinceCode: district!.provinceCode };
    }
  }

  return null;
}

/**
 * Route information extracted from text
 */
export interface ExtractedRoute {
  origin: string;
  destination: string;
  originCode?: number;
  destinationCode?: number;
  vehicle?: string;
  bodyType?: string;
}

/**
 * Extract ALL routes from a multi-route message.
 * Handles messages like:
 * "KAYSERI >>>> ISTANBUL TIR
 *  KAYSERI >>>> IZMIR DAMPERLI TIR
 *  KAYSERI >>>> ANKARA TIR"
 */
export function extractAllRoutes(text: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  const seenRoutes = new Set<string>();

  // Normalize text
  const normalizedText = normalizeToAscii(text);

  // Patterns for route extraction (origin >>> destination)
  const routePatterns = [
    // "KAYSERI >>>> ISTANBUL" or "KAYSERI >> IZMIR" with optional vehicle info
    /([A-Z\u00C0-\u017F]+)\s*>+\s*([A-Z\u00C0-\u017F]+)(?:\s+(TIR|KAMYON|KAMYONET|TIRLA|10\s*TEKER|8\s*TEKER|6\s*TEKER))?(?:\s+(DAMPERI?L[I\u0130]|TENTELI|KAPALI|ACIK|FR[I\u0130]GO))?/gi,
    // "ANTALYA - ISTANBUL" with optional vehicle info
    /([A-Z\u00C0-\u017F]+)\s*[-–—]\s*([A-Z\u00C0-\u017F]+)(?:\s+(TIR|KAMYON|KAMYONET))?/gi,
    // "antalyadan istanbul'a" Turkish suffix format
    /([A-Z\u00C0-\u017F]+)[''']?(?:DAN|DEN|TAN|TEN)\s+([A-Z\u00C0-\u017F]+)[''']?(?:YA|YE|A|E)/gi,
    // Emoji arrows: "Istanbul ➡️ Ankara" or "Istanbul → Ankara"
    /([A-Z\u00C0-\u017F]+)\s*[➡️→⇒⮕]+\s*([A-Z\u00C0-\u017F]+)(?:\s+(TIR|KAMYON|KAMYONET))?(?:\s+(DAMPERI?L[I\u0130]|TENTELI|DAMPER))?/gi,
  ];

  for (const pattern of routePatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(normalizedText)) !== null) {
      const originPart = match[1];
      const destPart = match[2];
      const vehiclePart = match[3];
      const bodyPart = match[4];

      // Skip if origin or destination parts are missing
      if (!originPart || !destPart) continue;

      // Try to match origin and destination to provinces or districts
      const originLoc = resolveLocation(originPart.toLowerCase());
      const destLoc = resolveLocation(destPart.toLowerCase());

      // Only add if both are valid locations and not the same province
      if (originLoc && destLoc && originLoc.provinceName !== destLoc.provinceName) {
        const routeKey = `${originLoc.provinceName}-${destLoc.provinceName}`;

        if (!seenRoutes.has(routeKey)) {
          seenRoutes.add(routeKey);

          const route: ExtractedRoute = {
            origin: originLoc.provinceName,
            destination: destLoc.provinceName,
            originCode: originLoc.provinceCode,
            destinationCode: destLoc.provinceCode,
          };

          // Add vehicle info if present
          if (vehiclePart) {
            const vehicleUpper = vehiclePart.toUpperCase();
            if (vehicleUpper.includes('TIR') || vehicleUpper.includes('TIRLA')) {
              route.vehicle = 'TIR';
            } else if (vehicleUpper.includes('KAMYONET')) {
              route.vehicle = 'KAMYONET';
            } else if (vehicleUpper.includes('KAMYON')) {
              route.vehicle = 'KAMYON';
            } else if (vehicleUpper.includes('TEKER')) {
              route.vehicle = vehicleUpper;
            }
          }

          // Add body type if present
          if (bodyPart) {
            const bodyUpper = bodyPart.toUpperCase();
            if (bodyUpper.includes('DAMPER')) {
              route.bodyType = 'DAMPERLI';
            } else if (bodyUpper.includes('TENTE')) {
              route.bodyType = 'TENTELI';
            } else if (bodyUpper.includes('KAPALI')) {
              route.bodyType = 'KAPALI';
            } else if (bodyUpper.includes('ACIK')) {
              route.bodyType = 'ACIK';
            } else if (bodyUpper.includes('FRIGO') || bodyUpper.includes('FRI')) {
              route.bodyType = 'FRIGO';
            }
          }

          routes.push(route);
        }
      }
    }
  }

  return routes;
}

/**
 * Determine origin and destination from a list of locations
 */
export function determineOriginDestination(
  locations: ParsedLocation[],
  originalText: string
): { origin?: ParsedLocation; destination?: ParsedLocation } {
  if (locations.length === 0) {
    return {};
  }

  if (locations.length === 1) {
    // Check suffix to determine if origin or destination
    const normalizedText = normalizeToAscii(originalText);
    const { isOrigin, isDestination } = stripSuffix(normalizedText);

    if (isDestination) {
      return { destination: locations[0] };
    }
    return { origin: locations[0] };
  }

  // Multiple locations - try to determine from context
  let origin: ParsedLocation | undefined;
  let destination: ParsedLocation | undefined;

  // Check each location's suffix in original text
  // Only count suffix if the stem is a valid location (avoid false positives like "ankara" -> "ankar" + "a")
  for (const location of locations) {
    const wordPattern = new RegExp(
      `\\b${escapeRegex(location.originalText)}\\S*`,
      'i'
    );
    const match = originalText.match(wordPattern);
    if (match) {
      const word = normalizeToAscii(match[0]);
      const { stem, isOrigin: isOriginSuffix, isDestination: isDestSuffix } =
        stripSuffix(word);

      // Only trust suffix detection if stem matches the location we already found
      // This prevents "ankara" being detected as "ankar" + destination suffix "a"
      const normalizedProvince = normalizeToAscii(location.provinceName);
      const stemMatchesLocation = stem === normalizedProvince ||
        (location.districtName && stem === normalizeToAscii(location.districtName));

      if (isOriginSuffix && stemMatchesLocation && !origin) {
        origin = location;
      } else if (isDestSuffix && stemMatchesLocation && !destination) {
        destination = location;
      }
    }
  }

  // If we still don't have both, use position (first = origin, last = destination)
  const remaining = locations.filter((l) => l !== origin && l !== destination);

  if (!origin && remaining.length > 0) {
    origin = remaining.shift();
  }
  if (!destination && remaining.length > 0) {
    destination = remaining.pop();
  }

  // Fallback: if only one found, the other is undefined
  if (!origin && !destination && locations.length >= 2) {
    origin = locations[0];
    destination = locations[locations.length - 1];
  }

  return { origin, destination };
}
