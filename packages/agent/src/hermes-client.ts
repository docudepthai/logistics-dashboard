/**
 * Hermes Client - WhatsApp Logistics Message Parser
 *
 * Uses multi-step guided prompting to reliably extract multiple jobs
 * from a single message. Instead of asking Hermes to extract all jobs
 * at once (which fails), we guide it step-by-step:
 *
 * 1. First pass: Count how many routes/jobs are in the message
 * 2. Extract each job individually with explicit instructions
 * 3. Combine results into final array
 */

const HERMES_URL = 'https://wpaggregatorbotacs--hermes-parser-hermesmodel-parse-message.modal.run';
const HERMES_TIMEOUT = 120000; // 2 minutes for cold starts

export interface HermesJob {
  origin?: string;
  destination?: string;
  weight?: string | number;
  vehicle_type?: string;
  body_type?: string;
  phone?: string;
}

export interface HermesResponse {
  success: boolean;
  jobs: HermesJob[];
  count: number;
  error?: string;
}

/**
 * Count jobs in a message using simple heuristics
 * (Faster than asking Hermes)
 */
function countJobsHeuristic(message: string): number {
  // Common patterns that indicate multiple jobs
  const lines = message.split('\n').filter(l => l.trim());

  // Count numbered items (1. 2. 3. or ⭕ markers)
  const numberedItems = message.match(/^\s*(⭕|\d+[\.)]|[•\-\*])/gm);
  if (numberedItems && numberedItems.length > 1) {
    return numberedItems.length;
  }

  // Count route patterns (origin -- destination or origin-destination)
  const routePatterns = message.match(/([A-ZİĞÜŞÖÇa-zığüşöç]+)\s*[-–—]+\s*([A-ZİĞÜŞÖÇa-zığüşöç]+)/g);
  if (routePatterns && routePatterns.length > 1) {
    return routePatterns.length;
  }

  // Count lines that look like job listings (have city names + possibly phone or tonnage)
  const turkishCities = ['istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'konya', 'adana',
    'mersin', 'kayseri', 'hatay', 'tekirdag', 'samsun', 'trabzon', 'gaziantep', 'diyarbakir',
    'mugla', 'denizli', 'eskisehir', 'manisa', 'sakarya', 'aydin', 'balikesir', 'kocaeli',
    'afyon', 'usak', 'bolu', 'kutahya', 'aksaray', 'karaman', 'nigde', 'nevsehir', 'yozgat',
    'cankiri', 'corum', 'tokat', 'amasya', 'ordu', 'giresun', 'rize', 'artvin', 'gumushane',
    'erzurum', 'erzincan', 'bayburt', 'agri', 'kars', 'ardahan', 'igdir', 'van', 'bitlis',
    'mus', 'bingol', 'tunceli', 'elazig', 'malatya', 'adiyaman', 'sanliurfa', 'mardin',
    'batman', 'sirnak', 'siirt', 'hakkari', 'diyarbakir', 'kahramanmaras', 'osmaniye',
    'antakya', 'iskenderun', 'tarsus', 'iskenderun', 'zonguldak', 'karabuk', 'bartin',
    'sinop', 'kastamonu', 'duzce', 'bilecik', 'kirklareli', 'edirne', 'canakkale', 'corlu'];

  // Count lines with at least 2 cities (likely a route)
  const routeLines = lines.filter(line => {
    const lower = line.toLowerCase().replace(/[ıİğĞüÜşŞöÖçÇ]/g, c => {
      const map: Record<string, string> = { 'ı': 'i', 'İ': 'i', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ş': 's', 'Ş': 's', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' };
      return map[c] || c;
    });
    const citiesInLine = turkishCities.filter(city => lower.includes(city));
    return citiesInLine.length >= 2;
  });

  if (routeLines.length > 1) {
    return routeLines.length;
  }

  // Default: assume single job
  return 1;
}

/**
 * Parse a single message with Hermes (single pass)
 */
async function parseSimple(message: string): Promise<HermesJob[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HERMES_TIMEOUT);

    const response = await fetch(HERMES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`[Hermes] HTTP error: ${response.status}`);
      return [];
    }

    const data = await response.json() as HermesResponse;
    return data.jobs || [];
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[Hermes] Request timed out');
    } else {
      console.error('[Hermes] Request failed:', error);
    }
    return [];
  }
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

/**
 * Check if a line looks like a route (has 2+ city names)
 */
function isRouteLine(line: string): boolean {
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

  const normalized = normalizeToAscii(line.toLowerCase());
  const citiesInLine = turkishCities.filter(city => normalized.includes(city));
  return citiesInLine.length >= 2;
}

/**
 * Split message into individual job segments
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

  // Priority 2: Check if we have multiple lines that each look like routes
  const routeLines = lines.filter(l => isRouteLine(l));
  if (routeLines.length > 1) {
    segments.length = 0; // Clear segments
    lastPhoneNumber = '';

    // Split by newline - each route line is its own segment
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

  // Priority 3: Fallback - split by bullet points
  segments.length = 0;
  currentSegment = '';
  lastPhoneNumber = '';

  for (const line of lines) {
    const isNewItem = /^\s*[•\-\*]/.test(line);
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

  if (segments.length <= 1) {
    return [message];
  }

  return segments;
}

/**
 * Parse message using guided multi-step approach
 *
 * For multi-job messages:
 * 1. Split into individual segments
 * 2. Parse each segment separately
 * 3. Combine results
 */
export async function parseMessage(message: string): Promise<HermesResponse> {
  const startTime = Date.now();

  // Count expected jobs
  const expectedCount = countJobsHeuristic(message);
  console.log(`[Hermes] Expected job count: ${expectedCount}`);

  if (expectedCount === 1) {
    // Single job - simple parse
    const jobs = await parseSimple(message);
    const duration = Date.now() - startTime;
    console.log(`[Hermes] Single parse completed in ${duration}ms, found ${jobs.length} jobs`);

    return {
      success: true,
      jobs,
      count: jobs.length,
    };
  }

  // Multi-job message - split and parse each
  const segments = splitMessageIntoJobs(message);
  console.log(`[Hermes] Split into ${segments.length} segments`);

  if (segments.length === 1) {
    // Couldn't split, try single parse anyway
    const jobs = await parseSimple(message);
    const duration = Date.now() - startTime;
    console.log(`[Hermes] Fallback to single parse in ${duration}ms, found ${jobs.length} jobs`);

    return {
      success: true,
      jobs,
      count: jobs.length,
    };
  }

  // Parse each segment individually
  const allJobs: HermesJob[] = [];

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    console.log(`[Hermes] Parsing segment ${i + 1}/${segments.length}: "${segment.substring(0, 50)}..."`);

    const jobs = await parseSimple(segment);

    if (jobs.length > 0) {
      allJobs.push(...jobs);
    } else {
      console.log(`[Hermes] No jobs found in segment ${i + 1}`);
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[Hermes] Multi-step parse completed in ${duration}ms, found ${allJobs.length} jobs`);

  return {
    success: true,
    jobs: allJobs,
    count: allJobs.length,
  };
}

/**
 * Parse multiple messages in batch
 */
export async function parseBatch(messages: string[]): Promise<HermesResponse[]> {
  const results: HermesResponse[] = [];

  for (const message of messages) {
    const result = await parseMessage(message);
    results.push(result);
  }

  return results;
}

/**
 * Check if Hermes is available
 */
export async function isHermesAvailable(): Promise<boolean> {
  try {
    const response = await fetch(HERMES_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'test' }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
