/**
 * Complete list of all 81 Turkish provinces with plate codes, regions, and aliases.
 * This is the authoritative data source for province matching.
 */

export interface Province {
  /** Plate code (1-81) */
  code: number;
  /** Official Turkish name */
  name: string;
  /** ASCII lowercase normalized name */
  normalized: string;
  /** Geographic region */
  region: TurkishRegion;
  /** Alternative names/spellings/abbreviations */
  aliases: string[];
}

export type TurkishRegion =
  | 'Akdeniz'
  | 'Dogu Anadolu'
  | 'Ege'
  | 'Guneydogu Anadolu'
  | 'Ic Anadolu'
  | 'Karadeniz'
  | 'Marmara';

/**
 * Complete list of all 81 Turkish provinces
 */
export const PROVINCES: Province[] = [
  // 01-10
  { code: 1, name: 'Adana', normalized: 'adana', region: 'Akdeniz', aliases: [] },
  { code: 2, name: 'Adiyaman', normalized: 'adiyaman', region: 'Guneydogu Anadolu', aliases: [] },
  { code: 3, name: 'Afyonkarahisar', normalized: 'afyonkarahisar', region: 'Ege', aliases: ['afyon'] },
  { code: 4, name: 'Agri', normalized: 'agri', region: 'Dogu Anadolu', aliases: [] },
  { code: 5, name: 'Amasya', normalized: 'amasya', region: 'Karadeniz', aliases: [] },
  { code: 6, name: 'Ankara', normalized: 'ankara', region: 'Ic Anadolu', aliases: ['ank'] },
  { code: 7, name: 'Antalya', normalized: 'antalya', region: 'Akdeniz', aliases: [] },
  { code: 8, name: 'Artvin', normalized: 'artvin', region: 'Karadeniz', aliases: [] },
  { code: 9, name: 'Aydin', normalized: 'aydin', region: 'Ege', aliases: [] },
  { code: 10, name: 'Balikesir', normalized: 'balikesir', region: 'Marmara', aliases: [] },

  // 11-20
  { code: 11, name: 'Bilecik', normalized: 'bilecik', region: 'Marmara', aliases: [] },
  { code: 12, name: 'Bingol', normalized: 'bingol', region: 'Dogu Anadolu', aliases: [] },
  { code: 13, name: 'Bitlis', normalized: 'bitlis', region: 'Dogu Anadolu', aliases: [] },
  { code: 14, name: 'Bolu', normalized: 'bolu', region: 'Karadeniz', aliases: [] },
  { code: 15, name: 'Burdur', normalized: 'burdur', region: 'Akdeniz', aliases: [] },
  { code: 16, name: 'Bursa', normalized: 'bursa', region: 'Marmara', aliases: [] },
  { code: 17, name: 'Canakkale', normalized: 'canakkale', region: 'Marmara', aliases: [] },
  { code: 18, name: 'Cankiri', normalized: 'cankiri', region: 'Ic Anadolu', aliases: [] },
  { code: 19, name: 'Corum', normalized: 'corum', region: 'Karadeniz', aliases: [] },
  { code: 20, name: 'Denizli', normalized: 'denizli', region: 'Ege', aliases: [] },

  // 21-30
  { code: 21, name: 'Diyarbakir', normalized: 'diyarbakir', region: 'Guneydogu Anadolu', aliases: ['diyarbekir'] },
  { code: 22, name: 'Edirne', normalized: 'edirne', region: 'Marmara', aliases: [] },
  { code: 23, name: 'Elazig', normalized: 'elazig', region: 'Dogu Anadolu', aliases: [] },
  { code: 24, name: 'Erzincan', normalized: 'erzincan', region: 'Dogu Anadolu', aliases: [] },
  { code: 25, name: 'Erzurum', normalized: 'erzurum', region: 'Dogu Anadolu', aliases: [] },
  { code: 26, name: 'Eskisehir', normalized: 'eskisehir', region: 'Ic Anadolu', aliases: [] },
  { code: 27, name: 'Gaziantep', normalized: 'gaziantep', region: 'Guneydogu Anadolu', aliases: ['antep'] },
  { code: 28, name: 'Giresun', normalized: 'giresun', region: 'Karadeniz', aliases: [] },
  { code: 29, name: 'Gumushane', normalized: 'gumushane', region: 'Karadeniz', aliases: [] },
  { code: 30, name: 'Hakkari', normalized: 'hakkari', region: 'Dogu Anadolu', aliases: [] },

  // 31-40
  { code: 31, name: 'Hatay', normalized: 'hatay', region: 'Akdeniz', aliases: ['antakya'] },
  { code: 32, name: 'Isparta', normalized: 'isparta', region: 'Akdeniz', aliases: [] },
  { code: 33, name: 'Mersin', normalized: 'mersin', region: 'Akdeniz', aliases: ['icel'] },
  { code: 34, name: 'Istanbul', normalized: 'istanbul', region: 'Marmara', aliases: ['ist'] },
  { code: 35, name: 'Izmir', normalized: 'izmir', region: 'Ege', aliases: [] },
  { code: 36, name: 'Kars', normalized: 'kars', region: 'Dogu Anadolu', aliases: [] },
  { code: 37, name: 'Kastamonu', normalized: 'kastamonu', region: 'Karadeniz', aliases: [] },
  { code: 38, name: 'Kayseri', normalized: 'kayseri', region: 'Ic Anadolu', aliases: [] },
  { code: 39, name: 'Kirklareli', normalized: 'kirklareli', region: 'Marmara', aliases: [] },
  { code: 40, name: 'Kirsehir', normalized: 'kirsehir', region: 'Ic Anadolu', aliases: [] },

  // 41-50
  { code: 41, name: 'Kocaeli', normalized: 'kocaeli', region: 'Marmara', aliases: ['izmit'] },
  { code: 42, name: 'Konya', normalized: 'konya', region: 'Ic Anadolu', aliases: [] },
  { code: 43, name: 'Kutahya', normalized: 'kutahya', region: 'Ege', aliases: [] },
  { code: 44, name: 'Malatya', normalized: 'malatya', region: 'Dogu Anadolu', aliases: [] },
  { code: 45, name: 'Manisa', normalized: 'manisa', region: 'Ege', aliases: [] },
  { code: 46, name: 'Kahramanmaras', normalized: 'kahramanmaras', region: 'Akdeniz', aliases: ['maras'] },
  { code: 47, name: 'Mardin', normalized: 'mardin', region: 'Guneydogu Anadolu', aliases: [] },
  { code: 48, name: 'Mugla', normalized: 'mugla', region: 'Ege', aliases: [] },
  { code: 49, name: 'Mus', normalized: 'mus', region: 'Dogu Anadolu', aliases: [] },
  { code: 50, name: 'Nevsehir', normalized: 'nevsehir', region: 'Ic Anadolu', aliases: [] },

  // 51-60
  { code: 51, name: 'Nigde', normalized: 'nigde', region: 'Ic Anadolu', aliases: [] },
  { code: 52, name: 'Ordu', normalized: 'ordu', region: 'Karadeniz', aliases: [] },
  { code: 53, name: 'Rize', normalized: 'rize', region: 'Karadeniz', aliases: [] },
  { code: 54, name: 'Sakarya', normalized: 'sakarya', region: 'Marmara', aliases: ['adapazari'] },
  { code: 55, name: 'Samsun', normalized: 'samsun', region: 'Karadeniz', aliases: [] },
  { code: 56, name: 'Siirt', normalized: 'siirt', region: 'Guneydogu Anadolu', aliases: [] },
  { code: 57, name: 'Sinop', normalized: 'sinop', region: 'Karadeniz', aliases: [] },
  { code: 58, name: 'Sivas', normalized: 'sivas', region: 'Ic Anadolu', aliases: [] },
  { code: 59, name: 'Tekirdag', normalized: 'tekirdag', region: 'Marmara', aliases: [] },
  { code: 60, name: 'Tokat', normalized: 'tokat', region: 'Karadeniz', aliases: [] },

  // 61-70
  { code: 61, name: 'Trabzon', normalized: 'trabzon', region: 'Karadeniz', aliases: [] },
  { code: 62, name: 'Tunceli', normalized: 'tunceli', region: 'Dogu Anadolu', aliases: [] },
  { code: 63, name: 'Sanliurfa', normalized: 'sanliurfa', region: 'Guneydogu Anadolu', aliases: ['urfa'] },
  { code: 64, name: 'Usak', normalized: 'usak', region: 'Ege', aliases: [] },
  { code: 65, name: 'Van', normalized: 'van', region: 'Dogu Anadolu', aliases: [] },
  { code: 66, name: 'Yozgat', normalized: 'yozgat', region: 'Ic Anadolu', aliases: [] },
  { code: 67, name: 'Zonguldak', normalized: 'zonguldak', region: 'Karadeniz', aliases: [] },
  { code: 68, name: 'Aksaray', normalized: 'aksaray', region: 'Ic Anadolu', aliases: [] },
  { code: 69, name: 'Bayburt', normalized: 'bayburt', region: 'Karadeniz', aliases: [] },
  { code: 70, name: 'Karaman', normalized: 'karaman', region: 'Ic Anadolu', aliases: [] },

  // 71-81
  { code: 71, name: 'Kirikkale', normalized: 'kirikkale', region: 'Ic Anadolu', aliases: [] },
  { code: 72, name: 'Batman', normalized: 'batman', region: 'Guneydogu Anadolu', aliases: [] },
  { code: 73, name: 'Sirnak', normalized: 'sirnak', region: 'Guneydogu Anadolu', aliases: [] },
  { code: 74, name: 'Bartin', normalized: 'bartin', region: 'Karadeniz', aliases: [] },
  { code: 75, name: 'Ardahan', normalized: 'ardahan', region: 'Dogu Anadolu', aliases: [] },
  { code: 76, name: 'Igdir', normalized: 'igdir', region: 'Dogu Anadolu', aliases: [] },
  { code: 77, name: 'Yalova', normalized: 'yalova', region: 'Marmara', aliases: [] },
  { code: 78, name: 'Karabuk', normalized: 'karabuk', region: 'Karadeniz', aliases: [] },
  { code: 79, name: 'Kilis', normalized: 'kilis', region: 'Guneydogu Anadolu', aliases: [] },
  { code: 80, name: 'Osmaniye', normalized: 'osmaniye', region: 'Akdeniz', aliases: [] },
  { code: 81, name: 'Duzce', normalized: 'duzce', region: 'Karadeniz', aliases: [] },
];

/**
 * Lookup map: normalized name -> Province
 */
export const PROVINCE_BY_NAME: Map<string, Province> = new Map();

/**
 * Lookup map: plate code -> Province
 */
export const PROVINCE_BY_CODE: Map<number, Province> = new Map();

// Build lookup maps
for (const province of PROVINCES) {
  PROVINCE_BY_NAME.set(province.normalized, province);
  PROVINCE_BY_CODE.set(province.code, province);

  // Add aliases to lookup
  for (const alias of province.aliases) {
    PROVINCE_BY_NAME.set(alias.toLowerCase(), province);
  }
}

/**
 * Set of all normalized province names and aliases for fast lookup
 */
export const PROVINCE_NAMES: Set<string> = new Set(PROVINCE_BY_NAME.keys());

/**
 * Get province by normalized name or alias
 */
export function getProvinceByName(name: string): Province | undefined {
  return PROVINCE_BY_NAME.get(name.toLowerCase());
}

/**
 * Get province by plate code
 */
export function getProvinceByCode(code: number): Province | undefined {
  return PROVINCE_BY_CODE.get(code);
}

/**
 * Check if a string is a valid province name or alias
 */
export function isProvinceName(name: string): boolean {
  return PROVINCE_NAMES.has(name.toLowerCase());
}
