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
  'olur',    // "olur" = "it happens/okay", matches Olur district in Erzurum
  'var',     // "var" = "there is", common word
  'yok',     // "yok" = "there isn't", common word
]);

/**
 * Check if a number token looks like a plate code based on context
 * Returns false for times (HH:MM), measurements (58 km), truck dimensions (13.60), etc.
 */
function looksLikePlateCode(token: string, originalText: string): boolean {
  // Find the token in original text with surrounding context
  const normalizedText = normalizeToAscii(originalText).toLowerCase();

  // FIRST: Check if part of a decimal number like "13.60" (truck dimensions)
  // This must be checked before standalone check, as "60" in "13.60" won't match standalone
  const decimalPattern = new RegExp(`\\d+[.,]${token}|${token}[.,]\\d+`);
  if (decimalPattern.test(normalizedText)) {
    return false;
  }

  // Need to find exact matches - the token might appear multiple times
  // Look for the token as a standalone number (with boundaries)
  const tokenRegex = new RegExp(`(^|[^0-9.])${token}([^0-9]|$)`);
  const match = tokenRegex.exec(normalizedText);

  // If not found as standalone number, it's likely part of another number - not a plate code
  if (!match) return false;

  const tokenIndex = match.index + (match[1]?.length || 0);

  // Get surrounding text (20 chars before and after for better context)
  const start = Math.max(0, tokenIndex - 20);
  const end = Math.min(normalizedText.length, tokenIndex + token.length + 20);
  const context = normalizedText.slice(start, end);

  // Skip if it looks like a time (e.g., "20:00", "12:00", "08:30")
  // Match: token followed by colon and digits, or digits and colon before token
  const timePattern = new RegExp(`${token}:\\d{2}|\\d{1,2}:${token}`);
  if (timePattern.test(context)) {
    return false;
  }

  // Skip if followed by measurement units (km, m, cm, mm, ton, kg, teker/wheels, etc.)
  // Also skip vehicle counts: "10 araba", "5 kamyon", "3 dorse"
  const measurementPattern = new RegExp(`${token}\\s*(km|m|cm|mm|mt|metre|meter|ton|kg|lt|saat|dakika|gun|arac|araba|kamyon|dorse|tir|teker|uzunluk|genislik|yukseklik)`, 'i');
  if (measurementPattern.test(context)) {
    return false;
  }

  // Skip if it looks like a price or currency
  const currencyPattern = new RegExp(`${token}\\s*(tl|lira|euro|dolar|\\$|€|₺)`);
  if (currencyPattern.test(context)) {
    return false;
  }

  // Skip if preceded by "saat" (hour) - e.g., "saat 20"
  const hourPattern = new RegExp(`saat\\s*${token}`, 'i');
  if (hourPattern.test(context)) {
    return false;
  }

  // Skip if preceded by "park" (parking fee) - e.g., "Park 60 Nakliye"
  const parkPattern = new RegExp(`park\\s*${token}`, 'i');
  if (parkPattern.test(context)) {
    return false;
  }

  // Skip if token has leading zero (like "010", "060") - not a valid plate code format
  const leadingZeroPattern = new RegExp(`0${token}\\b`);
  if (leadingZeroPattern.test(context)) {
    return false;
  }

  // Skip trailer dimensions like "13 60", "13.60", "1360" (13.60 meters trailer length)
  // Common formats: "13 60 tir", "13.60 açık", "1360 kapalı"
  if (token === '60') {
    const trailerPattern = /13\s*[\.,]?\s*60|1360/i;
    if (trailerPattern.test(context)) {
      return false;
    }
  }

  // Skip if it's in a range pattern like "20:00 - 12:00" or "20-12"
  const rangePattern = new RegExp(`${token}\\s*[-–—]\\s*\\d|\\d\\s*[-–—]\\s*${token}`);
  if (rangePattern.test(context)) {
    return false;
  }

  // Skip if part of phone number pattern (e.g., "0532 684 15 56", "05xx xxx xx xx")
  // Turkish mobile numbers: 05XX XXX XX XX or +90 5XX XXX XX XX
  const phonePatterns = [
    new RegExp(`05\\d{2}\\s*\\d{3}\\s*\\d{2}\\s*${token}`),  // End of phone
    new RegExp(`05\\d{2}\\s*\\d{3}\\s*${token}\\s*\\d{2}`),   // Middle of phone (15 in 05xx xxx 15 56)
    new RegExp(`05\\d{2}\\s*${token}\\s*\\d{2}\\s*\\d{2}`),   // After area code
    new RegExp(`${token}\\s*\\d{3}\\s*\\d{2}\\s*\\d{2}`),     // Start of phone-like sequence
    // Handle +90 format: +90 543 977 72 96
    new RegExp(`\\+?90\\s*5\\d{2}\\s*\\d{3}\\s*\\d{2}\\s*${token}`),  // End of +90 format
    new RegExp(`\\+?90\\s*5\\d{2}\\s*\\d{3}\\s*${token}\\s*\\d{2}`),  // Middle of +90 format
    // Handle cases where plate code is preceded by 2 digits (like "72 96" or "09 67")
    new RegExp(`\\d{2}\\s+${token}\\s*$`),  // Token at very end after 2 digits
    new RegExp(`\\d{3}\\s+${token}\\s+\\d{2}`),  // Token between 3 digits and 2 digits (xxx YY zz pattern)
    new RegExp(`\\d{2}\\s+${token}\\s+\\d{2}`),  // Token between 2 digits and 2 digits (xx YY zz pattern)
  ];
  if (phonePatterns.some(p => p.test(context))) {
    return false;
  }

  // Additional check: if the full text contains a phone number that includes this token
  // This catches edge cases where the token is embedded in various phone formats
  const fullPhoneCheck = new RegExp(`(?:0|\\+?90)\\s*5\\d{2}[\\s\\-\\.]*\\d{3}[\\s\\-\\.]*\\d{2}[\\s\\-\\.]*${token}(?:\\s|$|[^0-9])`);
  if (fullPhoneCheck.test(normalizedText)) {
    return false;
  }

  // Skip if looks like dimensions format (e.g., "13 60", "1360", common truck length)
  const dimensionPattern = new RegExp(`13\\s*\\.?\\s*${token}|${token}\\s*\\.?\\s*60`);
  if (token === '60' || token === '13') {
    if (dimensionPattern.test(context)) {
      return false;
    }
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
  // "TEKİRDAĞ_ARNAVUTKÖY" underscore-separated
  /([A-Za-z\u00C0-\u017F]+)_([A-Za-z\u00C0-\u017F]+)/g,
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

  // Token-by-token matching (include / + _ and apostrophes as separators)
  const tokens = normalizedText.split(/[\s,;:\-\>\<\(\)\[\]\/\+\._''`']+/);

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

  // If no explicit routes found, check for "one origin, multiple destinations" pattern
  // e.g., "Çerkezköyden yükleme\nErzurum\nKars\nAğrı\nIğdır"
  if (routes.length === 0) {
    const multiDestRoutes = extractOneOriginMultipleDestinations(normalizedText);
    for (const route of multiDestRoutes) {
      const routeKey = `${route.origin}-${route.destination}`;
      if (!seenRoutes.has(routeKey)) {
        seenRoutes.add(routeKey);
        routes.push(route);
      }
    }
  }

  // Check for "CITY YÜKLER" header pattern (e.g., "*ÇORLU YÜKLER*\nELAZIĞ TIR\nBAŞAKŞEHİR TIR")
  if (routes.length === 0) {
    const yuklerRoutes = extractYuklerHeaderRoutes(text);
    for (const route of yuklerRoutes) {
      const routeKey = `${route.origin}-${route.destination}`;
      if (!seenRoutes.has(routeKey)) {
        seenRoutes.add(routeKey);
        routes.push(route);
      }
    }
  }

  // Check for "(Çıkış:CITY)" format (e.g., "(Çıkış:AYDIN) 🏁 ORDU")
  if (routes.length === 0) {
    const cikisRoutes = extractCikisFormatRoutes(text);
    for (const route of cikisRoutes) {
      const routeKey = `${route.origin}-${route.destination}`;
      if (!seenRoutes.has(routeKey)) {
        seenRoutes.add(routeKey);
        routes.push(route);
      }
    }
  }

  return routes;
}

/**
 * Extract routes when there's one origin (with -den/-dan suffix) and multiple destinations
 * on separate lines or comma-separated.
 * e.g., "Çerkezköyden yükleme açık araç 26 ton\nErzurum\nKars\nAğrı\nIğdır"
 */
function extractOneOriginMultipleDestinations(text: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];

  // Find origin with -den/-dan/-ten/-tan suffix
  const originPattern = /([A-Za-z\u00C0-\u017F]+)[''']?(?:dan|den|tan|ten)\b/gi;
  let originMatch;
  let origin: { provinceName: string; provinceCode: number } | null = null;

  while ((originMatch = originPattern.exec(text)) !== null) {
    const originPart = originMatch[1];
    if (originPart) {
      const resolved = resolveLocation(originPart.toLowerCase());
      if (resolved) {
        origin = resolved;
        break; // Use first valid origin found
      }
    }
  }

  if (!origin) {
    return routes;
  }

  // Find all other locations in the text (potential destinations)
  const allLocations = extractLocations(text);
  const destinations: { provinceName: string; provinceCode: number }[] = [];

  for (const loc of allLocations) {
    // Skip if it's the same as origin
    if (loc.provinceName === origin.provinceName) {
      continue;
    }

    // Check if this location has origin suffix (-den/-dan) - skip those
    const locPattern = new RegExp(
      `${escapeRegex(loc.originalText)}[''']?(?:dan|den|tan|ten)\\b`,
      'i'
    );
    if (locPattern.test(text)) {
      continue; // This is another origin, not a destination
    }

    // Check if already added
    if (!destinations.some(d => d.provinceName === loc.provinceName)) {
      destinations.push({
        provinceName: loc.provinceName,
        provinceCode: loc.provinceCode,
      });
    }
  }

  // Create routes from origin to each destination
  for (const dest of destinations) {
    routes.push({
      origin: origin.provinceName,
      destination: dest.provinceName,
      originCode: origin.provinceCode,
      destinationCode: dest.provinceCode,
    });
  }

  return routes;
}

/**
 * Extract routes from "CITY YÜKLER" header format
 * e.g., "*ÇORLU YÜKLER*\nELAZIĞ TIR\nBAŞAKŞEHİR TIR\nTUZLA TIR"
 * Origin = ÇORLU, Destinations = [ELAZIĞ, BAŞAKŞEHİR, TUZLA]
 */
function extractYuklerHeaderRoutes(text: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  const normalizedText = normalizeToAscii(text);

  // Pattern: *?CITY YÜKLER*? followed by list of destinations
  // Matches: "*ÇORLU YÜKLER*", "GEBZE YÜKLER", "İSTANBUL YÜKLERİ" etc.
  const yuklerPattern = /\*?([A-Za-z\u00C0-\u017F]+)\s+Y[UÜ]KLER[İI]?\*?/gi;

  let match;
  while ((match = yuklerPattern.exec(normalizedText)) !== null) {
    const originPart = match[1];
    if (!originPart) continue;

    const origin = resolveLocation(originPart.toLowerCase());
    if (!origin) continue;

    // Find the section after this header until the next header or end
    const headerEnd = match.index + match[0].length;
    const nextHeaderMatch = normalizedText.slice(headerEnd).match(/\*?[A-Za-z\u00C0-\u017F]+\s+Y[UÜ]KLER[İI]?\*?/i);
    const sectionEnd = nextHeaderMatch
      ? headerEnd + (nextHeaderMatch.index ?? normalizedText.length)
      : normalizedText.length;

    const section = normalizedText.slice(headerEnd, sectionEnd);

    // Extract destinations from this section (each line typically has a city name)
    const lines = section.split(/\n/);
    for (const line of lines) {
      // Skip empty lines and lines that are just separators
      if (!line.trim() || /^[-─➖═]+$/.test(line.trim())) continue;

      // Extract first word/location from the line
      const lineMatch = line.match(/([A-Za-z\u00C0-\u017F]+)/);
      if (lineMatch && lineMatch[1]) {
        const destPart = lineMatch[1];
        const dest = resolveLocation(destPart.toLowerCase());

        if (dest && dest.provinceName !== origin.provinceName) {
          routes.push({
            origin: origin.provinceName,
            destination: dest.provinceName,
            originCode: origin.provinceCode,
            destinationCode: dest.provinceCode,
          });
        }
      }
    }
  }

  return routes;
}

/**
 * Extract routes from "(Çıkış:CITY)" format
 * e.g., "(Çıkış:AYDIN) 🏁 ORDU" or "(Çıkış:DÜZCE+BOLU)"
 * Origin = city after Çıkış:, Destination = city after 🏁 or other markers
 */
function extractCikisFormatRoutes(text: string): ExtractedRoute[] {
  const routes: ExtractedRoute[] = [];
  const normalizedText = normalizeToAscii(text);

  // Pattern for "(Çıkış:CITY)" - explicit origin marker
  const cikisPattern = /\(?\s*[CÇ][IİI]K[IİI][SŞ]\s*:\s*([A-Za-z\u00C0-\u017F]+)/gi;

  // Find all origins marked with Çıkış
  const origins: { provinceName: string; provinceCode: number }[] = [];
  let match;
  while ((match = cikisPattern.exec(normalizedText)) !== null) {
    const originPart = match[1];
    if (originPart) {
      const origin = resolveLocation(originPart.toLowerCase());
      if (origin && !origins.some(o => o.provinceName === origin.provinceName)) {
        origins.push(origin);
      }
    }
  }

  if (origins.length === 0) return routes;

  // Find destinations - look for 🏁 marker or standalone city names
  // 🏁 typically marks the destination/finish point
  const finishPattern = /🏁\s*([A-Za-z\u00C0-\u017F]+)/gi;
  const destinations: { provinceName: string; provinceCode: number }[] = [];

  while ((match = finishPattern.exec(text)) !== null) {
    const destPart = match[1];
    if (destPart) {
      const dest = resolveLocation(normalizeToAscii(destPart).toLowerCase());
      if (dest && !destinations.some(d => d.provinceName === dest.provinceName)) {
        destinations.push(dest);
      }
    }
  }

  // If no 🏁 marker found, try to find other locations that aren't origins
  if (destinations.length === 0) {
    const allLocations = extractLocations(text);
    for (const loc of allLocations) {
      if (!origins.some(o => o.provinceName === loc.provinceName)) {
        if (!destinations.some(d => d.provinceName === loc.provinceName)) {
          destinations.push({
            provinceName: loc.provinceName,
            provinceCode: loc.provinceCode,
          });
        }
      }
    }
  }

  // Create routes from each origin to each destination
  for (const origin of origins) {
    for (const dest of destinations) {
      if (origin.provinceName !== dest.provinceName) {
        routes.push({
          origin: origin.provinceName,
          destination: dest.provinceName,
          originCode: origin.provinceCode,
          destinationCode: dest.provinceCode,
        });
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
