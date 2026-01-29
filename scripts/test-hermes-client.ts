/**
 * Test script for Hermes client multi-step parsing
 */

// Simple fetch-based test (no module import needed)

const HERMES_URL = 'https://wpaggregatorbotacs--hermes-parser-hermesmodel-parse-message.modal.run';

interface HermesJob {
  origin?: string;
  destination?: string;
  weight?: string | number;
  vehicle_type?: string;
  body_type?: string;
  phone?: string;
}

/**
 * Normalize Turkish characters to ASCII
 */
function normalizeToAscii(text: string): string {
  return text.replace(/[ıİğĞüÜşŞöÖçÇ]/g, c => {
    const map: Record<string, string> = {
      'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g',
      'ü': 'u', 'Ü': 'u', 'ş': 's', 'Ş': 's',
      'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c'
    };
    return map[c] || c;
  });
}

const turkishCities = ['istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'konya', 'adana',
  'mersin', 'kayseri', 'hatay', 'tekirdag', 'samsun', 'trabzon', 'gaziantep', 'diyarbakir',
  'mugla', 'denizli', 'eskisehir', 'manisa', 'sakarya', 'aydin', 'balikesir', 'kocaeli',
  'afyon', 'usak', 'bolu', 'kutahya', 'aksaray', 'karaman', 'nigde', 'nevsehir', 'yozgat',
  'cankiri', 'corum', 'tokat', 'amasya', 'ordu', 'giresun', 'rize', 'artvin', 'gumushane',
  'erzurum', 'erzincan', 'bayburt', 'agri', 'kars', 'ardahan', 'igdir', 'van', 'bitlis',
  'mus', 'bingol', 'tunceli', 'elazig', 'malatya', 'adiyaman', 'sanliurfa', 'mardin',
  'batman', 'sirnak', 'siirt', 'hakkari', 'kahramanmaras', 'osmaniye', 'antakya',
  'iskenderun', 'tarsus', 'zonguldak', 'karabuk', 'bartin', 'sinop', 'kastamonu',
  'duzce', 'bilecik', 'kirklareli', 'edirne', 'canakkale', 'corlu'];

/**
 * Check if a line looks like a route (has 2+ city names)
 */
function isRouteLine(line: string): boolean {
  const normalized = normalizeToAscii(line.toLowerCase());
  const citiesInLine = turkishCities.filter(city => normalized.includes(city));
  return citiesInLine.length >= 2;
}

/**
 * Count jobs in a message using heuristics
 */
function countJobsHeuristic(message: string): number {
  const lines = message.split('\n').filter(l => l.trim());
  const numberedItems = message.match(/^\s*(⭕|\d+[\.)]|[•\-\*])/gm);
  if (numberedItems && numberedItems.length > 1) {
    return numberedItems.length;
  }
  const routePatterns = message.match(/([A-ZİĞÜŞÖÇa-zığüşöç]+)\s*[-–—]+\s*([A-ZİĞÜŞÖÇa-zığüşöç]+)/g);
  if (routePatterns && routePatterns.length > 1) {
    return routePatterns.length;
  }

  // Count lines with 2+ cities (route lines)
  const routeLines = lines.filter(l => isRouteLine(l));
  if (routeLines.length > 1) {
    return routeLines.length;
  }

  return 1;
}

/**
 * Split message into job segments
 */
function splitMessageIntoJobs(message: string): string[] {
  const lines = message.split('\n').filter(l => l.trim());
  const segments: string[] = [];
  let currentSegment = '';
  let lastPhoneNumber = '';

  // Priority 1: Check for ⭕ or numbered markers FIRST
  const markerLines = lines.filter(l => /^\s*(⭕|\d+[\.)])/.test(l));
  if (markerLines.length > 1) {
    // Split by markers
    for (const line of lines) {
      const isNewItem = /^\s*(⭕|\d+[\.)])/.test(line);
      const phoneMatch = line.match(/(?:0|\+90|90)?5\d{9}/);
      if (phoneMatch) {
        lastPhoneNumber = phoneMatch[0];
      }

      if (isNewItem && currentSegment) {
        if (!currentSegment.match(/(?:0|\+90|90)?5\d{9}/) && lastPhoneNumber) {
          currentSegment += ` Tel: ${lastPhoneNumber}`;
        }
        segments.push(currentSegment.trim());
        currentSegment = line;
      } else {
        currentSegment += '\n' + line;
      }
    }

    if (currentSegment.trim()) {
      if (!currentSegment.match(/(?:0|\+90|90)?5\d{9}/) && lastPhoneNumber) {
        currentSegment += ` Tel: ${lastPhoneNumber}`;
      }
      segments.push(currentSegment.trim());
    }

    if (segments.length > 1) {
      return segments;
    }
  }

  // Priority 2: Check for multiple route lines
  const routeLines = lines.filter(l => isRouteLine(l));
  if (routeLines.length > 1) {
    segments.length = 0;
    lastPhoneNumber = '';

    for (const line of lines) {
      const phoneMatch = line.match(/(?:0|\+90|90)?5\d{9}/);
      if (phoneMatch) {
        lastPhoneNumber = phoneMatch[0];
      }

      if (isRouteLine(line)) {
        let segment = line;
        if (!segment.match(/(?:0|\+90|90)?5\d{9}/) && lastPhoneNumber) {
          segment += ` Tel: ${lastPhoneNumber}`;
        }
        segments.push(segment.trim());
      }
    }

    if (segments.length > 1) {
      return segments;
    }
  }

  return [message];
}

/**
 * Parse single message with Hermes
 */
async function parseSimple(message: string): Promise<HermesJob[]> {
  const response = await fetch(HERMES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  const data = await response.json();
  return data.jobs || [];
}

/**
 * Parse with multi-step approach
 */
async function parseMultiStep(message: string): Promise<HermesJob[]> {
  const expectedCount = countJobsHeuristic(message);
  console.log(`  Expected jobs: ${expectedCount}`);

  if (expectedCount === 1) {
    return parseSimple(message);
  }

  const segments = splitMessageIntoJobs(message);
  console.log(`  Split into ${segments.length} segments`);

  const allJobs: HermesJob[] = [];
  for (let i = 0; i < segments.length; i++) {
    console.log(`  Parsing segment ${i + 1}: "${segments[i].substring(0, 40)}..."`);
    const jobs = await parseSimple(segments[i]);
    allJobs.push(...jobs);
  }

  return allJobs;
}

// Test cases
const testCases = [
  {
    name: 'Single job',
    message: 'Istanbul Ankara TIR 05551234567',
    expected: 1,
  },
  {
    name: 'Multi-job with ⭕ markers',
    message: `⭕Tekirdağ Çorlu--Ankara Kapalı TIR 15ton
⭕Hatay--İstanbul Tuzla Açık TIR
⭕Kayseri Kocasinan--Antalya Konyaaltı Kapalı/Tenteli Kamyonet 700kg

WhatsApp üzerinden benimle iletişim kurun.
  05015971849`,
    expected: 3,
  },
  {
    name: 'Numbered list',
    message: `1. Istanbul - Ankara kamyon 10ton
2. Izmir - Bursa TIR 15ton
3. Antalya - Konya kamyonet 5ton
Tel: 05559876543`,
    expected: 3,
  },
  {
    name: 'Two lines',
    message: `Adana Mersin 10 ton 05551234567
Izmir Ankara kamyon 05559876543`,
    expected: 2,
  },
];

async function runTests() {
  console.log('=== Testing Hermes Client Multi-Step Parsing ===\n');

  for (const tc of testCases) {
    console.log(`\n📋 Test: ${tc.name}`);
    console.log(`   Expected: ${tc.expected} job(s)`);

    // Test single-pass (original behavior)
    console.log('\n  [Single Pass]');
    const startSingle = Date.now();
    const singleJobs = await parseSimple(tc.message);
    const durationSingle = Date.now() - startSingle;
    console.log(`  Result: ${singleJobs.length} job(s) in ${durationSingle}ms`);

    // Test multi-step (new behavior)
    console.log('\n  [Multi-Step]');
    const startMulti = Date.now();
    const multiJobs = await parseMultiStep(tc.message);
    const durationMulti = Date.now() - startMulti;
    console.log(`  Result: ${multiJobs.length} job(s) in ${durationMulti}ms`);

    // Compare
    const singlePass = singleJobs.length === tc.expected ? '✓' : '✗';
    const multiPass = multiJobs.length === tc.expected ? '✓' : '✗';
    console.log(`\n  Summary: Single ${singlePass} (${singleJobs.length}/${tc.expected}) | Multi ${multiPass} (${multiJobs.length}/${tc.expected})`);

    if (multiJobs.length > 0) {
      console.log('  Jobs:');
      for (const job of multiJobs) {
        console.log(`    - ${job.origin || '?'} → ${job.destination || '?'} | ${job.vehicle_type || ''} | ${job.phone || ''}`);
      }
    }
  }
}

runTests().catch(console.error);
