/**
 * Script to generate comprehensive districts.ts from Turkey.json
 * Handles duplicate district names across provinces
 */

// Turkey.json data structure
interface TurkeyProvince {
  id: number;
  name: string;
  districts: { id: number; name: string }[];
}

// Province code mapping (Turkey.json id is NOT the plate code)
// We need to map province names to their plate codes
const PROVINCE_NAME_TO_CODE: Record<string, number> = {
  'ADANA': 1,
  'ADIYAMAN': 2,
  'AFYONKARAHİSAR': 3,
  'AĞRI': 4,
  'AKSARAY': 68,
  'AMASYA': 5,
  'ANKARA': 6,
  'ANTALYA': 7,
  'ARDAHAN': 75,
  'ARTVİN': 8,
  'AYDIN': 9,
  'BALIKESİR': 10,
  'BARTIN': 74,
  'BATMAN': 72,
  'BAYBURT': 69,
  'BİLECİK': 11,
  'BİNGÖL': 12,
  'BİTLİS': 13,
  'BOLU': 14,
  'BURDUR': 15,
  'BURSA': 16,
  'ÇANAKKALE': 17,
  'ÇANKIRI': 18,
  'ÇORUM': 19,
  'DENİZLİ': 20,
  'DİYARBAKIR': 21,
  'DÜZCE': 81,
  'EDİRNE': 22,
  'ELAZIĞ': 23,
  'ERZİNCAN': 24,
  'ERZURUM': 25,
  'ESKİŞEHİR': 26,
  'GAZİANTEP': 27,
  'GİRESUN': 28,
  'GÜMÜŞHANE': 29,
  'HAKKARİ': 30,
  'HATAY': 31,
  'IĞDIR': 76,
  'ISPARTA': 32,
  'İSTANBUL': 34,
  'İZMİR': 35,
  'KAHRAMANMARAŞ': 46,
  'KARABÜK': 78,
  'KARAMAN': 70,
  'KARS': 36,
  'KASTAMONU': 37,
  'KAYSERİ': 38,
  'KIRIKKALE': 71,
  'KIRKLARELİ': 39,
  'KIRŞEHİR': 40,
  'KİLİS': 79,
  'KOCAELİ': 41,
  'KONYA': 42,
  'KÜTAHYA': 43,
  'MALATYA': 44,
  'MANİSA': 45,
  'MARDİN': 47,
  'MERSİN': 33,
  'MUĞLA': 48,
  'MUŞ': 49,
  'NEVŞEHİR': 50,
  'NİĞDE': 51,
  'ORDU': 52,
  'OSMANİYE': 80,
  'RİZE': 53,
  'SAKARYA': 54,
  'SAMSUN': 55,
  'SİİRT': 56,
  'SİNOP': 57,
  'SİVAS': 58,
  'ŞANLIURFA': 63,
  'ŞIRNAK': 73,
  'TEKİRDAĞ': 59,
  'TOKAT': 60,
  'TRABZON': 61,
  'TUNCELİ': 62,
  'UŞAK': 64,
  'VAN': 65,
  'YALOVA': 77,
  'YOZGAT': 66,
  'ZONGULDAK': 67,
};

// Normalize Turkish characters to ASCII
function normalizeToAscii(text: string): string {
  return text
    .replace(/İ/g, 'I')
    .replace(/I/g, 'I')
    .replace(/ı/g, 'i')
    .replace(/Ğ/g, 'G')
    .replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U')
    .replace(/ü/g, 'u')
    .replace(/Ş/g, 'S')
    .replace(/ş/g, 's')
    .replace(/Ö/g, 'O')
    .replace(/ö/g, 'o')
    .replace(/Ç/g, 'C')
    .replace(/ç/g, 'c')
    .toLowerCase();
}

// Proper case for display
function toProperCase(text: string): string {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Normalize province name for display
function normalizeProvinceName(name: string): string {
  const special: Record<string, string> = {
    'AFYONKARAHİSAR': 'Afyonkarahisar',
    'KAHRAMANMARAŞ': 'Kahramanmaras',
    'ŞANLIURFA': 'Sanliurfa',
  };
  return special[name] || toProperCase(normalizeToAscii(name).replace(/i/g, 'i'));
}

// The Turkey.json data (inline for script execution)
const turkeyData: TurkeyProvince[] = [
  // This would be the full JSON - for now we'll fetch it
];

async function main() {
  // Fetch the JSON
  const response = await fetch('https://raw.githubusercontent.com/nidea1/Turkey-s-Provinces-Districts/master/Turkey.json');
  const data: TurkeyProvince[] = await response.json();

  // Build district list and track duplicates
  const districtsByNormalized = new Map<string, { name: string; provinceCode: number; provinceName: string }[]>();

  for (const province of data) {
    const provinceCode = PROVINCE_NAME_TO_CODE[province.name];
    if (!provinceCode) {
      console.error(`Unknown province: ${province.name}`);
      continue;
    }

    const provinceName = normalizeProvinceName(province.name);

    for (const district of province.districts) {
      // Skip "MERKEZ" as it's too generic (means "center")
      if (district.name === 'MERKEZ') continue;

      const normalized = normalizeToAscii(district.name);
      const displayName = toProperCase(district.name);

      if (!districtsByNormalized.has(normalized)) {
        districtsByNormalized.set(normalized, []);
      }

      districtsByNormalized.get(normalized)!.push({
        name: displayName,
        provinceCode,
        provinceName,
      });
    }
  }

  // Identify duplicates
  const duplicates: string[] = [];
  for (const [normalized, districts] of districtsByNormalized) {
    if (districts.length > 1) {
      duplicates.push(`${normalized}: ${districts.map(d => `${d.provinceName}(${d.provinceCode})`).join(', ')}`);
    }
  }

  console.log('\n=== DUPLICATE DISTRICTS ===');
  duplicates.forEach(d => console.log(d));
  console.log(`\nTotal duplicates: ${duplicates.length}`);

  // Generate the districts.ts content
  let output = `/**
 * Comprehensive list of ALL Turkish districts mapped to their provinces.
 * Auto-generated from Turkey.json
 *
 * IMPORTANT: Some district names exist in multiple provinces (e.g., Edremit in both Van and Balikesir).
 * The lookup functions return arrays to handle this ambiguity.
 */

export interface District {
  /** District name (proper case) */
  name: string;
  /** ASCII lowercase normalized name */
  normalized: string;
  /** Parent province plate code */
  provinceCode: number;
  /** Parent province name */
  provinceName: string;
}

/**
 * Complete list of Turkish districts (excluding generic "Merkez" entries)
 */
export const DISTRICTS: District[] = [\n`;

  // Generate district entries grouped by province
  const sortedProvinces = [...data].sort((a, b) => {
    const codeA = PROVINCE_NAME_TO_CODE[a.name] || 0;
    const codeB = PROVINCE_NAME_TO_CODE[b.name] || 0;
    return codeA - codeB;
  });

  for (const province of sortedProvinces) {
    const provinceCode = PROVINCE_NAME_TO_CODE[province.name];
    if (!provinceCode) continue;

    const provinceName = normalizeProvinceName(province.name);
    const sortedDistricts = [...province.districts]
      .filter(d => d.name !== 'MERKEZ')
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    if (sortedDistricts.length === 0) continue;

    output += `  // ${province.name} (${provinceCode})\n`;

    for (const district of sortedDistricts) {
      const normalized = normalizeToAscii(district.name);
      const displayName = toProperCase(district.name);
      output += `  { name: '${displayName}', normalized: '${normalized}', provinceCode: ${provinceCode}, provinceName: '${provinceName}' },\n`;
    }

    output += '\n';
  }

  output += `];

/**
 * Lookup map: normalized district name -> Array of Districts
 * Some districts exist in multiple provinces, so we return an array
 */
export const DISTRICTS_BY_NAME: Map<string, District[]> = new Map();

// Build lookup map
for (const district of DISTRICTS) {
  const existing = DISTRICTS_BY_NAME.get(district.normalized) || [];
  existing.push(district);
  DISTRICTS_BY_NAME.set(district.normalized, existing);
}

/**
 * Set of all normalized district names for fast lookup
 */
export const DISTRICT_NAMES: Set<string> = new Set(DISTRICTS_BY_NAME.keys());

/**
 * Set of district names that exist in multiple provinces
 */
export const AMBIGUOUS_DISTRICT_NAMES: Set<string> = new Set(
  [...DISTRICTS_BY_NAME.entries()]
    .filter(([_, districts]) => districts.length > 1)
    .map(([name, _]) => name)
);

/**
 * Get all districts matching a normalized name
 * Returns empty array if not found
 */
export function getDistrictsByName(name: string): District[] {
  return DISTRICTS_BY_NAME.get(name.toLowerCase()) || [];
}

/**
 * Get a single district by name (returns first match for ambiguous names)
 * @deprecated Use getDistrictsByName for proper ambiguity handling
 */
export function getDistrictByName(name: string): District | undefined {
  const districts = getDistrictsByName(name);
  return districts[0];
}

/**
 * Check if a string is a valid district name
 */
export function isDistrictName(name: string): boolean {
  return DISTRICT_NAMES.has(name.toLowerCase());
}

/**
 * Check if a district name is ambiguous (exists in multiple provinces)
 */
export function isAmbiguousDistrict(name: string): boolean {
  return AMBIGUOUS_DISTRICT_NAMES.has(name.toLowerCase());
}

/**
 * Get all districts for a given province code
 */
export function getDistrictsByProvinceCode(provinceCode: number): District[] {
  return DISTRICTS.filter((d) => d.provinceCode === provinceCode);
}
`;

  console.log('\n=== GENERATED OUTPUT ===');
  console.log(output);

  // Write to file
  const fs = await import('fs');
  const path = await import('path');
  const outputPath = path.join(__dirname, '../packages/shared/src/constants/districts.ts');
  fs.writeFileSync(outputPath, output);
  console.log(`\nWritten to: ${outputPath}`);
}

main().catch(console.error);
