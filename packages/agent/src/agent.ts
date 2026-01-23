import OpenAI from 'openai';
import postgres from 'postgres';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ConversationStore, type Conversation, type ConversationContext } from './conversation.js';
import {
  searchJobs,
  getJobById,
  searchJobsToolDefinition,
  getJobDetailsToolDefinition,
  type SearchJobsParams,
  type JobResult,
} from './tools/searchJobs.js';
import {
  normalizeToAscii,
  stripSuffix,
} from '@turkish-logistics/shared/utils';
import {
  PROVINCE_NAMES,
  getProvinceByName,
  DISTRICT_NAMES,
  getDistrictsByName,
} from '@turkish-logistics/shared/constants';

/**
 * Common city abbreviations and slang not in PROVINCES aliases
 */
const CITY_ABBREVIATIONS: Record<string, string> = {
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
 * Pre-parsed location info from user message.
 * Used to ensure GPT correctly interprets Turkish origin/destination suffixes.
 */
interface ParsedLocations {
  origin?: string;
  destination?: string;
  originProvince?: string;       // Resolved province name
  originDistrict?: string;       // District name if origin is a district
  destinationProvince?: string;  // Resolved province name
  destinationDistrict?: string;  // District name if destination is a district
  sameProvinceSearch?: boolean;  // True if both origin and destination resolve to same province
  // Multi-destination support: "Samsundan istanbul ankara izmir varmi"
  // = origin: samsun, destinations: [istanbul, ankara, izmir]
  destinations?: string[];       // Multiple destinations when origin has explicit suffix
  // Region support: "istanbuldan ege bolgesine"
  // = origin: istanbul, destinationRegion: ege, destinations: [izmir, aydin, ...]
  originRegion?: string;         // Region name if origin is a region
  destinationRegion?: string;    // Region name if destination is a region
  // Cargo type detection
  cargoType?: string;            // Detected cargo type (parsiyel, palet, etc.)
  // International destination detection
  internationalDestination?: string;  // Detected international country name
  // Istanbul side filter (Avrupa/Anadolu Yakası)
  istanbulSide?: 'european' | 'asian';  // Which side of Istanbul to filter
}

/**
 * Common vehicle/logistics terms that should NOT be interpreted as locations.
 * These words happen to match district names (e.g., "Araç" is a district in Kastamonu)
 * but are used as vehicle/cargo terms in logistics context.
 *
 * IMPORTANT: Also include STEMS after suffix stripping!
 * e.g., "kasa" → stripSuffix removes "a" → "kas" which matches Kaş district!
 */
const VEHICLE_TERMS_NOT_LOCATIONS = new Set([
  'arac', 'araç',  // "araç" = vehicle, but also Araç district in Kastamonu
  'kamyon',        // truck
  'kamyonet',      // small truck/van
  'tir', 'tır',    // TIR truck
  'dorse',         // trailer
  'kasa', 'kas',   // truck body/container - "kas" is stem after suffix strip (matches Kaş!)
  'yuk', 'yük',    // cargo/load
  'palet',         // pallet
  'acik', 'açık',  // open (body type)
  'kapali', 'kapalı', 'kapal', // closed (body type) - "kapal" is stem
  'tenteli', 'tente', 'tentel', // tarpaulin body type
  'damperli', 'damper', 'damperl', // dump truck
  'frigo', 'frigorifik', // refrigerated
  'panelvan', 'panel',   // panel van vehicle type - NOT Van province!
]);

/**
 * Common Turkish words that happen to match district names but should be skipped.
 * These are conversational words that are NOT location searches.
 */
const COMMON_WORDS_NOT_LOCATIONS = new Set([
  'olur',    // "olur" = "it happens/okay", matches Olur district in Erzurum
  'var',     // "var" = "there is"
  'yok',     // "yok" = "there isn't"
  'alan',    // "alan" = "field/area", matches Alan district
  'bey',     // common word/title
  'ova',     // "ova" = "plain", too generic
]);

/**
 * International destinations that Turkish truck drivers commonly ask about.
 * When detected, bot should explain it only handles Turkey-internal routes.
 */
const INTERNATIONAL_DESTINATIONS = new Set([
  // Neighboring countries
  'irak', 'iraq',           // Iraq
  'iran',                   // Iran
  'suriye', 'syria',        // Syria
  'gurcistan', 'georgia',   // Georgia
  'ermenistan', 'armenia',  // Armenia
  'azerbaycan', 'azerbaijan', // Azerbaijan
  'yunanistan', 'greece',   // Greece
  'bulgaristan', 'bulgaria', // Bulgaria
  // Common trade partners
  'almanya', 'germany',     // Germany
  'rusya', 'russia',        // Russia
  'italya', 'italy',        // Italy
  'fransa', 'france',       // France
  'ingiltere', 'uk', 'england', // UK
  'hollanda', 'netherlands', // Netherlands
  'ispanya', 'spain',       // Spain
  'polonya', 'poland',      // Poland
  'romanya', 'romania',     // Romania
  'ukrayna', 'ukraine',     // Ukraine
  'kibris', 'cyprus',       // Cyprus
  // Generic terms
  'yurtdisi', 'yurt disi', 'abroad', 'export', 'ihracat',
]);

/**
 * Istanbul districts on the European side (Avrupa Yakası)
 */
const ISTANBUL_EUROPEAN_DISTRICTS = new Set([
  'arnavutkoy', 'avcilar', 'bagcilar', 'bahcelievler', 'bakirkoy',
  'basaksehir', 'bayrampasa', 'besiktas', 'beylikduzu', 'beyoglu',
  'buyukcekmece', 'catalca', 'esenler', 'esenyurt', 'eyupsultan', 'eyup',
  'fatih', 'gaziosmanpasa', 'gungoren', 'kagithane', 'kucukcekmece',
  'sariyer', 'silivri', 'sultangazi', 'sisli', 'zeytinburnu',
]);

/**
 * Istanbul districts on the Asian side (Anadolu Yakası)
 */
const ISTANBUL_ASIAN_DISTRICTS = new Set([
  'adalar', 'atasehir', 'beykoz', 'cekmekoy', 'kadikoy',
  'kartal', 'maltepe', 'pendik', 'sancaktepe', 'sultanbeyli',
  'sile', 'tuzla', 'umraniye', 'uskudar',
]);

/**
 * Turkish geographical regions (bölgeler) and their provinces.
 * When user says "ege bolgesine", search all provinces in that region.
 */
const TURKISH_REGIONS: Record<string, string[]> = {
  // Marmara Bolgesi
  'marmara': ['istanbul', 'kocaeli', 'bursa', 'balikesir', 'canakkale', 'edirne', 'kirklareli', 'tekirdag', 'sakarya', 'yalova', 'bilecik'],
  // Ege Bolgesi
  'ege': ['izmir', 'aydin', 'denizli', 'manisa', 'mugla', 'usak', 'afyonkarahisar', 'kutahya'],
  // Akdeniz Bolgesi
  'akdeniz': ['antalya', 'adana', 'mersin', 'hatay', 'isparta', 'burdur', 'kahramanmaras', 'osmaniye'],
  // Ic Anadolu Bolgesi
  'ic anadolu': ['ankara', 'konya', 'eskisehir', 'kayseri', 'sivas', 'yozgat', 'aksaray', 'nigde', 'nevsehir', 'kirsehir', 'kirikkale', 'karaman', 'cankiri'],
  'icanadolu': ['ankara', 'konya', 'eskisehir', 'kayseri', 'sivas', 'yozgat', 'aksaray', 'nigde', 'nevsehir', 'kirsehir', 'kirikkale', 'karaman', 'cankiri'],
  'orta anadolu': ['ankara', 'konya', 'eskisehir', 'kayseri', 'sivas', 'yozgat', 'aksaray', 'nigde', 'nevsehir', 'kirsehir', 'kirikkale', 'karaman', 'cankiri'],
  // Karadeniz Bolgesi
  'karadeniz': ['samsun', 'trabzon', 'ordu', 'giresun', 'rize', 'artvin', 'sinop', 'kastamonu', 'corum', 'amasya', 'tokat', 'zonguldak', 'bartin', 'karabuk', 'duzce', 'bolu', 'gumushane', 'bayburt'],
  // Dogu Anadolu Bolgesi
  'dogu anadolu': ['erzurum', 'van', 'malatya', 'elazig', 'erzincan', 'kars', 'agri', 'mus', 'bingol', 'bitlis', 'hakkari', 'igdir', 'ardahan', 'tunceli'],
  'doguanadolu': ['erzurum', 'van', 'malatya', 'elazig', 'erzincan', 'kars', 'agri', 'mus', 'bingol', 'bitlis', 'hakkari', 'igdir', 'ardahan', 'tunceli'],
  'dogu': ['erzurum', 'van', 'malatya', 'elazig', 'erzincan', 'kars', 'agri', 'mus', 'bingol', 'bitlis', 'hakkari', 'igdir', 'ardahan', 'tunceli'],
  // Guneydogu Anadolu Bolgesi
  'guneydogu anadolu': ['gaziantep', 'diyarbakir', 'sanliurfa', 'mardin', 'batman', 'siirt', 'sirnak', 'adiyaman', 'kilis'],
  'guneydoguanadolu': ['gaziantep', 'diyarbakir', 'sanliurfa', 'mardin', 'batman', 'siirt', 'sirnak', 'adiyaman', 'kilis'],
  'guneydogu': ['gaziantep', 'diyarbakir', 'sanliurfa', 'mardin', 'batman', 'siirt', 'sirnak', 'adiyaman', 'kilis'],
};

/**
 * Region name aliases for flexible matching
 */
const REGION_ALIASES: Record<string, string> = {
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
 * Detect region from text and return the region key
 */
function detectRegion(text: string): string | null {
  const normalized = normalizeToAscii(text).toLowerCase();

  // Check direct region names first
  for (const regionName of Object.keys(TURKISH_REGIONS)) {
    if (normalized.includes(regionName)) {
      return regionName;
    }
  }

  // Check aliases
  for (const [alias, regionKey] of Object.entries(REGION_ALIASES)) {
    if (normalized.includes(alias)) {
      return regionKey;
    }
  }

  return null;
}

/**
 * Parse Turkish location suffixes from user message to extract origin and destination.
 * This runs BEFORE GPT to ensure correct interpretation of -dan/-den (from) and -a/-e (to).
 *
 * Examples:
 * - "Kayseri'den İstanbul'a" → origin: "kayseri", destination: "istanbul"
 * - "ankaradan izmire" → origin: "ankara", destination: "izmir"
 * - "istanbul" (no suffix) → origin: "istanbul"
 * - "bursaya" (-ya suffix) → destination: "bursa"
 */
function parseLocationsFromMessage(text: string): ParsedLocations {
  const result: ParsedLocations = {};

  // First, normalize Turkish characters to ASCII and lowercase
  // This converts İstanbul → istanbul, Çorlu → corlu, etc.
  let normalized = normalizeToAscii(text);

  // Then handle apostrophes AFTER normalizing (so \w+ works)
  // Normalize all apostrophe variants: U+0027('), U+2019('), U+2018('), U+0060(`)
  normalized = normalized.replace(/[\u0027\u2019\u2018\u0060]/g, "'");
  // Remove apostrophes between word and Turkish suffix: "istanbul'dan" → "istanbuldan"
  normalized = normalized.replace(/(\w+)'(dan|den|tan|ten|ndan|nden|a|e|ya|ye|na|ne)(?=\s|$)/gi, '$1$2');

  // BUGFIX: Remove vehicle type phrases that contain city names to prevent false parsing
  // "panel van" should not be parsed as Van province
  // "ne zaman" should not be parsed (ne = question word, zaman = time)
  normalized = normalized.replace(/\bpanel\s+van\b/gi, 'panelvan_vehicle');
  normalized = normalized.replace(/\bne\s+zaman\b/gi, 'ne_zaman_question');

  // Preprocess: merge "city dan/den/a/e/ya/ye" patterns (space between city and suffix)
  // Examples: "istanbul dan" → "istanbuldan", "ankara ya" → "ankaraya"
  const suffixPatterns = ['dan', 'den', 'tan', 'ten', 'ndan', 'nden', 'a', 'e', 'ya', 'ye', 'na', 'ne'];
  for (const suffix of suffixPatterns) {
    // Match: word + space + apostrophe? + suffix (as standalone word)
    const pattern = new RegExp(`(\\w+)\\s+'?${suffix}(?=\\s|$)`, 'gi');
    normalized = normalized.replace(pattern, `$1${suffix}`);
  }

  // Split into tokens (including hyphen/dash as separator for "istanbul-gebze" format)
  const tokens = normalized.split(/[\s,\-–—]+/);

  // Check for international destinations early
  for (const token of tokens) {
    const cleanToken = token.replace(/[?!.'"]/g, '').toLowerCase();
    if (INTERNATIONAL_DESTINATIONS.has(cleanToken)) {
      result.internationalDestination = cleanToken;
      // Continue parsing to get the origin, but we'll handle the response differently
    }
  }

  // Check for Turkish regions (bölge) - must be done on full normalized text
  // Detect patterns like "ege bolgesine", "karadenizden", "marmara bolgesi"
  const detectedRegion = detectRegion(normalized);
  if (detectedRegion) {
    const regionProvinces = TURKISH_REGIONS[detectedRegion];
    console.log(`[Parser] Detected region: ${detectedRegion} with provinces:`, regionProvinces);

    // Check if region has origin or destination suffix
    // "egeden" or "ege bolgesinden" = origin region
    // "egeye" or "ege bolgesine" = destination region
    const regionPatterns = [
      detectedRegion,
      detectedRegion + ' bolgesi',
      detectedRegion.replace(' ', ''),
      detectedRegion.replace(' ', '') + 'bolgesi',
    ];

    let isOriginRegion = false;
    let isDestinationRegion = false;

    for (const pattern of regionPatterns) {
      // Check for origin suffixes: dan, den, ndan, nden
      if (normalized.includes(pattern + 'den') ||
          normalized.includes(pattern + 'dan') ||
          normalized.includes(pattern + 'nden') ||
          normalized.includes(pattern + 'ndan') ||
          normalized.includes(pattern + ' den') ||
          normalized.includes(pattern + ' dan')) {
        isOriginRegion = true;
        break;
      }
      // Check for destination suffixes: a, e, ya, ye, na, ne, ine
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

    // Default to destination if no suffix found (most common case: "ege bolgesi")
    if (!isOriginRegion && !isDestinationRegion) {
      isDestinationRegion = true;
    }

    if (isOriginRegion) {
      result.originRegion = detectedRegion;
      result.destinations = regionProvinces;
      // Set first province as origin for context
      result.origin = regionProvinces[0];
      result.originProvince = regionProvinces[0];
    } else if (isDestinationRegion) {
      result.destinationRegion = detectedRegion;
      result.destinations = regionProvinces;
      // Set first province as destination for context
      result.destination = regionProvinces[0];
      result.destinationProvince = regionProvinces[0];
    }
  }

  // Check for Istanbul side filter (Avrupa Yakası / Anadolu Yakası)
  const normalizedLower = normalized.toLowerCase();
  if (normalizedLower.includes('avrupa') && (normalizedLower.includes('yakasi') || normalizedLower.includes('yaka'))) {
    result.istanbulSide = 'european';
  } else if (normalizedLower.includes('anadolu') && (normalizedLower.includes('yakasi') || normalizedLower.includes('yaka'))) {
    result.istanbulSide = 'asian';
  }

  // Track cities found without explicit direction suffixes
  const citiesWithoutSuffix: { name: string; province: string; district?: string }[] = [];

  /**
   * Resolve a token to a province name and optionally a district name
   * Checks: abbreviations -> provinces -> districts
   * Returns { province, district? } or null
   */
  function resolveLocation(stem: string): { province: string; district?: string } | null {
    // CRITICAL: Skip common vehicle/logistics terms that happen to match district names
    // e.g., "araç" is a vehicle term but also a district in Kastamonu
    if (VEHICLE_TERMS_NOT_LOCATIONS.has(stem) || COMMON_WORDS_NOT_LOCATIONS.has(stem)) {
      return null;
    }

    // Check abbreviations first
    if (CITY_ABBREVIATIONS[stem]) {
      return { province: CITY_ABBREVIATIONS[stem] };
    }
    // Check if it's a province
    if (PROVINCE_NAMES.has(stem) || getProvinceByName(stem)) {
      return { province: stem };
    }
    // Check if it's a district - resolve to parent province AND keep district name
    if (DISTRICT_NAMES.has(stem)) {
      const districts = getDistrictsByName(stem);
      if (districts.length > 0) {
        return {
          province: normalizeToAscii(districts[0].provinceName).toLowerCase(),
          district: stem, // Keep the district name for search
        };
      }
    }
    return null;
  }

  for (const token of tokens) {
    // Clean the token (remove punctuation except apostrophe handling is in stripSuffix)
    const cleanToken = token.replace(/[?!.]/g, '');
    if (cleanToken.length < 2) continue;

    // Try to strip Turkish suffixes
    const { stem, isOrigin, isDestination } = stripSuffix(cleanToken);

    // Try to resolve the stem to a province (and optionally district)
    let location = resolveLocation(stem);

    // BUGFIX: If stem doesn't resolve but original cleanToken does, use original
    // This handles cases like "ankara" where "a" is stripped as destination suffix
    // leaving "ankar" which doesn't resolve, but "ankara" does!
    if (!location && stem !== cleanToken.toLowerCase()) {
      const originalLocation = resolveLocation(cleanToken.toLowerCase());
      if (originalLocation) {
        // Original token is a valid location - treat as location without suffix
        location = originalLocation;
        // Force it to be treated as no-suffix location
        citiesWithoutSuffix.push({ name: cleanToken.toLowerCase(), province: originalLocation.province, district: originalLocation.district });
        continue; // Skip the rest of this iteration
      }
    }

    // BUGFIX #2: If stem doesn't resolve and longer suffix was tried, try shorter suffixes
    // This handles cases like "hataya" where "ya" suffix is tried first → "hata" (invalid)
    // But "a" suffix → "hatay" (valid province!)
    // Same for origin: "manisadan" where "ndan" might be tried → "manisa" (but actually "dan" → "manisa" is correct)
    // Also handles apostrophe cases: "Aydın'a" → "aydina" → try "a" suffix → "aydin" (valid!)
    if (!location && (isOrigin || isDestination)) {
      // Remove apostrophes to match stripSuffix behavior
      const lower = cleanToken.toLowerCase().replace(/[''`']/g, '');
      // Origin suffixes sorted by length ascending (try shorter first this time)
      const originSuffixes = ['dan', 'den', 'tan', 'ten', 'ndan', 'nden'].sort((a, b) => a.length - b.length);
      // Destination suffixes sorted by length ascending
      const destSuffixes = ['a', 'e', 'ya', 'ye', 'na', 'ne'].sort((a, b) => a.length - b.length);

      const suffixesToTry = isOrigin ? originSuffixes : destSuffixes;
      console.log(`[Parser] Bugfix #2: token=${lower}, isOrigin=${isOrigin}, isDestination=${isDestination}, trying suffixes:`, suffixesToTry);
      for (const suffix of suffixesToTry) {
        if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
          const tryStem = lower.slice(0, -suffix.length);
          const tryLocation = resolveLocation(tryStem);
          console.log(`[Parser] Trying suffix "${suffix}": stem="${tryStem}", location=`, tryLocation);
          if (tryLocation) {
            location = tryLocation;
            // Keep the original direction (isOrigin/isDestination) from stripSuffix
            break;
          }
        }
      }
    }

    if (location) {
      if (isOrigin && !result.origin) {
        result.origin = location.province;
        result.originProvince = location.province;
        if (location.district) {
          result.originDistrict = location.district;
        }
      } else if (isDestination && !result.destination) {
        result.destination = location.province;
        result.destinationProvince = location.province;
        if (location.district) {
          result.destinationDistrict = location.district;
        }
      } else if (!isOrigin && !isDestination) {
        // Location without suffix - save for later processing
        citiesWithoutSuffix.push({ name: stem, province: location.province, district: location.district });
      }
    }
  }

  // Process locations without suffixes:
  // MULTI-DESTINATION PATTERNS:
  //
  // Pattern 1: Explicit origin suffix + multiple cities
  // "Samsundan istanbul ankara izmir varmi" = origin: samsun, destinations: [istanbul, ankara, izmir]
  //
  // Pattern 2: Multiple cities without ANY suffixes (3+)
  // "istanbul van izmir bursa" = origin: istanbul (first), destinations: [van, izmir, bursa] (rest)
  //
  if (result.origin && citiesWithoutSuffix.length >= 2) {
    // Pattern 1: Origin has explicit suffix, all others are destinations
    result.destinations = citiesWithoutSuffix.map(c => c.province);
    result.destination = citiesWithoutSuffix[0].province;
    result.destinationProvince = citiesWithoutSuffix[0].province;
    if (citiesWithoutSuffix[0].district) {
      result.destinationDistrict = citiesWithoutSuffix[0].district;
    }
  } else if (!result.origin && !result.destination && citiesWithoutSuffix.length >= 3) {
    // Pattern 2: No suffixes at all, 3+ cities = first is origin, rest are destinations
    const [first, ...rest] = citiesWithoutSuffix;
    result.origin = first.province;
    result.originProvince = first.province;
    if (first.district) {
      result.originDistrict = first.district;
    }
    result.destinations = rest.map(c => c.province);
    result.destination = rest[0].province;
    result.destinationProvince = rest[0].province;
    if (rest[0].district) {
      result.destinationDistrict = rest[0].district;
    }
  } else {
    // Standard processing (1-2 cities):
    // - First location without suffix = origin (if no origin already set)
    // - Second location without suffix = destination (if no destination already set)
    for (const { province, district } of citiesWithoutSuffix) {
      if (!result.origin) {
        result.origin = province;
        result.originProvince = province;
        if (district) {
          result.originDistrict = district;
        }
      } else if (!result.destination) {
        result.destination = province;
        result.destinationProvince = province;
        if (district) {
          result.destinationDistrict = district;
        }
      }
    }
  }

  // Detect same-province search (e.g., Küçükçekmece to Esenyurt - both Istanbul)
  if (result.originProvince && result.destinationProvince &&
      result.originProvince === result.destinationProvince) {
    result.sameProvinceSearch = true;
  }

  // Detect cargo type from message
  // "parça yük", "parça", "parsiyel" → parsiyel
  // "komple yük", "komple", "full" → komple
  // "palet" → palet
  if (/\bparca\s*yuk\b|\bparça\s*yük\b|\bparsiyel\b|\bparca\b|\bparça\b/i.test(normalized)) {
    result.cargoType = 'parsiyel';
  } else if (/\bkomple\s*yuk\b|\bkomple\s*yük\b|\bkomple\b|\bfull\b/i.test(normalized)) {
    result.cargoType = 'komple';
  } else if (/\bpalet\b/i.test(normalized)) {
    result.cargoType = 'palet';
  }

  return result;
}

const SYSTEM_PROMPT = `Sen lojistik is bulan bir botsun. Soforlere yuk bulmada yardim ediyorsun.

!!! EN ONEMLI KURAL - MUTLAKA UYULMALI !!!
1. Kullanici HERHANGI bir sehir adi soylediginde, MUTLAKA search_jobs cagir!
2. "su an yok abi" SADECE search_jobs cagrildiktan SONRA tool bos dondururse soylenir!
3. search_jobs CAGIRMADAN "su an yok abi" DEME! Bu yasak!
4. Sehir adi gordugun an = search_jobs cagir. Istisna yok!

search_jobs cagirdiginda, tool sonucu olarak HAZIR METIN alacaksin.
Bu metni AYNEN, KELIMESI KELIMESINE yaz. HICBIR SEY EKLEME, CIKARMA, DEGISTIRME!
- Sehir isimlerini degistirme
- Telefon numaralarini degistirme
- Kendi bilgini ekleme
- Yorum ekleme
- Baska is uydurma
Tool ne dondurduyse, ONU YAZ. Baska bir sey yazma.
Eger tool "su an yok abi" dondurduyse, sen de "su an yok abi" yaz.
Eger tool 2 is dondurduyse, o 2 isi yaz - 3. is UYDURMA!

TURKCE GRAMER:
- "-dan" veya "-den" eki = CIKIS (origin): "ankaradan" = Ankara'dan cikis
- "-a", "-e", "-ya", "-ye" eki = VARIS (destination): "ankaraya" = Ankara'ya varis

Ornekler:
- "ankaradan is var mi" → origin: ankara
- "ankaraya yuk var mi" → destination: ankara
- "izmirden ankaraya" → origin: izmir, destination: ankara
- "istanbul" (tek sehir, ek yok) → origin: istanbul
- "ankara bingol" (iki sehir yan yana) → origin: ankara, destination: bingol
- "istanbul izmir" → origin: istanbul, destination: izmir
- "gebze ankara" → origin: gebze, destination: ankara

ARAC VE KASA TIPLERI:
- "frigorifik", "frigo" → isRefrigerated: true
- "damperli", "damper" → bodyType: DAMPERLI
- "tenteli", "tente" → bodyType: TENTELI
- "tir" → vehicleType: TIR
- "kamyon" → vehicleType: KAMYON

YUK TIPLERI (cargoType):
- "parça yük", "parça", "parsiyel" → cargoType: parsiyel
- "komple yük", "komple", "full" → cargoType: komple
- "palet" → cargoType: palet

KONUSMA AKISI:

1. Sadece arac/kasa tipi verildiyse (ornek: "frigorifik is var mi"):
   → "nerden nereye bakayim abi?" de, ARAMA YAPMA

2. Sadece varis verildiyse VE onceki konusmada cikis YOKSA (ornek: "ankaraya yuk var mi"):
   → "nerden cikacak abi?" de, ARAMA YAPMA

3. Sadece varis verildiyse AMA onceki konusmada cikis VARSA:
   → Onceki cikisi kullan + yeni varisi ekle, HEMEN search_jobs cagir
   → Ornek: Once "ankara" dedi (origin=ankara), simdi "bingole is var mi" dedi
     → search_jobs(origin: "ankara", destination: "bingol") cagir

4. Sadece cikis verildiyse (ornek: "istanbul"):
   → HEMEN search_jobs cagir

5. Hem cikis hem varis verildiyse:
   → HEMEN search_jobs cagir

6. Onceki aramaya ek (ornek: once "istanbul" dedi, simdi "frigorifik var mi"):
   → Onceki origin/destination'i kullan, yeni filtreyi ekle

7. Soruya cevap veriyorsa (sen "nerden?" dedin, o "gebze" dedi):
   → HEMEN search_jobs cagir
   → ONEMLI: Konusmada onceden bahsedilen filtreleri (damperli, frigo, vb.) UNUTMA!

OZEL DURUMLAR:
- "sa" → "as"
- Konu disi → "sadece is bakarim abi, nerden nereye yaz"

KURALLAR:
- emoji yok
- kucuk harf
- search_jobs sonucunu AYNEN yaz, degistirme`;

export interface AgentOptions {
  openaiApiKey?: string;
  sql: postgres.Sql;
  conversationStore?: ConversationStore;
}

export interface AgentResponse {
  message: string;
  jobIds: string[];
  context: ConversationContext;
}

export class LogisticsAgent {
  private openai: OpenAI;
  private sql: postgres.Sql;
  private conversationStore: ConversationStore;
  private tools: ChatCompletionTool[];

  constructor(options: AgentOptions) {
    this.openai = new OpenAI({
      apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
    });
    this.sql = options.sql;
    this.conversationStore = options.conversationStore || new ConversationStore();

    this.tools = [
      searchJobsToolDefinition,
      getJobDetailsToolDefinition,
    ];
  }

  async processMessage(userId: string, userMessage: string): Promise<AgentResponse> {
    const msg = userMessage.trim().toLowerCase();
    console.log(`[Agent] Processing message from ${userId}: "${userMessage}"`);

    // Special case: "sa" greeting
    if (msg === 'sa') {
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: 'as' });
      return {
        message: 'as',
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // Handle other greetings - include Patron branding for first contact
    const conversation = await this.conversationStore.getConversation(userId);
    const isFirstMessage = !conversation || conversation.messages.length === 0;

    const greetingResponses: Record<string, string> = {
      'merhaba': isFirstMessage ? 'merhaba, ben patron. sana yuk bulmak icin buradayim. her gun yeni yukler geliyor, takipte kal. nerden nereye bakmami istersin?' : 'merhaba',
      'selam': isFirstMessage ? 'selam, ben patron. sana yuk bulmak icin buradayim. her gun yeni yukler geliyor, takipte kal. nerden nereye bakmami istersin?' : 'selam',
      'hey': 'hey',
      'hello': 'hello',
      'hi': 'hi',
      'naber': 'iyidir',
      'nasilsin': 'iyiyim',
      'iyi gunler': 'iyi gunler',
      'iyi aksamlar': 'iyi aksamlar',
    };

    for (const [greeting, response] of Object.entries(greetingResponses)) {
      if (msg === greeting) {
        await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return {
          message: response,
          jobIds: [],
          context: {} as ConversationContext,
        };
      }
    }

    // Normalize for pattern matching
    const normalizedMsg = normalizeToAscii(msg);

    // Foul language handling
    // Use word boundary matching to avoid false positives like "kocaeli" matching "oc"
    const swearWords = [
      'amk', 'aq', 'amina', 'aminakoyim', 'aminakoyayim', 'amq',
      'sikeyim', 'siktir', 'sikerim', 'siktirgit', 'sik',
      'orospu', 'orosbu', 'orospucocugu', 'orosbucocugu',
      'piç', 'pic', 'piclik',
      'yarrak', 'yarak', 'yarrак',
      'gotten', 'gotune', 'got',
      'ananı', 'anani', 'ananin', 'anana',
      'ibne', 'gavat',
    ];
    // Split message into words and check each word (not substring)
    const msgWords = normalizedMsg.split(/[\s,.']+/);
    const hasFoulLanguage = swearWords.some(swear => msgWords.includes(swear));

    if (hasFoulLanguage) {
      // Warn them politely
      const response = 'abi kufur etme, duzgun konus. is mi bakiyorsun?';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return {
        message: response,
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // Farewell patterns - respond friendly
    const farewellPatterns = ['bb', 'bay', 'bye', 'gorusuruz', 'hosca kal', 'hoscakal', 'hoscakalin'];
    if (farewellPatterns.some(p => normalizedMsg === p || normalizedMsg.startsWith(p + ' '))) {
      const response = 'gorusuruz abi, kolay gelsin';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return {
        message: response,
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // Thank you patterns
    const thankPatterns = ['sagol', 'tesekkur', 'tesekkurler', 'eyv', 'eyvallah', 'saol'];
    if (thankPatterns.some(p => normalizedMsg.includes(p))) {
      const response = 'rica ederim abi';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return {
        message: response,
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // FAQ patterns - provide helpful info instead of rejecting
    // Note: Fiyat disambiguation - check if asking about job price vs app price
    const isAskingJobPrice = normalizedMsg.includes('yuk fiyat') ||
                             normalizedMsg.includes('is fiyat') ||
                             normalizedMsg.includes('navlun') ||
                             normalizedMsg.includes('kac para') ||
                             (normalizedMsg.includes('fiyat') && (normalizedMsg.includes('yuk') || normalizedMsg.includes('is')));

    if (isAskingJobPrice) {
      const response = 'fiyatlari biz belirlemiyoruz abi, ilan sahibiyle anlasiyorsun';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return {
        message: response,
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // IMPORTANT: More specific patterns MUST come before generic ones!
    const faqHandlers: { patterns: string[]; response: string }[] = [
      // Trial period questions - MUST be before pricing (matches "ne kadar")
      {
        patterns: ['deneme suresi', 'deneme sure', 'deneme ne kadar', 'trial'],
        response: '1 hafta deneme suresi var, istedigin kadar bak.',
      },
      // Trial obligation questions
      {
        patterns: ['satin alma', 'zorunlu', 'mecbur', 'almak zorunda'],
        response: 'hayir zorunluluk yok, begenirsen devam edersin.',
      },
      // Notification requests - we don't have this feature yet
      {
        patterns: ['is olunca yaz', 'yuk olunca yaz', 'haber ver', 'bildir', 'cikinca yaz'],
        response: 'su an bildirim sistemimiz yok abi, arada bir bak.',
      },
      // How to use
      {
        patterns: ['nasil kullan', 'ne yapiyorsun', 'ne is yap', 'nasl', 'nasil calis'],
        response: 'sehir yazarsan yuk bulurum. ornegin *"istanbul"* veya *"ankara izmir"* yaz.',
      },
      // Where are there jobs - check before generic "ne kadar"
      {
        patterns: ['nere var', 'nereler var', 'yakin', 'hangi il', 'neresi'],
        response: 'nerden nereye bak dersen soylerim abi. bir sehir yaz.',
      },
      // App pricing/subscription - generic patterns at the end
      {
        patterns: ['fiyat', 'ucret', 'ne kadar', 'kac lira', 'kac tl', 'uyelik', 'abonelik', 'para'],
        response: 'uyelik aylik 1000 tl. uyelik olmadan da yuk arayabilirsin ama telefon numaralari gizli kalir. denemek icin bi sehir yaz bakalim.',
      },
    ];

    for (const { patterns, response } of faqHandlers) {
      if (patterns.some(p => normalizedMsg.includes(p))) {
        await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return {
          message: response,
          jobIds: [],
          context: {} as ConversationContext,
        };
      }
    }

    // Pagination: "digerlerini goster", "daha fazla", "devam"
    const paginationPatterns = [
      'diger', 'devam', 'daha fazla', 'sonraki', 'baska', 'daha var mi',
      'neler var', 'ne var', 'daha', 'goster', 'bakalim', 'daha goster',
      'daha bak', 'baska var mi', 'baska ne var', 'kalanlar', 'gerisi'
    ];
    const isPaginationRequest = paginationPatterns.some(p => normalizedMsg.includes(p));

    // Handle "tüm iller" / "her yere" - show all destinations from origin
    const allDestinationsPatterns = ['her yere', 'tum iller', 'turkiye geneli', 'heryere', 'her yer'];
    const isAllDestinations = allDestinationsPatterns.some(p => normalizedMsg.includes(p));

    // Check if message is logistics-related (city name, vehicle type, or follow-up)
    // Allow through if it has any logistics keyword OR if there's existing conversation context
    // Note: conversation was already fetched above for greeting handling
    const hasContext = conversation && Object.keys(conversation.context).length > 0;
    const isRelated = this.isLogisticsRelated(msg);
    console.log(`[Agent] Check: isLogisticsRelated=${isRelated}, hasContext=${hasContext}, isPagination=${isPaginationRequest}`, { context: conversation?.context });

    // Handle pagination request - use previous search with offset
    if (isPaginationRequest && hasContext && conversation?.context.lastTotalCount) {
      const ctx = conversation.context;
      const currentOffset = (ctx.lastOffset || 0) + (ctx.lastShownCount || 5);

      // Check if there are more results
      if (currentOffset >= (ctx.lastTotalCount || 0)) {
        const response = 'hepsini gosterdim abi, baska bi sey yok';
        await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return {
          message: response,
          jobIds: [],
          context: {} as ConversationContext,
        };
      }

      // Search with offset - ONLY use origin/destination, ignore old filters to prevent corruption
      const params: SearchJobsParams = {
        limit: 10,
        offset: currentOffset,
      };
      // Only use origin and destination from context - filters often get corrupted
      if (ctx.lastOrigin) params.origin = ctx.lastOrigin;
      if (ctx.lastDestination) params.destination = ctx.lastDestination;
      // NOTE: Deliberately NOT using vehicle/body/refrigerated filters from context
      // These often get corrupted by GPT misinterpretation of conversation history

      console.log(`[Agent] Pagination: offset=${currentOffset}, total=${ctx.lastTotalCount}`, { params });

      const result = await searchJobs(this.sql, params);
      const formattedResults = this.formatJobsAsText(result.jobs, params);

      let response = formattedResults;
      const remaining = (ctx.lastTotalCount || 0) - currentOffset - result.jobs.length;
      if (remaining > 0) {
        response += `\n\nhint: ${remaining} is daha var, *"devam"* yaz gosteririm.`;
      }

      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(
        userId,
        { role: 'assistant', content: response },
        { lastOffset: currentOffset, lastShownCount: result.jobs.length }
      );

      return {
        message: response,
        jobIds: result.jobs.map(j => j.id),
        context: {} as ConversationContext,
      };
    }

    // Handle "her yere" / "tüm iller" - search with origin only (no destination filter)
    if (isAllDestinations) {
      // Try to get origin from the message itself first (e.g., "istanbuldan her yere")
      const parsedFromMsg = parseLocationsFromMessage(userMessage);
      const origin = parsedFromMsg.origin || conversation?.context.lastOrigin;

      if (origin) {
        const params: SearchJobsParams = {
          origin: origin,
          // destination deliberately not set - search all destinations
          limit: 10,
        };
        // NOTE: Not using filters from context for "her yere" - fresh search

        console.log(`[Agent] "Her yere" search from ${origin}`, { params });

        const result = await searchJobs(this.sql, params);
        const formattedResults = this.formatJobsAsText(result.jobs, params);

        let response = formattedResults;
        if (result.totalCount > result.jobs.length) {
          response += `\n\nhint: ${origin}'den toplam ${result.totalCount} is var, *"devam"* yaz daha fazla gosteririm.`;
        }

        await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
        // Clear destination for "her yere" by setting empty string (DynamoDB doesn't accept undefined)
        await this.conversationStore.addMessage(
          userId,
          { role: 'assistant', content: response },
          {
            lastOrigin: origin,
            lastDestination: '', // Empty string to clear destination
            lastVehicleType: '', // Clear vehicle filter
            lastBodyType: '', // Clear body filter
            lastCargoType: '', // Clear cargo filter
            lastTotalCount: result.totalCount,
            lastOffset: 0,
            lastShownCount: result.jobs.length,
          }
        );

        return {
          message: response,
          jobIds: result.jobs.map(j => j.id),
          context: {} as ConversationContext,
        };
      } else {
        // No origin found - ask for it
        const response = 'nerden cikacak abi? bir sehir yaz';
        await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return {
          message: response,
          jobIds: [],
          context: {} as ConversationContext,
        };
      }
    }

    if (!isRelated && !hasContext && !isPaginationRequest && !isAllDestinations) {
      const response = 'sadece is bakarim abi, nerden nereye yaz';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return {
        message: response,
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // Pre-parse Turkish location suffixes to ensure correct origin/destination extraction
    // This fixes cases like "Kayseri'den İstanbul'a" where GPT might miss the destination
    const parsedLocations = parseLocationsFromMessage(userMessage);

    // Handle "X ici" / "X icinde" - intra-city search (same origin and destination)
    // IMPORTANT: Use word boundaries to avoid matching "için" (Turkish for "for")
    // "ici" means "inside", "için" means "for" - very different meanings!
    const intraCityRegex = /\bici\b|\bicinde\b|\bicinden\b/i;
    const isIntraCitySearch = intraCityRegex.test(normalizedMsg);

    if (isIntraCitySearch && (parsedLocations.origin || conversation?.context.lastOrigin)) {
      const city = parsedLocations.origin || conversation?.context.lastOrigin;

      // Search for jobs where origin = destination = same city
      const params: SearchJobsParams = {
        origin: city,
        destination: city,
        limit: 10,
      };

      console.log(`[Agent] Intra-city search for ${city}`, { params });

      const result = await searchJobs(this.sql, params);

      let response: string;
      let finalOrigin = city;
      let finalDestination: string | undefined = city;
      let finalJobs = result.jobs;
      let finalTotalCount = result.totalCount;

      if (result.jobs.length === 0) {
        // No intra-city jobs, proactively search inter-city FROM this city
        const interCityParams: SearchJobsParams = {
          origin: city,
          limit: 10,
        };
        const interCityResult = await searchJobs(this.sql, interCityParams);

        if (interCityResult.jobs.length > 0) {
          response = `${city} ici is yok abi, sehir ici yuk cok nadir. ama ${city}'dan cikan isler var:\n\n`;
          response += this.formatJobsAsText(interCityResult.jobs, interCityParams);
          finalDestination = undefined;
          finalJobs = interCityResult.jobs;
          finalTotalCount = interCityResult.totalCount;
          if (interCityResult.totalCount > interCityResult.jobs.length) {
            response += `\n\nhint: ${city}'dan ${interCityResult.totalCount} is var, *"devam"* yaz daha fazla gosteririm.`;
          }
        } else {
          response = `${city} ici ve ${city}'dan cikan is yok su an abi.`;
        }
      } else {
        response = this.formatJobsAsText(result.jobs, params);
        if (result.totalCount > result.jobs.length) {
          response += `\n\nhint: ${city} icinde ${result.totalCount} is var, *"devam"* yaz daha fazla gosteririm.`;
        }
      }

      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(
        userId,
        { role: 'assistant', content: response },
        {
          lastOrigin: finalOrigin,
          lastDestination: finalDestination,
          lastTotalCount: finalTotalCount,
          lastOffset: 0,
          lastShownCount: finalJobs.length,
        }
      );

      return {
        message: response,
        jobIds: finalJobs.map(j => j.id),
        context: {} as ConversationContext,
      };
    }

    // Handle same-province search (e.g., Küçükçekmece to Esenyurt - both Istanbul)
    // Actually search but warn that intra-city jobs are rare
    if (parsedLocations.sameProvinceSearch && parsedLocations.originProvince) {
      const city = parsedLocations.originProvince;

      // Search for jobs where origin = destination = same city
      const params: SearchJobsParams = {
        origin: city,
        destination: city,
        limit: 10,
      };

      console.log(`[Agent] Same-province search for ${city}`, { params });

      const result = await searchJobs(this.sql, params);

      let response: string;
      let finalOrigin = city;
      let finalDestination: string | undefined = city;
      let finalJobs = result.jobs;
      let finalTotalCount = result.totalCount;

      if (result.jobs.length === 0) {
        // No intra-city jobs, proactively search inter-city FROM this city
        const interCityParams: SearchJobsParams = {
          origin: city,
          limit: 10,
        };
        const interCityResult = await searchJobs(this.sql, interCityParams);

        if (interCityResult.jobs.length > 0) {
          response = `${city} ici is yok abi, sehir ici yuk cok nadir. ama ${city}'dan cikan isler var:\n\n`;
          response += this.formatJobsAsText(interCityResult.jobs, interCityParams);
          finalDestination = undefined;
          finalJobs = interCityResult.jobs;
          finalTotalCount = interCityResult.totalCount;
          if (interCityResult.totalCount > interCityResult.jobs.length) {
            response += `\n\nhint: ${city}'dan ${interCityResult.totalCount} is var, *"devam"* yaz daha fazla gosteririm.`;
          }
        } else {
          response = `${city} ici ve ${city}'dan cikan is yok su an abi.`;
        }
      } else {
        response = this.formatJobsAsText(result.jobs, params);
        if (result.totalCount > result.jobs.length) {
          response += `\n\nhint: ${city} icinde ${result.totalCount} is var, *"devam"* yaz daha fazla gosteririm.`;
        }
      }

      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(
        userId,
        { role: 'assistant', content: response },
        {
          lastOrigin: finalOrigin,
          lastDestination: finalDestination,
          lastTotalCount: finalTotalCount,
          lastOffset: 0,
          lastShownCount: finalJobs.length,
        }
      );

      return {
        message: response,
        jobIds: finalJobs.map(j => j.id),
        context: {} as ConversationContext,
      };
    }

    // Handle region-based search (e.g., "istanbuldan ege bolgesine")
    // Search for jobs from origin to each province in the destination region
    if (parsedLocations.destinationRegion && parsedLocations.destinations && parsedLocations.destinations.length > 0) {
      // Get origin from parsed message or context
      const origin = parsedLocations.origin || conversation?.context.lastOrigin;
      const regionName = parsedLocations.destinationRegion;
      const destinations = parsedLocations.destinations;

      if (!origin) {
        // Need origin to search region
        const response = `nerden cikacak abi? ${regionName} bolgesine arama yapmak icin bir sehir yaz`;
        await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return {
          message: response,
          jobIds: [],
          context: {} as ConversationContext,
        };
      }

      console.log(`[Agent] Region search: ${origin} → ${regionName} bolgesi (${destinations.length} il)`);

      // Search for each province in the region
      const allJobs: JobResult[] = [];
      const jobsByDestination: Map<string, JobResult[]> = new Map();
      const jobCounts: Map<string, number> = new Map();

      for (const dest of destinations) {
        const params: SearchJobsParams = {
          origin,
          destination: dest,
          limit: 3, // Limit per province to show variety
        };
        const result = await searchJobs(this.sql, params);
        jobCounts.set(dest, result.totalCount);
        if (result.jobs.length > 0) {
          jobsByDestination.set(dest, result.jobs);
          allJobs.push(...result.jobs);
        }
      }

      let response: string;
      if (allJobs.length === 0) {
        response = `${origin}'dan ${regionName} bolgesine is yok su an abi.`;
      } else {
        // Format results grouped by destination
        const sections: string[] = [];
        for (const dest of destinations) {
          const jobs = jobsByDestination.get(dest);
          const totalCount = jobCounts.get(dest) || 0;
          if (jobs && jobs.length > 0) {
            let sectionHeader = `${origin} → ${dest}`;
            if (totalCount > jobs.length) {
              sectionHeader += ` (${totalCount} is var, ${jobs.length} gosteriyorum)`;
            }
            sections.push(`${sectionHeader}:\n${this.formatJobsAsText(jobs)}`);
          }
        }
        response = `${origin}'dan ${regionName} bolgesi:\n\n${sections.join('\n\n')}`;

        // Add summary of provinces with no jobs
        const emptyDests = destinations.filter(d => !jobsByDestination.has(d) || jobsByDestination.get(d)!.length === 0);
        if (emptyDests.length > 0 && emptyDests.length < destinations.length) {
          response += `\n\nnot: ${emptyDests.slice(0, 5).join(', ')}${emptyDests.length > 5 ? ` ve ${emptyDests.length - 5} il daha` : ''} yonune is yok.`;
        }
      }

      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(
        userId,
        { role: 'assistant', content: response },
        {
          lastOrigin: origin,
          lastDestination: undefined, // Region search, no single destination
          lastTotalCount: allJobs.length,
          lastOffset: 0,
          lastShownCount: allJobs.length,
        }
      );

      return {
        message: response,
        jobIds: allJobs.map(j => j.id),
        context: {} as ConversationContext,
      };
    }

    // Handle origin region search (e.g., "ege bolgesinden istanbula")
    if (parsedLocations.originRegion && parsedLocations.destinations && parsedLocations.destinations.length > 0) {
      const regionName = parsedLocations.originRegion;
      const origins = parsedLocations.destinations;
      // Get destination from parsed message or context
      const destination = parsedLocations.destination || conversation?.context.lastDestination;

      console.log(`[Agent] Origin region search: ${regionName} bolgesi → ${destination || 'tum iller'} (${origins.length} il)`);

      // Search for each province in the region
      const allJobs: JobResult[] = [];
      const jobsByOrigin: Map<string, JobResult[]> = new Map();
      const jobCounts: Map<string, number> = new Map();

      for (const orig of origins) {
        const params: SearchJobsParams = {
          origin: orig,
          destination: destination,
          limit: 3, // Limit per province to show variety
        };
        const result = await searchJobs(this.sql, params);
        jobCounts.set(orig, result.totalCount);
        if (result.jobs.length > 0) {
          jobsByOrigin.set(orig, result.jobs);
          allJobs.push(...result.jobs);
        }
      }

      let response: string;
      if (allJobs.length === 0) {
        response = destination
          ? `${regionName} bolgesinden ${destination}'a is yok su an abi.`
          : `${regionName} bolgesinden cikan is yok su an abi.`;
      } else {
        // Format results grouped by origin
        const sections: string[] = [];
        for (const orig of origins) {
          const jobs = jobsByOrigin.get(orig);
          const totalCount = jobCounts.get(orig) || 0;
          if (jobs && jobs.length > 0) {
            let sectionHeader = destination ? `${orig} → ${destination}` : `${orig}'den`;
            if (totalCount > jobs.length) {
              sectionHeader += ` (${totalCount} is var, ${jobs.length} gosteriyorum)`;
            }
            sections.push(`${sectionHeader}:\n${this.formatJobsAsText(jobs)}`);
          }
        }
        response = destination
          ? `${regionName} bolgesinden ${destination}'a:\n\n${sections.join('\n\n')}`
          : `${regionName} bolgesinden:\n\n${sections.join('\n\n')}`;

        // Add summary of provinces with no jobs
        const emptyOrigins = origins.filter(o => !jobsByOrigin.has(o) || jobsByOrigin.get(o)!.length === 0);
        if (emptyOrigins.length > 0 && emptyOrigins.length < origins.length) {
          response += `\n\nnot: ${emptyOrigins.slice(0, 5).join(', ')}${emptyOrigins.length > 5 ? ` ve ${emptyOrigins.length - 5} il daha` : ''}'den is yok.`;
        }
      }

      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(
        userId,
        { role: 'assistant', content: response },
        {
          lastOrigin: undefined, // Region search, no single origin
          lastDestination: destination,
          lastTotalCount: allJobs.length,
          lastOffset: 0,
          lastShownCount: allJobs.length,
        }
      );

      return {
        message: response,
        jobIds: allJobs.map(j => j.id),
        context: {} as ConversationContext,
      };
    }

    // Handle multi-destination search (e.g., "Samsundan istanbul ankara izmir varmi")
    // Search for jobs from origin to each destination and combine results
    if (parsedLocations.destinations && parsedLocations.destinations.length >= 2 && parsedLocations.origin && !parsedLocations.destinationRegion) {
      const origin = parsedLocations.origin;
      const destinations = parsedLocations.destinations;

      console.log(`[Agent] Multi-destination search: ${origin} → [${destinations.join(', ')}]`);

      // Search for each destination
      const allJobs: JobResult[] = [];
      const jobsByDestination: Map<string, JobResult[]> = new Map();

      for (const dest of destinations) {
        const params: SearchJobsParams = {
          origin,
          destination: dest,
          limit: 5, // Limit per destination to avoid too many results
        };
        const result = await searchJobs(this.sql, params);
        if (result.jobs.length > 0) {
          jobsByDestination.set(dest, result.jobs);
          allJobs.push(...result.jobs);
        }
      }

      let response: string;
      if (allJobs.length === 0) {
        response = `${origin}'dan ${destinations.join(', ')} yonune is yok su an abi.`;
      } else {
        // Format results grouped by destination
        const sections: string[] = [];
        for (const dest of destinations) {
          const jobs = jobsByDestination.get(dest);
          if (jobs && jobs.length > 0) {
            sections.push(`${origin} → ${dest}:\n${this.formatJobsAsText(jobs)}`);
          }
        }
        response = sections.join('\n\n');

        // Add hint about destinations with no jobs
        const emptyDests = destinations.filter(d => !jobsByDestination.has(d) || jobsByDestination.get(d)!.length === 0);
        if (emptyDests.length > 0) {
          response += `\n\nnot: ${emptyDests.join(', ')} yonune is yok su an.`;
        }
      }

      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(
        userId,
        { role: 'assistant', content: response },
        {
          lastOrigin: origin,
          lastDestination: undefined, // Multiple destinations, don't set single
          lastTotalCount: allJobs.length,
          lastOffset: 0,
          lastShownCount: allJobs.length,
        }
      );

      return {
        message: response,
        jobIds: allJobs.map(j => j.id),
        context: {} as ConversationContext,
      };
    }

    // Build messages with conversation history and parsed locations
    const messages = this.buildMessages(conversation, userMessage, parsedLocations);

    // Call OpenAI with tools
    // Force search_jobs when location is detected to prevent GPT from making up "su an yok abi"
    const hasLocation = parsedLocations.origin || parsedLocations.destination;
    const toolChoice = hasLocation
      ? { type: 'function' as const, function: { name: 'search_jobs' } }
      : 'auto' as const;

    console.log(`[Agent] Calling GPT with tool_choice=${hasLocation ? 'search_jobs (forced)' : 'auto'}`);

    let response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: this.tools,
      tool_choice: toolChoice,
      temperature: 0,
      max_tokens: 1000,
    });

    let assistantMessage = response.choices[0].message;
    const collectedJobIds: string[] = [];
    // BUGFIX: Initialize with existing conversation context so "varmi" uses previous search
    let contextUpdate: Partial<ConversationContext> = conversation?.context ? { ...conversation.context } : {};
    let searchResultText: string | null = null; // Direct result to bypass GPT hallucination

    console.log(`[Agent] GPT response - tool_calls: ${assistantMessage.tool_calls?.length || 0}, content: ${assistantMessage.content?.substring(0, 100) || 'none'}`);

    // Handle tool calls in a loop
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      // Process each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolResult = await this.executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          collectedJobIds,
          contextUpdate,
          parsedLocations // Pass pre-parsed locations to enforce correct values
        );

        // If this was a search, capture the direct result
        if (toolCall.function.name === 'search_jobs' && toolResult.directResponse) {
          searchResultText = toolResult.directResponse;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.data),
        });

        // Update context from tool execution
        contextUpdate = { ...contextUpdate, ...toolResult.contextUpdate };
      }

      // If we have a direct search result, DON'T ask GPT - use it directly
      if (searchResultText) {
        break;
      }

      // Get next response (auto choice so it can respond with text)
      response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: this.tools,
        tool_choice: 'auto',
        temperature: 0,
        max_tokens: 1000,
      });

      assistantMessage = response.choices[0].message;
    }

    // Use direct search result if available, otherwise use GPT's response
    const finalMessage = searchResultText || assistantMessage.content || 'Üzgünüm, bir hata oluştu.';

    // Save conversation
    await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
    await this.conversationStore.addMessage(
      userId,
      { role: 'assistant', content: finalMessage },
      { ...contextUpdate, lastJobIds: collectedJobIds }
    );

    return {
      message: finalMessage,
      jobIds: collectedJobIds,
      context: contextUpdate as ConversationContext,
    };
  }

  private buildMessages(
    conversation: Conversation | null,
    userMessage: string,
    parsedLocations?: ParsedLocations
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add pre-parsed location info if available
    // This helps GPT correctly interpret Turkish suffixes
    if (parsedLocations && (parsedLocations.origin || parsedLocations.destination)) {
      const locationInfo: string[] = [];
      if (parsedLocations.origin) {
        locationInfo.push(`CIKIS (origin): ${parsedLocations.origin}`);
      }
      if (parsedLocations.destination) {
        locationInfo.push(`VARIS (destination): ${parsedLocations.destination}`);
      }
      messages.push({
        role: 'system',
        content: `!!! ONEMLI - Kullanicinin mesajindan tespit edilen lokasyonlar:\n${locationInfo.join('\n')}\nBu bilgileri search_jobs cagirirken MUTLAKA kullan!`,
      });
    }

    // Add conversation history
    if (conversation) {
      // Include context summary if available
      // BUT if user is doing a new search (new locations), only include location context, not filters
      if (Object.keys(conversation.context).length > 0) {
        const isNewSearch = Boolean(
          (parsedLocations?.origin && parsedLocations.origin !== conversation.context.lastOrigin) ||
          (parsedLocations?.destination && parsedLocations.destination !== conversation.context.lastDestination)
        );
        const contextSummary = this.buildContextSummary(conversation.context, isNewSearch);
        if (contextSummary !== 'Yok') {
          messages.push({
            role: 'system',
            content: `Önceki arama bağlamı: ${contextSummary}`,
          });
        }
      }

      // Add recent messages (last 10 for context)
      const recentMessages = conversation.messages.slice(-10);
      for (const msg of recentMessages) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  private buildContextSummary(context: ConversationContext, isNewSearch: boolean = false): string {
    const parts: string[] = [];

    // Always include location context
    if (context.lastOrigin) {
      parts.push(`Kalkış: ${context.lastOrigin}`);
    }
    if (context.lastDestination) {
      parts.push(`Varış: ${context.lastDestination}`);
    }

    // Only include filter context if NOT a new search (user isn't providing new locations)
    if (!isNewSearch) {
      if (context.lastVehicleType) {
        parts.push(`Araç: ${context.lastVehicleType}`);
      }
      if (context.lastBodyType) {
        parts.push(`Kasa: ${context.lastBodyType}`);
      }
      if (context.lastIsRefrigerated) {
        parts.push(`Frigorifik: evet`);
      }
      if (context.lastCargoType) {
        parts.push(`Yük: ${context.lastCargoType}`);
      }
    }

    return parts.length > 0 ? parts.join(', ') : 'Yok';
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    collectedJobIds: string[],
    currentContext: Partial<ConversationContext>,
    parsedLocations?: ParsedLocations
  ): Promise<{ data: unknown; contextUpdate: Partial<ConversationContext>; directResponse?: string }> {
    const contextUpdate: Partial<ConversationContext> = {};
    console.log(`[Agent] executeTool: ${name}`, { args, currentContext, parsedLocations });

    if (name === 'search_jobs') {
      const params: SearchJobsParams = {
        origin: args.origin as string | undefined,
        destination: args.destination as string | undefined,
        originDistrict: args.originDistrict as string | undefined,
        destinationDistrict: args.destinationDistrict as string | undefined,
        vehicleType: args.vehicleType as string | undefined,
        bodyType: args.bodyType as string | undefined,
        cargoType: args.cargoType as string | undefined,
        isRefrigerated: args.isRefrigerated as boolean | undefined,
        isUrgent: args.isUrgent as boolean | undefined,
        limit: (args.limit as number) || 10, // Show 10 by default
      };

      // Check for international destinations first
      if (parsedLocations?.internationalDestination) {
        const country = parsedLocations.internationalDestination;
        const origin = parsedLocations?.origin || params.origin;
        const msg = origin
          ? `${origin}'dan ${country}'a yurt disi yukler bakamiyorum abi, sadece Turkiye ici is bakiyorum.`
          : `${country}'a yurt disi yukler bakamiyorum abi, sadece Turkiye ici is bakiyorum.`;
        return {
          data: 'International destination',
          contextUpdate: {},
          directResponse: msg,
        };
      }

      // CRITICAL: ALWAYS use pre-parsed locations - they're more reliable than GPT
      // GPT often misinterprets conversation history and uses wrong origin/destination
      if (parsedLocations?.origin) {
        params.origin = parsedLocations.origin; // Always override GPT
      }
      if (parsedLocations?.destination) {
        params.destination = parsedLocations.destination; // Always override GPT
      }
      // Also set district parameters from parsed locations
      if (parsedLocations?.originDistrict) {
        params.originDistrict = parsedLocations.originDistrict;
      }
      if (parsedLocations?.destinationDistrict) {
        params.destinationDistrict = parsedLocations.destinationDistrict;
      }
      // Use pre-parsed cargo type (parsiyel, palet, komple)
      if (parsedLocations?.cargoType) {
        params.cargoType = parsedLocations.cargoType;
      }

      // If user only mentioned origin (no destination), CLEAR any destination GPT added
      // This prevents GPT from using old destinations from conversation history
      if (parsedLocations?.origin && !parsedLocations?.destination) {
        params.destination = undefined;
      }
      // Same for destination-only queries
      if (parsedLocations?.destination && !parsedLocations?.origin) {
        params.origin = undefined;
      }

      // Detect if this is a NEW search (user provided new locations) vs a filter addition
      // If user gives new origin/destination, DON'T carry over vehicle/body type from context
      const locationChanged = (parsedLocations?.origin && parsedLocations.origin !== currentContext.lastOrigin) ||
                              (parsedLocations?.destination && parsedLocations.destination !== currentContext.lastDestination);

      // Also consider it a "new search" if user repeats the same route WITHOUT specifying filters
      // This allows users to "reset" their search by just typing the route again
      const hasFiltersInCurrentMessage = Boolean(params.vehicleType || params.bodyType || params.cargoType || params.isRefrigerated);
      const sameRouteNoFilters = !locationChanged && (parsedLocations?.origin || parsedLocations?.destination) && !hasFiltersInCurrentMessage;
      const isNewSearch = locationChanged || sameRouteNoFilters;

      // Apply context from previous search ONLY if doing a follow-up (not a new search)
      if (!params.origin && currentContext.lastOrigin) {
        params.origin = currentContext.lastOrigin;
      }
      if (!params.destination && currentContext.lastDestination) {
        params.destination = currentContext.lastDestination;
      }

      // Only apply vehicle/body filters from context if NOT a new search
      // This ensures filters are CLEARED when user repeats the same route without filters
      if (!isNewSearch) {
        if (!params.vehicleType && currentContext.lastVehicleType) {
          params.vehicleType = currentContext.lastVehicleType;
        }
        if (!params.bodyType && currentContext.lastBodyType) {
          params.bodyType = currentContext.lastBodyType;
        }
        if (params.isRefrigerated === undefined && currentContext.lastIsRefrigerated !== undefined) {
          params.isRefrigerated = currentContext.lastIsRefrigerated;
        }
      }

      // Kamyonet weight filter: Auto-limit to 3.5 ton max
      // Kamyonets are small trucks that can't carry heavy loads
      if (params.vehicleType?.toLowerCase() === 'kamyonet') {
        params.maxWeight = 3.5;
      }

      let result = await searchJobs(this.sql, params);
      console.log(`[Agent] searchJobs result: ${result.jobs.length} jobs, total: ${result.totalCount}`, { params });

      // Apply Istanbul side filter if specified (Avrupa/Anadolu Yakası)
      if (parsedLocations?.istanbulSide && result.jobs.length > 0) {
        const sideDistricts = parsedLocations.istanbulSide === 'european'
          ? ISTANBUL_EUROPEAN_DISTRICTS
          : ISTANBUL_ASIAN_DISTRICTS;
        const sideName = parsedLocations.istanbulSide === 'european' ? 'avrupa yakasi' : 'anadolu yakasi';

        const filteredJobs = result.jobs.filter(job => {
          // Check if origin is Istanbul and district matches the side
          const originIsIstanbul = job.originProvince?.toLowerCase() === 'istanbul';
          const destIsIstanbul = job.destinationProvince?.toLowerCase() === 'istanbul';

          if (originIsIstanbul && params.origin?.toLowerCase() === 'istanbul') {
            // Filter by origin district
            const originDistrict = job.originDistrict?.toLowerCase().replace(/[^a-z]/g, '');
            return originDistrict && sideDistricts.has(originDistrict);
          }
          if (destIsIstanbul && params.destination?.toLowerCase() === 'istanbul') {
            // Filter by destination district
            const destDistrict = job.destinationDistrict?.toLowerCase().replace(/[^a-z]/g, '');
            return destDistrict && sideDistricts.has(destDistrict);
          }
          // If neither origin nor destination is Istanbul with side filter, include the job
          return true;
        });

        console.log(`[Agent] Istanbul ${sideName} filter: ${result.jobs.length} -> ${filteredJobs.length} jobs`);
        result = { ...result, jobs: filteredJobs, totalCount: filteredJobs.length };
      }

      // Fallback for parsiyel: if no parsiyel jobs found, search without cargo filter
      // and tell user to call and ask about parsiyel
      let parsiyeFallback = false;
      if (result.jobs.length === 0 && params.cargoType === 'parsiyel' && (params.origin || params.destination)) {
        // Re-search without cargoType filter
        const fallbackParams = { ...params, cargoType: undefined };
        const fallbackResult = await searchJobs(this.sql, fallbackParams);
        console.log(`[Agent] parsiyel fallback: ${fallbackResult.jobs.length} jobs without cargo filter`);

        if (fallbackResult.jobs.length > 0) {
          result = fallbackResult;
          parsiyeFallback = true;
        }
      }

      // Update context - use empty string to clear values (DynamoDB doesn't accept undefined)
      contextUpdate.lastOrigin = params.origin || '';
      contextUpdate.lastDestination = params.destination || '';
      contextUpdate.lastVehicleType = params.vehicleType || '';
      contextUpdate.lastBodyType = params.bodyType || '';
      contextUpdate.lastIsRefrigerated = params.isRefrigerated ?? false; // Default to false, not undefined
      contextUpdate.lastCargoType = parsiyeFallback ? '' : (params.cargoType || ''); // Don't save cargoType if we did fallback

      // Pagination context
      contextUpdate.lastTotalCount = result.totalCount;
      contextUpdate.lastOffset = 0;
      contextUpdate.lastShownCount = result.jobs.length;

      // Collect job IDs
      for (const job of result.jobs) {
        collectedJobIds.push(job.id);
      }

      // Format results as text in CODE to prevent GPT hallucination
      // Pass params for specific "no results" messages
      const formattedResults = this.formatJobsAsText(result.jobs, parsiyeFallback ? { ...params, cargoType: undefined } : params);

      // Always show total count from database
      const shownCount = result.jobs.length;

      // Build the direct response text (what user sees)
      let directResponse = '';

      // If parsiyel fallback was used, add a note
      if (parsiyeFallback) {
        directResponse = 'parsiyel olarak isaretlenmis is bulamadim abi, ama su isler var - numaralari arayip parsiyel var mi diye sorabilirsin:\n\n';
      }

      directResponse += formattedResults;

      // Show hint with total unique count and pagination option
      if (result.totalCount > shownCount) {
        directResponse += `\n\nhint: toplamda ${result.totalCount} is var, ${shownCount} tane gosteriyorum. *"devam"* yaz daha fazla gosteririm.`;
      }

      // Return with directResponse - this bypasses GPT entirely for the response
      return {
        data: `Found ${shownCount} jobs`, // Minimal data for tool response
        contextUpdate,
        directResponse, // This will be used as the final response, bypassing GPT
      };
    }

    if (name === 'get_job_details') {
      const jobId = args.jobId as string;
      const job = await getJobById(this.sql, jobId);

      if (job) {
        collectedJobIds.push(job.id);
        return {
          data: this.formatJobForAgent(job),
          contextUpdate,
        };
      }

      return {
        data: { error: 'İş bulunamadı' },
        contextUpdate,
      };
    }

    return {
      data: { error: 'Bilinmeyen araç' },
      contextUpdate,
    };
  }

  /**
   * Check if the message is logistics-related.
   * Uses shared constants for provinces (81) and districts (1100+) instead of hardcoded lists.
   */
  private isLogisticsRelated(text: string): boolean {
    // Vehicle types, body types, and logistics keywords (keep these hardcoded - they're fixed)
    const logisticsKeywords = [
      // Vehicle types
      'tir', 'kamyon', 'kamyonet', 'dorse', 'cekici', 'treyler',
      // Body types
      'frigorifik', 'frigo', 'frigolu', 'sogutuculu', 'soguk',
      'damperli', 'damper',
      'tenteli', 'tente', 'tentesiz',
      'kapali', 'kapakli', 'acik', 'kasali',
      'lowbed', 'platform', 'sal',
      // Cargo/load keywords
      'yuk', 'is', 'ilan', 'sefer', 'mal', 'palet', 'ton', 'kilo',
      'parca', 'parça', 'parsiyel', 'komple',
      // Action keywords
      'ariyorum', 'lazim', 'var mi', 'varmi', 'istiyorum', 'bakiyorum',
      // "All destinations" keywords
      'her yere', 'tum iller', 'turkiye geneli', 'heryere', 'her yer',
    ];

    // Use shared normalizeToAscii for consistent Turkish character handling
    const normalized = normalizeToAscii(text);

    // Check for logistics keywords first (fast)
    if (logisticsKeywords.some(keyword => normalized.includes(keyword))) {
      return true;
    }

    // Split into tokens and check each against locations (including hyphen/dash as separator)
    const tokens = normalized.split(/[\s,\-–—]+/);

    for (const token of tokens) {
      // Clean token
      const cleanToken = token.replace(/[?!.'"]/g, '');
      if (cleanToken.length < 2) continue;

      // Strip Turkish suffixes to get the stem
      const { stem } = stripSuffix(cleanToken);

      // CRITICAL: Skip vehicle terms and common words that happen to match district names
      if (VEHICLE_TERMS_NOT_LOCATIONS.has(stem) || COMMON_WORDS_NOT_LOCATIONS.has(stem)) {
        continue;
      }

      // Check abbreviations (ist, ank, etc.)
      if (CITY_ABBREVIATIONS[stem]) {
        return true;
      }

      // Check if it's a province (O(1) lookup via Set)
      if (PROVINCE_NAMES.has(stem)) {
        return true;
      }

      // Check province aliases (antep -> gaziantep, maras -> kahramanmaras, etc.)
      if (getProvinceByName(stem)) {
        return true;
      }

      // Check if it's a district (O(1) lookup via Set) - 1100+ districts
      if (DISTRICT_NAMES.has(stem)) {
        return true;
      }
    }

    return false;
  }

  private formatJobForAgent(job: JobResult): Record<string, unknown> {
    return {
      id: job.id,
      origin: job.originProvince,
      destination: job.destinationProvince,
      vehicleType: job.vehicleType,
      bodyType: job.bodyType,
      cargoType: job.cargoType,
      weight: job.weight ? `${Number(job.weight) % 1 === 0 ? Number(job.weight).toFixed(0) : job.weight} ${job.weightUnit || 'ton'}` : null,
      isRefrigerated: job.isRefrigerated,
      isUrgent: job.isUrgent,
      contactPhone: job.contactPhone,
      contactName: job.contactName,
      postedAt: job.postedAt?.toISOString(),
    };
  }

  /**
   * Format jobs as ready-to-display text to prevent GPT hallucination.
   * This generates the exact output that should be shown to the user.
   * When no results, provides specific message based on search filters.
   */
  private formatJobsAsText(jobs: JobResult[], params?: SearchJobsParams): string {
    if (jobs.length === 0) {
      // Generate specific "yok" message based on search filters
      return this.formatNoResultsMessage(params);
    }

    const lines: string[] = [];

    for (const job of jobs) {
      const parts: string[] = [];

      // Origin - Destination (include district if available)
      let origin = job.originProvince?.toLowerCase() || 'bilinmiyor';
      if (job.originDistrict) {
        origin = `${job.originDistrict.toLowerCase()}/${origin}`;
      }
      let destination = job.destinationProvince?.toLowerCase() || '(varis belirtilmemis)';
      if (job.destinationDistrict) {
        destination = `${job.destinationDistrict.toLowerCase()}/${destination}`;
      }
      parts.push(`${origin} - ${destination}`);

      // Details array
      const details: string[] = [];

      // Weight - skip if null, undefined, or zero
      if (job.weight && Number(job.weight) > 0) {
        const unit = job.weightUnit?.toLowerCase() || 'ton';
        // Format weight: remove trailing zeros (8.00 -> 8, 8.50 -> 8.5)
        const weightNum = Number(job.weight);
        const weightFormatted = weightNum % 1 === 0 ? weightNum.toFixed(0) : weightNum.toString().replace(/\.?0+$/, '');
        details.push(`${weightFormatted} ${unit}`);
      }

      // Cargo type
      if (job.cargoType) {
        details.push(job.cargoType.toLowerCase());
      }

      // Vehicle type
      if (job.vehicleType) {
        details.push(job.vehicleType.toLowerCase());
      }

      // Body type (damperli, tenteli, etc.)
      if (job.bodyType) {
        const bodyTypeLower = job.bodyType.toLowerCase();
        // Convert ACIK_KASA to "acik kasa" etc.
        details.push(bodyTypeLower.replace(/_/g, ' '));
      }

      // Refrigerated
      if (job.isRefrigerated) {
        details.push('frigorifik');
      }

      // Urgent
      if (job.isUrgent) {
        details.push('acil');
      }

      // Add details to parts
      if (details.length > 0) {
        parts.push(details.join(', '));
      }

      // Phone number
      if (job.contactPhone) {
        parts.push(`tel: ${job.contactPhone}`);
      }

      lines.push(parts.join(', '));
    }

    return lines.join('\n');
  }

  /**
   * Generate specific "no results" message based on search filters.
   * Instead of generic "su an yok abi", tell user what was searched.
   * Also adds a hint that jobs are constantly updated.
   */
  private formatNoResultsMessage(params?: SearchJobsParams): string {
    if (!params) {
      return 'su an yok abi, isler surekli guncelleniyor sonradan tekrar deneyebilirsin.';
    }

    const parts: string[] = [];

    // Build route description (include district if searched)
    let originStr = params.origin || '';
    if (params.originDistrict) {
      originStr = params.originDistrict + (params.origin ? `/${params.origin}` : '');
    }
    let destStr = params.destination || '';
    if (params.destinationDistrict) {
      destStr = params.destinationDistrict + (params.destination ? `/${params.destination}` : '');
    }

    if (originStr && destStr) {
      parts.push(`${originStr} - ${destStr} yok su an`);
    } else if (originStr) {
      parts.push(`${originStr}'den cikan is yok su an`);
    } else if (destStr) {
      parts.push(`${destStr}'ye giden is yok su an`);
    } else {
      parts.push('su an yok abi');
    }

    // Add filter details
    const filters: string[] = [];
    if (params.isRefrigerated) {
      filters.push('frigo');
    }
    if (params.bodyType) {
      filters.push(params.bodyType.toLowerCase().replace(/_/g, ' '));
    }
    if (params.vehicleType) {
      filters.push(params.vehicleType.toLowerCase());
    }

    let message: string;
    if (filters.length > 0) {
      message = `${filters.join(' ')} ${parts[0]}`;
    } else {
      message = parts[0];
    }

    // Add hint that jobs are constantly updated
    return `${message}, isler surekli guncelleniyor sonradan tekrar deneyebilirsin.`;
  }
}
