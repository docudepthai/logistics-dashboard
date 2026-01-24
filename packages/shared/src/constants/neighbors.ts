/**
 * Province neighbor map for suggesting nearby searches.
 * Maps each province to its directly bordering provinces.
 * Used when a search returns 0 results to suggest "check nearby?" options.
 */

/**
 * Map of province (normalized name) to its neighboring provinces.
 * Based on actual geographic borders of Turkey's 81 provinces.
 */
export const PROVINCE_NEIGHBORS: Record<string, string[]> = {
  // Marmara Region
  istanbul: ['kocaeli', 'tekirdag'],
  tekirdag: ['istanbul', 'kirklareli', 'edirne', 'canakkale'],
  kirklareli: ['tekirdag', 'edirne'],
  edirne: ['kirklareli', 'tekirdag', 'canakkale'],
  canakkale: ['tekirdag', 'edirne', 'balikesir', 'bursa'],
  balikesir: ['canakkale', 'bursa', 'kutahya', 'manisa', 'izmir'],
  bursa: ['canakkale', 'balikesir', 'kutahya', 'bilecik', 'kocaeli', 'yalova', 'sakarya'],
  bilecik: ['bursa', 'kutahya', 'eskisehir', 'bolu', 'sakarya', 'kocaeli'],
  kocaeli: ['istanbul', 'sakarya', 'bursa', 'yalova', 'bilecik'],
  sakarya: ['kocaeli', 'bilecik', 'bolu', 'duzce', 'bursa'],
  yalova: ['istanbul', 'kocaeli', 'bursa'],

  // Ege Region
  izmir: ['balikesir', 'manisa', 'aydin'],
  manisa: ['balikesir', 'izmir', 'aydin', 'denizli', 'kutahya', 'usak'],
  aydin: ['izmir', 'manisa', 'denizli', 'mugla'],
  denizli: ['aydin', 'mugla', 'burdur', 'afyonkarahisar', 'usak', 'manisa'],
  mugla: ['aydin', 'denizli', 'burdur', 'antalya'],
  kutahya: ['balikesir', 'bursa', 'bilecik', 'eskisehir', 'afyonkarahisar', 'usak', 'manisa'],
  usak: ['manisa', 'kutahya', 'afyonkarahisar', 'denizli'],
  afyonkarahisar: ['kutahya', 'eskisehir', 'konya', 'isparta', 'burdur', 'denizli', 'usak'],

  // Akdeniz Region
  antalya: ['mugla', 'burdur', 'isparta', 'konya', 'karaman', 'mersin'],
  burdur: ['mugla', 'denizli', 'afyonkarahisar', 'isparta', 'antalya'],
  isparta: ['burdur', 'afyonkarahisar', 'konya', 'antalya'],
  mersin: ['antalya', 'karaman', 'konya', 'nigde', 'adana'],
  adana: ['mersin', 'nigde', 'kayseri', 'kahramanmaras', 'osmaniye', 'hatay'],
  hatay: ['adana', 'osmaniye', 'gaziantep'],
  osmaniye: ['adana', 'hatay', 'gaziantep', 'kahramanmaras'],
  kahramanmaras: ['adana', 'osmaniye', 'gaziantep', 'kayseri', 'sivas', 'malatya', 'adiyaman'],

  // Ic Anadolu Region
  ankara: ['eskisehir', 'konya', 'aksaray', 'kirsehir', 'kirikkale', 'cankiri', 'bolu', 'sakarya'],
  konya: ['afyonkarahisar', 'eskisehir', 'ankara', 'aksaray', 'nigde', 'karaman', 'antalya', 'isparta', 'mersin'],
  eskisehir: ['kutahya', 'bilecik', 'bolu', 'ankara', 'afyonkarahisar', 'konya'],
  aksaray: ['konya', 'ankara', 'kirsehir', 'nevsehir', 'nigde'],
  nigde: ['mersin', 'adana', 'kayseri', 'nevsehir', 'aksaray', 'konya'],
  nevsehir: ['aksaray', 'kirsehir', 'kayseri', 'nigde'],
  kayseri: ['nevsehir', 'kirsehir', 'yozgat', 'sivas', 'kahramanmaras', 'adana', 'nigde'],
  kirsehir: ['ankara', 'kirikkale', 'yozgat', 'nevsehir', 'aksaray', 'kayseri'],
  kirikkale: ['ankara', 'cankiri', 'corum', 'yozgat', 'kirsehir'],
  cankiri: ['ankara', 'bolu', 'karabuk', 'kastamonu', 'corum', 'kirikkale'],
  yozgat: ['kirikkale', 'kirsehir', 'kayseri', 'sivas', 'tokat', 'amasya', 'corum'],
  sivas: ['yozgat', 'kayseri', 'kahramanmaras', 'malatya', 'erzincan', 'giresun', 'tokat'],
  karaman: ['konya', 'mersin', 'antalya'],

  // Karadeniz Region
  bolu: ['sakarya', 'bilecik', 'eskisehir', 'ankara', 'cankiri', 'karabuk', 'duzce', 'zonguldak'],
  duzce: ['sakarya', 'bolu', 'zonguldak'],
  zonguldak: ['duzce', 'bolu', 'karabuk', 'bartin'],
  bartin: ['zonguldak', 'karabuk', 'kastamonu'],
  karabuk: ['zonguldak', 'bolu', 'cankiri', 'kastamonu', 'bartin'],
  kastamonu: ['bartin', 'karabuk', 'cankiri', 'corum', 'sinop'],
  sinop: ['kastamonu', 'corum', 'samsun'],
  samsun: ['sinop', 'corum', 'amasya', 'tokat', 'ordu'],
  corum: ['kastamonu', 'sinop', 'samsun', 'amasya', 'yozgat', 'kirikkale', 'cankiri'],
  amasya: ['samsun', 'tokat', 'yozgat', 'corum'],
  tokat: ['amasya', 'samsun', 'ordu', 'giresun', 'sivas', 'yozgat'],
  ordu: ['samsun', 'tokat', 'giresun'],
  giresun: ['ordu', 'tokat', 'sivas', 'erzincan', 'gumushane', 'trabzon'],
  trabzon: ['giresun', 'gumushane', 'bayburt', 'rize'],
  gumushane: ['giresun', 'trabzon', 'bayburt', 'erzincan'],
  bayburt: ['trabzon', 'gumushane', 'erzincan', 'erzurum', 'rize'],
  rize: ['trabzon', 'bayburt', 'erzurum', 'artvin'],
  artvin: ['rize', 'erzurum', 'ardahan'],

  // Dogu Anadolu Region
  erzurum: ['bayburt', 'rize', 'artvin', 'ardahan', 'kars', 'agri', 'mus', 'bingol', 'erzincan'],
  erzincan: ['gumushane', 'bayburt', 'erzurum', 'bingol', 'tunceli', 'sivas', 'giresun'],
  ardahan: ['artvin', 'erzurum', 'kars'],
  kars: ['ardahan', 'erzurum', 'agri', 'igdir'],
  igdir: ['kars', 'agri'],
  agri: ['kars', 'igdir', 'erzurum', 'mus', 'bitlis', 'van'],
  mus: ['erzurum', 'agri', 'bitlis', 'siirt', 'batman', 'diyarbakir', 'bingol'],
  bingol: ['erzurum', 'erzincan', 'tunceli', 'elazig', 'diyarbakir', 'mus'],
  tunceli: ['erzincan', 'bingol', 'elazig', 'malatya', 'sivas'],
  elazig: ['tunceli', 'bingol', 'diyarbakir', 'malatya'],
  malatya: ['sivas', 'tunceli', 'elazig', 'diyarbakir', 'adiyaman', 'kahramanmaras'],
  bitlis: ['agri', 'van', 'siirt', 'mus'],
  van: ['agri', 'bitlis', 'siirt', 'hakkari'],
  hakkari: ['van', 'siirt', 'sirnak'],

  // Guneydogu Anadolu Region
  gaziantep: ['hatay', 'osmaniye', 'kahramanmaras', 'adiyaman', 'sanliurfa', 'kilis'],
  kilis: ['gaziantep', 'sanliurfa'],
  adiyaman: ['kahramanmaras', 'malatya', 'diyarbakir', 'sanliurfa', 'gaziantep'],
  sanliurfa: ['adiyaman', 'diyarbakir', 'mardin', 'gaziantep', 'kilis'],
  diyarbakir: ['adiyaman', 'malatya', 'elazig', 'bingol', 'mus', 'batman', 'mardin', 'sanliurfa'],
  mardin: ['sanliurfa', 'diyarbakir', 'batman', 'siirt', 'sirnak'],
  batman: ['diyarbakir', 'mus', 'siirt', 'mardin'],
  siirt: ['batman', 'mus', 'bitlis', 'van', 'hakkari', 'sirnak', 'mardin'],
  sirnak: ['mardin', 'siirt', 'hakkari'],
};

/**
 * Get neighboring provinces for a given province.
 * @param provinceName - The normalized province name
 * @returns Array of neighboring province names, or empty array if not found
 */
export function getNeighboringProvinces(provinceName: string): string[] {
  const normalized = provinceName.toLowerCase();
  return PROVINCE_NEIGHBORS[normalized] || [];
}

/**
 * Check if two provinces are neighbors.
 * @param province1 - First province name (normalized)
 * @param province2 - Second province name (normalized)
 * @returns true if the provinces share a border
 */
export function areNeighbors(province1: string, province2: string): boolean {
  const neighbors = getNeighboringProvinces(province1);
  return neighbors.includes(province2.toLowerCase());
}

/**
 * Get a formatted string of neighboring provinces for display.
 * Returns up to 3 neighbors, comma-separated.
 * @param provinceName - The normalized province name
 * @returns Formatted string like "kocaeli, bursa, tekirdag"
 */
export function getNeighborsSummary(provinceName: string, maxCount: number = 3): string {
  const neighbors = getNeighboringProvinces(provinceName);
  if (neighbors.length === 0) return '';

  const display = neighbors.slice(0, maxCount);
  if (neighbors.length > maxCount) {
    return display.join(', ') + ' vb.';
  }
  return display.join(', ');
}
