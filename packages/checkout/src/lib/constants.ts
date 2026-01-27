/**
 * All 81 Turkish provinces for the city dropdown
 */
export const TURKISH_PROVINCES = [
  'Adana', 'Adiyaman', 'Afyonkarahisar', 'Agri', 'Aksaray',
  'Amasya', 'Ankara', 'Antalya', 'Ardahan', 'Artvin',
  'Aydin', 'Balikesir', 'Bartin', 'Batman', 'Bayburt',
  'Bilecik', 'Bingol', 'Bitlis', 'Bolu', 'Burdur',
  'Bursa', 'Canakkale', 'Cankiri', 'Corum', 'Denizli',
  'Diyarbakir', 'Duzce', 'Edirne', 'Elazig', 'Erzincan',
  'Erzurum', 'Eskisehir', 'Gaziantep', 'Giresun', 'Gumushane',
  'Hakkari', 'Hatay', 'Igdir', 'Isparta', 'Istanbul',
  'Izmir', 'Kahramanmaras', 'Karabuk', 'Karaman', 'Kars',
  'Kastamonu', 'Kayseri', 'Kilis', 'Kirikkale', 'Kirklareli',
  'Kirsehir', 'Kocaeli', 'Konya', 'Kutahya', 'Malatya',
  'Manisa', 'Mardin', 'Mersin', 'Mugla', 'Mus',
  'Nevsehir', 'Nigde', 'Ordu', 'Osmaniye', 'Rize',
  'Sakarya', 'Samsun', 'Sanliurfa', 'Siirt', 'Sinop',
  'Sirnak', 'Sivas', 'Tekirdag', 'Tokat', 'Trabzon',
  'Tunceli', 'Usak', 'Van', 'Yalova', 'Yozgat', 'Zonguldak'
];

/**
 * Pricing constants
 */
export const PRICING = {
  BASE_AMOUNT: 1000,     // 1000 TL
  VAT_RATE: 0.20,        // 20% KDV
  VAT_AMOUNT: 200,       // 200 TL
  TOTAL_AMOUNT: 1200,    // 1200 TL
  CURRENCY: 'TL',
};

/**
 * Validate Turkish VKN (Vergi Kimlik Numarasi) - 10 digit tax number
 * Uses official checksum algorithm
 */
export function validateVKN(vkn: string): boolean {
  // Must be exactly 10 digits
  if (!/^\d{10}$/.test(vkn)) {
    return false;
  }

  const digits = vkn.split('').map(Number);
  let total = 0;

  // Process first 9 digits
  for (let i = 0; i < 9; i++) {
    const v1 = (digits[i] + (9 - i)) % 10;
    const v2 = (v1 * Math.pow(2, (9 - i))) % 9;
    const v3 = v1 !== 0 && v2 === 0 ? 9 : v2;
    total += v3;
  }

  // Calculate checksum (10th digit)
  const checksum = total % 10;

  return checksum === digits[9];
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate Turkish phone number (optional field)
 */
export function validatePhone(phone: string): boolean {
  if (!phone) return true; // Optional
  const phoneRegex = /^(\+90|0)?[5][0-9]{9}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Error messages in Turkish
 */
export const ERROR_MESSAGES = {
  REQUIRED: 'Bu alan zorunludur',
  VKN_INVALID: 'Gecerli bir VKN giriniz (10 haneli)',
  VKN_CHECKSUM: 'VKN dogrulama hatasi',
  EMAIL_INVALID: 'Gecerli bir e-posta adresi giriniz',
  PHONE_INVALID: 'Gecerli bir telefon numarasi giriniz',
  TOKEN_INVALID: 'Gecersiz veya suresi dolmus odeme baglantisi',
  TOKEN_EXPIRED: 'Odeme baglantisinin suresi dolmus',
  PAYMENT_FAILED: 'Odeme baslatilirken bir hata olustu',
  NETWORK_ERROR: 'Baglanti hatasi. Lutfen tekrar deneyin',
};
