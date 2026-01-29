/**
 * Turkish Location Parser
 * Comprehensive location parsing for Turkish logistics messages
 * Handles: suffixes, abbreviations, regions, districts, multi-destination, etc.
 */

import {
  normalizeToAscii,
  stripSuffix,
} from '@turkish-logistics/shared/utils';
import {
  PROVINCE_NAMES,
  getProvinceByName,
  DISTRICT_NAMES,
  getDistrictsByName,
  getNeighboringProvinces,
} from '@turkish-logistics/shared/constants';

/**
 * Common city abbreviations and slang
 */
export const CITY_ABBREVIATIONS: Record<string, string> = {
  'ist': 'istanbul',
  'ank': 'ankara',
  'izm': 'izmir',
  'adn': 'adana',
  'brs': 'bursa',
  'gzt': 'gaziantep',
  'kny': 'konya',
  'kcl': 'kocaeli',
};

/**
 * Vehicle/logistics terms that should NOT be interpreted as locations
 */
export const VEHICLE_TERMS_NOT_LOCATIONS = new Set([
  'arac', 'araç',
  'kamyon',
  'kamyonet',
  'tir', 'tır',
  'dorse',
  'kasa', 'kas',
  'yuk', 'yük',
  'palet',
  'acik', 'açık',
  'kapali', 'kapalı', 'kapal',
  'tenteli', 'tente', 'tentel',
  'damperli', 'damper', 'damperl',
  'frigo', 'frigorifik',
  'panelvan', 'panel',
]);

/**
 * Common Turkish words that happen to match district names
 */
export const COMMON_WORDS_NOT_LOCATIONS = new Set([
  'olur', 'var', 'yok', 'alan', 'bey', 'ova',
]);

/**
 * International destinations
 */
export const INTERNATIONAL_DESTINATIONS = new Set([
  'irak', 'iraq', 'iran', 'suriye', 'syria',
  'gurcistan', 'georgia', 'ermenistan', 'armenia',
  'azerbaycan', 'azerbaijan', 'yunanistan', 'greece',
  'bulgaristan', 'bulgaria', 'almanya', 'germany',
  'rusya', 'russia', 'italya', 'italy', 'fransa', 'france',
  'ingiltere', 'uk', 'england', 'hollanda', 'netherlands',
  'ispanya', 'spain', 'polonya', 'poland', 'romanya', 'romania',
  'ukrayna', 'ukraine', 'kibris', 'cyprus',
  'yurtdisi', 'yurt disi', 'abroad', 'export', 'ihracat',
]);

/**
 * Istanbul European side districts
 */
export const ISTANBUL_EUROPEAN_DISTRICTS = new Set([
  'arnavutkoy', 'avcilar', 'bagcilar', 'bahcelievler', 'bakirkoy',
  'basaksehir', 'bayrampasa', 'besiktas', 'beylikduzu', 'beyoglu',
  'buyukcekmece', 'catalca', 'esenler', 'esenyurt', 'eyupsultan', 'eyup',
  'fatih', 'gaziosmanpasa', 'gungoren', 'kagithane', 'kucukcekmece',
  'sariyer', 'silivri', 'sultangazi', 'sisli', 'zeytinburnu',
]);

/**
 * Istanbul Asian side districts
 */
export const ISTANBUL_ASIAN_DISTRICTS = new Set([
  'adalar', 'atasehir', 'beykoz', 'cekmekoy', 'kadikoy',
  'kartal', 'maltepe', 'pendik', 'sancaktepe', 'sultanbeyli',
  'sile', 'tuzla', 'umraniye', 'uskudar',
]);

/**
 * Turkish geographical regions and their provinces
 */
export const TURKISH_REGIONS: Record<string, string[]> = {
  'marmara': ['istanbul', 'kocaeli', 'bursa', 'balikesir', 'canakkale', 'edirne', 'kirklareli', 'tekirdag', 'sakarya', 'yalova', 'bilecik'],
  'ege': ['izmir', 'aydin', 'denizli', 'manisa', 'mugla', 'usak', 'afyonkarahisar', 'kutahya'],
  'akdeniz': ['antalya', 'adana', 'mersin', 'hatay', 'isparta', 'burdur', 'kahramanmaras', 'osmaniye'],
  'ic anadolu': ['ankara', 'konya', 'eskisehir', 'kayseri', 'sivas', 'yozgat', 'aksaray', 'nigde', 'nevsehir', 'kirsehir', 'kirikkale', 'karaman', 'cankiri'],
  'icanadolu': ['ankara', 'konya', 'eskisehir', 'kayseri', 'sivas', 'yozgat', 'aksaray', 'nigde', 'nevsehir', 'kirsehir', 'kirikkale', 'karaman', 'cankiri'],
  'orta anadolu': ['ankara', 'konya', 'eskisehir', 'kayseri', 'sivas', 'yozgat', 'aksaray', 'nigde', 'nevsehir', 'kirsehir', 'kirikkale', 'karaman', 'cankiri'],
  'karadeniz': ['samsun', 'trabzon', 'ordu', 'giresun', 'rize', 'artvin', 'sinop', 'kastamonu', 'corum', 'amasya', 'tokat', 'zonguldak', 'bartin', 'karabuk', 'duzce', 'bolu', 'gumushane', 'bayburt'],
  'dogu anadolu': ['erzurum', 'van', 'malatya', 'elazig', 'erzincan', 'kars', 'agri', 'mus', 'bingol', 'bitlis', 'hakkari', 'igdir', 'ardahan', 'tunceli'],
  'doguanadolu': ['erzurum', 'van', 'malatya', 'elazig', 'erzincan', 'kars', 'agri', 'mus', 'bingol', 'bitlis', 'hakkari', 'igdir', 'ardahan', 'tunceli'],
  'dogu': ['erzurum', 'van', 'malatya', 'elazig', 'erzincan', 'kars', 'agri', 'mus', 'bingol', 'bitlis', 'hakkari', 'igdir', 'ardahan', 'tunceli'],
  'guneydogu anadolu': ['gaziantep', 'diyarbakir', 'sanliurfa', 'mardin', 'batman', 'siirt', 'sirnak', 'adiyaman', 'kilis'],
  'guneydoguanadolu': ['gaziantep', 'diyarbakir', 'sanliurfa', 'mardin', 'batman', 'siirt', 'sirnak', 'adiyaman', 'kilis'],
  'guneydogu': ['gaziantep', 'diyarbakir', 'sanliurfa', 'mardin', 'batman', 'siirt', 'sirnak', 'adiyaman', 'kilis'],
};

/**
 * Region name aliases
 */
export const REGION_ALIASES: Record<string, string> = {
  'marmarabolgesi': 'marmara',
  'marmara bolgesi': 'marmara',
  'egebolgesi': 'ege',
  'ege bolgesi': 'ege',
  'akdenizbolgesi': 'akdeniz',
  'akdeniz bolgesi': 'akdeniz',
  'icanadolubolgesi': 'ic anadolu',
  'ic anadolu bolgesi': 'ic anadolu',
  'ortaanadolu': 'ic anadolu',
  'orta anadolu bolgesi': 'ic anadolu',
  'karadenizbolgesi': 'karadeniz',
  'karadeniz bolgesi': 'karadeniz',
  'doguanadolubolgesi': 'dogu anadolu',
  'dogu anadolu bolgesi': 'dogu anadolu',
  'dogubolgesi': 'dogu anadolu',
  'dogu bolgesi': 'dogu anadolu',
  'guneydoguanadolubolgesi': 'guneydogu anadolu',
  'guneydogu anadolu bolgesi': 'guneydogu anadolu',
  'guneydogubolgesi': 'guneydogu anadolu',
  'guneydogu bolgesi': 'guneydogu anadolu',
};

/**
 * Swear words for foul language detection
 */
export const SWEAR_WORDS = [
  'amk', 'aq', 'amina', 'aminakoyim', 'aminakoyayim', 'amq',
  'sikeyim', 'siktir', 'sikerim', 'siktirgit', 'sik',
  'orospu', 'orosbu', 'orospucocugu', 'orosbucocugu',
  'pic', 'piclik',
  'yarrak', 'yarak',
  'gotten', 'gotune', 'got',
  'anani', 'ananin', 'anana',
  'ibne', 'gavat',
];

/**
 * Vehicle type patterns for pre-parsing
 * These patterns detect vehicle types from trucker slang
 */
export const VEHICLE_TYPE_PATTERNS: Array<{ pattern: RegExp; vehicleType: string }> = [
  // TIR (big trucks)
  { pattern: /\b13\s*[:\.\s]?\s*60\b/i, vehicleType: 'TIR' }, // Trucker slang for TIR
  { pattern: /\bt[ıi]r\b/i, vehicleType: 'TIR' },
  { pattern: /\bdorse(li|yle|siz)?\b/i, vehicleType: 'TIR' },
  { pattern: /\b10\s*teker\b/i, vehicleType: 'TIR' },
  // KAMYONET (small trucks - check before KAMYON!)
  { pattern: /\bkamyonet\b/i, vehicleType: 'KAMYONET' },
  { pattern: /\b6\s*teker\b/i, vehicleType: 'KAMYONET' },
  // KAMYON (medium trucks)
  { pattern: /\bkamyon\b/i, vehicleType: 'KAMYON' }, // Only matches "kamyon", not "kamyonet"
  // PANELVAN
  { pattern: /\bpanel\s*van\b/i, vehicleType: 'PANELVAN' },
  { pattern: /\bpanelvan\b/i, vehicleType: 'PANELVAN' },
  { pattern: /\bpanel\s+arac\b/i, vehicleType: 'PANELVAN' }, // "panel araç"
];

/**
 * Body type patterns for pre-parsing
 * IMPORTANT: Order matters! More specific patterns should come first.
 * Patterns are tested against ASCII-normalized text (Turkish chars converted)
 */
export const BODY_TYPE_PATTERNS: Array<{ pattern: RegExp; bodyType: string }> = [
  // Tenteli (tarpaulin) - common in Turkish trucking
  { pattern: /\btenteli\b/i, bodyType: 'TENTELI' },
  { pattern: /\btente\b/i, bodyType: 'TENTELI' },
  // Damperli (dump truck)
  { pattern: /\bdamperli\b/i, bodyType: 'DAMPERLI' },
  { pattern: /\bdamper\b/i, bodyType: 'DAMPERLI' },
  // Kapalı (closed/box) - check before open since both might appear
  { pattern: /\bkapali\b/i, bodyType: 'KAPALI' },
  { pattern: /\bkapal[ıi]\b/i, bodyType: 'KAPALI' },
  // Açık (open/flatbed)
  { pattern: /\bacik\b/i, bodyType: 'AÇIK' },
  { pattern: /\bac[ıi]k\b/i, bodyType: 'AÇIK' },
  // Frigorifik (refrigerated)
  { pattern: /\bfrigorifik\b/i, bodyType: 'FRİGORİFİK' },
  { pattern: /\bfrigo\b/i, bodyType: 'FRİGORİFİK' },
  { pattern: /\bsogutuculu\b/i, bodyType: 'FRİGORİFİK' },
  // Special types
  { pattern: /\blowbed\b/i, bodyType: 'LOWBED' },
  { pattern: /\bsal\b/i, bodyType: 'SAL' }, // Flatbed
];

/**
 * Pre-parsed location info from user message
 */
export interface ParsedLocations {
  origin?: string;
  destination?: string;
  originProvince?: string;
  originDistrict?: string;
  destinationProvince?: string;
  destinationDistrict?: string;
  sameProvinceSearch?: boolean;
  destinations?: string[];       // Multiple destinations
  origins?: string[];            // Multiple origins
  originRegion?: string;         // Region name if origin is a region
  destinationRegion?: string;    // Region name if destination is a region
  cargoType?: string;            // Detected cargo type
  internationalDestination?: string;  // International country
  istanbulSide?: 'european' | 'asian';
  // Vehicle type parsing (NEW!)
  vehicleType?: string;          // Pre-parsed vehicle type (TIR, KAMYON, KAMYONET, PANELVAN)
  bodyType?: string;             // Pre-parsed body type (TENTELI, DAMPERLI, KAPALI, etc.)
}

/**
 * Detect region from text
 */
function detectRegion(text: string): string | null {
  const normalized = normalizeToAscii(text).toLowerCase();
  const suffixes = '(den|dan|ye|ya|ne|na|nin|de|da|si)?';

  for (const regionName of Object.keys(TURKISH_REGIONS)) {
    const regionPattern = new RegExp(`\\b${regionName}${suffixes}\\b`, 'i');
    const bolgePattern = new RegExp(`\\b${regionName}\\s*bolge(si|sine|sinden|sini)?\\b`, 'i');

    if (regionPattern.test(normalized) || bolgePattern.test(normalized)) {
      return regionName;
    }
  }

  for (const [alias, regionKey] of Object.entries(REGION_ALIASES)) {
    const aliasPattern = new RegExp(`\\b${alias}${suffixes}\\b`, 'i');
    const bolgePatttern = new RegExp(`\\b${alias}\\s*bolge(si|sine|sinden|sini)?\\b`, 'i');

    if (aliasPattern.test(normalized) || bolgePatttern.test(normalized)) {
      return regionKey;
    }
  }

  return null;
}

/**
 * Resolve a token to a province name and optionally a district name
 */
function resolveLocation(stem: string): { province: string; district?: string } | null {
  if (VEHICLE_TERMS_NOT_LOCATIONS.has(stem) || COMMON_WORDS_NOT_LOCATIONS.has(stem)) {
    return null;
  }

  if (CITY_ABBREVIATIONS[stem]) {
    return { province: CITY_ABBREVIATIONS[stem] };
  }

  const province = getProvinceByName(stem);
  if (province) {
    return { province: province.normalized };
  }

  if (PROVINCE_NAMES.has(stem)) {
    return { province: stem };
  }

  if (DISTRICT_NAMES.has(stem)) {
    const districts = getDistrictsByName(stem);
    if (districts.length > 0) {
      return {
        province: normalizeToAscii(districts[0].provinceName).toLowerCase(),
        district: stem,
      };
    }
  }

  return null;
}

/**
 * Parse Turkish location suffixes from user message
 */
export function parseLocationsFromMessage(text: string): ParsedLocations {
  const result: ParsedLocations = {};

  let normalized = normalizeToAscii(text);
  normalized = normalized.replace(/[\u0027\u2019\u2018\u0060]/g, "'");
  normalized = normalized.replace(/(\w+)'(dan|den|tan|ten|ndan|nden|a|e|ya|ye|na|ne)(?=\s|$)/gi, '$1$2');
  normalized = normalized.replace(/\bpanel\s+van\b/gi, 'panelvan_vehicle');
  normalized = normalized.replace(/\bne\s+zaman\b/gi, 'ne_zaman_question');

  const suffixPatterns = ['dan', 'den', 'tan', 'ten', 'ndan', 'nden', 'a', 'e', 'ya', 'ye', 'na', 'ne'];
  for (const suffix of suffixPatterns) {
    const pattern = new RegExp(`(\\w+)\\s+'?${suffix}(?=\\s|$)`, 'gi');
    normalized = normalized.replace(pattern, `$1${suffix}`);
  }

  // VEYA/YADA detection
  const veyaCities: { city: string; suffix: 'origin' | 'destination' | 'none' }[] = [];
  const veyaPattern = /(\w+)\s+(?:veya|yada|ya\s+da)\s+(\w+)/gi;
  let veyaMatch;
  while ((veyaMatch = veyaPattern.exec(normalized)) !== null) {
    const [, city1, city2] = veyaMatch;
    if (city1 && city2) {
      const { stem: stem1, isOrigin: isOrigin1, isDestination: isDest1 } = stripSuffix(city1);
      const { stem: stem2, isOrigin: isOrigin2, isDestination: isDest2 } = stripSuffix(city2);

      let direction: 'origin' | 'destination' | 'none' = 'none';
      if (isDest1 || isDest2) direction = 'destination';
      else if (isOrigin1 || isOrigin2) direction = 'origin';

      veyaCities.push({ city: stem1, suffix: direction });
      veyaCities.push({ city: stem2, suffix: direction });
    }
  }

  const tokens = normalized.split(/[\s,\-–—]+/);

  // Check for international destinations
  for (const token of tokens) {
    const cleanToken = token.replace(/[?!.'"]/g, '').toLowerCase();
    if (INTERNATIONAL_DESTINATIONS.has(cleanToken)) {
      result.internationalDestination = cleanToken;
    }
  }

  // Check for Turkish regions
  const detectedRegion = detectRegion(normalized);
  if (detectedRegion) {
    const regionProvinces = TURKISH_REGIONS[detectedRegion];

    const regionPatterns = [
      detectedRegion,
      detectedRegion + ' bolgesi',
      detectedRegion.replace(' ', ''),
      detectedRegion.replace(' ', '') + 'bolgesi',
    ];

    let isOriginRegion = false;
    let isDestinationRegion = false;

    for (const pattern of regionPatterns) {
      if (normalized.includes(pattern + 'den') ||
          normalized.includes(pattern + 'dan') ||
          normalized.includes(pattern + 'nden') ||
          normalized.includes(pattern + 'ndan') ||
          normalized.includes(pattern + ' den') ||
          normalized.includes(pattern + ' dan')) {
        isOriginRegion = true;
        break;
      }
      if (normalized.includes(pattern + 'e') ||
          normalized.includes(pattern + 'a') ||
          normalized.includes(pattern + 'ye') ||
          normalized.includes(pattern + 'ya') ||
          normalized.includes(pattern + 'ne') ||
          normalized.includes(pattern + 'na') ||
          normalized.includes(pattern + 'sine') ||
          normalized.includes(pattern + 'ine') ||
          normalized.includes(pattern + ' e') ||
          normalized.includes(pattern + ' a')) {
        isDestinationRegion = true;
        break;
      }
    }

    if (!isOriginRegion && !isDestinationRegion) {
      isDestinationRegion = true;
    }

    if (isOriginRegion) {
      result.originRegion = detectedRegion;
      result.destinations = regionProvinces;
      result.origin = regionProvinces[0];
      result.originProvince = regionProvinces[0];
    } else if (isDestinationRegion) {
      result.destinationRegion = detectedRegion;
      result.destinations = regionProvinces;
      result.destination = regionProvinces[0];
      result.destinationProvince = regionProvinces[0];
    }
  }

  // Check for Istanbul side filter
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower.includes('avrupa') && (normalizedLower.includes('yakasi') || normalizedLower.includes('yaka'))) {
    result.istanbulSide = 'european';
  } else if (normalizedLower.includes('anadolu') && (normalizedLower.includes('yakasi') || normalizedLower.includes('yaka'))) {
    result.istanbulSide = 'asian';
  }

  const citiesWithoutSuffix: { name: string; province: string; district?: string }[] = [];

  for (const token of tokens) {
    const cleanToken = token.replace(/[?!.]/g, '');
    if (cleanToken.length < 2) continue;

    const { stem, isOrigin, isDestination } = stripSuffix(cleanToken);

    let location = resolveLocation(stem);

    // Fallback: try original token if stem doesn't resolve
    if (!location && stem !== cleanToken.toLowerCase()) {
      const originalLocation = resolveLocation(cleanToken.toLowerCase());
      if (originalLocation) {
        location = originalLocation;
        citiesWithoutSuffix.push({ name: cleanToken.toLowerCase(), province: originalLocation.province, district: originalLocation.district });
        continue;
      }
    }

    // Fallback: try shorter suffixes
    if (!location && (isOrigin || isDestination)) {
      const lower = cleanToken.toLowerCase().replace(/[''`']/g, '');
      const originSuffixes = ['dan', 'den', 'tan', 'ten', 'ndan', 'nden'].sort((a, b) => a.length - b.length);
      const destSuffixes = ['a', 'e', 'ya', 'ye', 'na', 'ne'].sort((a, b) => a.length - b.length);
      const suffixesToTry = isOrigin ? originSuffixes : destSuffixes;

      for (const suffix of suffixesToTry) {
        if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
          const tryStem = lower.slice(0, -suffix.length);
          const tryLocation = resolveLocation(tryStem);
          if (tryLocation) {
            location = tryLocation;
            break;
          }
        }
      }
    }

    if (location) {
      if (isOrigin && !result.origin) {
        result.origin = location.province;
        result.originProvince = location.province;
        if (location.district) result.originDistrict = location.district;
      } else if (isDestination && !result.destination) {
        result.destination = location.province;
        result.destinationProvince = location.province;
        if (location.district) result.destinationDistrict = location.district;
      } else if (!isOrigin && !isDestination) {
        citiesWithoutSuffix.push({ name: stem, province: location.province, district: location.district });
      }
    }
  }

  // Multi-destination patterns
  if (result.origin && citiesWithoutSuffix.length >= 2) {
    result.destinations = [...new Set(citiesWithoutSuffix.map(c => c.province))];
    result.destination = citiesWithoutSuffix[0].province;
    result.destinationProvince = citiesWithoutSuffix[0].province;
    if (citiesWithoutSuffix[0].district) result.destinationDistrict = citiesWithoutSuffix[0].district;
  } else if (!result.origin && !result.destination && citiesWithoutSuffix.length >= 3) {
    const [first, ...rest] = citiesWithoutSuffix;
    result.origin = first.province;
    result.originProvince = first.province;
    if (first.district) result.originDistrict = first.district;
    result.destinations = [...new Set(rest.map(c => c.province))];
    result.destination = rest[0].province;
    result.destinationProvince = rest[0].province;
    if (rest[0].district) result.destinationDistrict = rest[0].district;
  } else {
    for (const { province, district } of citiesWithoutSuffix) {
      if (!result.origin) {
        result.origin = province;
        result.originProvince = province;
        if (district) result.originDistrict = district;
      } else if (!result.destination) {
        result.destination = province;
        result.destinationProvince = province;
        if (district) result.destinationDistrict = district;
      }
    }
  }

  // Process VEYA pattern
  if (veyaCities.length >= 2) {
    const destCities = veyaCities.filter(c => c.suffix === 'destination');
    const originCities = veyaCities.filter(c => c.suffix === 'origin');

    if (destCities.length >= 2) {
      const resolvedDests: string[] = [];
      for (const { city } of destCities) {
        const loc = resolveLocation(city);
        if (loc) resolvedDests.push(loc.province);
      }
      if (resolvedDests.length >= 2) {
        const existingDests = result.destinations || (result.destination ? [result.destination] : []);
        result.destinations = [...new Set([...existingDests, ...resolvedDests])];
        if (!result.destination && result.destinations.length > 0) {
          result.destination = result.destinations[0];
          result.destinationProvince = result.destinations[0];
        }
      }
    }

    if (originCities.length >= 2) {
      const resolvedOrigins: string[] = [];
      for (const { city } of originCities) {
        const loc = resolveLocation(city);
        if (loc) resolvedOrigins.push(loc.province);
      }
      if (resolvedOrigins.length >= 2) {
        result.origins = [...new Set(resolvedOrigins)];
        if (!result.origin && result.origins.length > 0) {
          result.origin = result.origins[0];
          result.originProvince = result.origins[0];
        }
      }
    }
  }

  // Same-province detection
  if (result.originProvince && result.destinationProvince &&
      result.originProvince === result.destinationProvince) {
    result.sameProvinceSearch = true;
  }

  // Cargo type detection
  if (/\bparca\s*yuk\b|\bparsiyel\b|\bparca\b/i.test(normalized)) {
    result.cargoType = 'parsiyel';
  } else if (/\bkomple\s*yuk\b|\bkomple\b|\bfull\b/i.test(normalized)) {
    result.cargoType = 'komple';
  } else if (/\bpalet\b/i.test(normalized)) {
    result.cargoType = 'palet';
  }

  // VEHICLE TYPE PARSING (NEW!)
  // Order matters: check KAMYONET before KAMYON
  for (const { pattern, vehicleType } of VEHICLE_TYPE_PATTERNS) {
    if (pattern.test(normalized)) {
      result.vehicleType = vehicleType;
      break; // First match wins (order is important!)
    }
  }

  // BODY TYPE PARSING (NEW!)
  for (const { pattern, bodyType } of BODY_TYPE_PATTERNS) {
    if (pattern.test(normalized)) {
      result.bodyType = bodyType;
      break; // First match wins
    }
  }

  return result;
}

/**
 * Check if message contains foul language
 */
export function hasFoulLanguage(message: string): boolean {
  const normalized = normalizeToAscii(message.toLowerCase());
  const words = normalized.split(/[\s,.']+/);
  return SWEAR_WORDS.some(swear => words.includes(swear));
}

/**
 * Pre-process message (trucker slang, etc.)
 */
export function preprocessMessage(message: string): string {
  // "13 60", "13:60", "1360" -> "tir" (trucker slang for TIR truck)
  return message.replace(/\b13\s*[:\.\s]?\s*60\b/gi, 'tir');
}

/**
 * Get neighboring provinces for nearby search suggestions
 */
export { getNeighboringProvinces };
