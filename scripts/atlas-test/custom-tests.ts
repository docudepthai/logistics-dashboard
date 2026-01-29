/**
 * 100 Custom Test Cases for Atlas Agent
 * Covers all edge case categories with expected outcomes
 */

import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';
import { AtlasAgent } from '../../packages/agent/src/atlas-agent.js';
import type { Intent } from '../../packages/agent/src/intents.js';

const OUTPUT_FILE = path.join(__dirname, '../../test-data/custom-results.jsonl');

interface TestCase {
  id: number;
  category: string;
  input: string;
  expectedIntent: Intent | Intent[];
  expectedOrigin?: string;
  expectedDestination?: string;
  expectedDestinations?: string[];
  notes?: string;
}

interface TestResult {
  testCase: TestCase;
  actualIntent: Intent | 'error' | 'unknown';
  actualResponse: string;
  actualOrigin?: string;
  actualDestination?: string;
  actualJobCount: number;
  latencyMs: number;
  error?: string;

  // Scoring
  intentCorrect: boolean;
  locationCorrect: boolean;
  passed: boolean;
}

// 100 Test Cases across 10 categories
const TEST_CASES: TestCase[] = [
  // ===============================
  // CATEGORY 1: Basic Searches (10)
  // ===============================
  { id: 1, category: 'basic_search', input: 'istanbul ankara', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara' },
  { id: 2, category: 'basic_search', input: 'izmir bursa', expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestination: 'bursa' },
  { id: 3, category: 'basic_search', input: 'konya antalya', expectedIntent: 'search', expectedOrigin: 'konya', expectedDestination: 'antalya' },
  { id: 4, category: 'basic_search', input: 'trabzon samsun', expectedIntent: 'search', expectedOrigin: 'trabzon', expectedDestination: 'samsun' },
  { id: 5, category: 'basic_search', input: 'adana mersin', expectedIntent: 'search', expectedOrigin: 'adana', expectedDestination: 'mersin' },
  { id: 6, category: 'basic_search', input: 'ankara', expectedIntent: 'search', expectedOrigin: 'ankara' },
  { id: 7, category: 'basic_search', input: 'ank ist', expectedIntent: 'search', expectedOrigin: 'ankara', expectedDestination: 'istanbul', notes: 'Abbreviations' },
  { id: 8, category: 'basic_search', input: 'antep urfa', expectedIntent: 'search', expectedOrigin: 'gaziantep', expectedDestination: 'sanliurfa', notes: 'City aliases' },
  { id: 9, category: 'basic_search', input: 'izmit adapazari', expectedIntent: 'search', expectedOrigin: 'kocaeli', expectedDestination: 'sakarya', notes: 'District to province' },
  { id: 10, category: 'basic_search', input: 'afyon eskisehir', expectedIntent: 'search', expectedOrigin: 'afyonkarahisar', expectedDestination: 'eskisehir', notes: 'Short name' },

  // ===============================
  // CATEGORY 2: Suffix-Based (10)
  // ===============================
  { id: 11, category: 'suffix_based', input: 'istanbuldan ankaraya', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: '-dan/-ya' },
  { id: 12, category: 'suffix_based', input: 'izmirden bursaya', expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestination: 'bursa', notes: '-den/-ya' },
  { id: 13, category: 'suffix_based', input: 'ankaradan izmire', expectedIntent: 'search', expectedOrigin: 'ankara', expectedDestination: 'izmir', notes: '-dan/-e' },
  { id: 14, category: 'suffix_based', input: 'konyadan antalyaya', expectedIntent: 'search', expectedOrigin: 'konya', expectedDestination: 'antalya', notes: '-dan/-ya' },
  { id: 15, category: 'suffix_based', input: 'trabzondan samsuna', expectedIntent: 'search', expectedOrigin: 'trabzon', expectedDestination: 'samsun', notes: '-dan/-a' },
  { id: 16, category: 'suffix_based', input: 'adanadan mersine', expectedIntent: 'search', expectedOrigin: 'adana', expectedDestination: 'mersin', notes: '-dan/-e' },
  { id: 17, category: 'suffix_based', input: 'eskisehirden ankaraya', expectedIntent: 'search', expectedOrigin: 'eskisehir', expectedDestination: 'ankara', notes: '-den/-ya' },
  { id: 18, category: 'suffix_based', input: 'kayseriden sivasa', expectedIntent: 'search', expectedOrigin: 'kayseri', expectedDestination: 'sivas', notes: '-den/-a' },
  { id: 19, category: 'suffix_based', input: "istanbul'dan ankara'ya", expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'With apostrophes' },
  { id: 20, category: 'suffix_based', input: "izmir'den istanbul'a", expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestination: 'istanbul', notes: 'With apostrophes' },

  // ===============================
  // CATEGORY 3: Multi-Destination (10)
  // ===============================
  { id: 21, category: 'multi_destination', input: 'izmirden istanbul ankara bursa', expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestinations: ['istanbul', 'ankara', 'bursa'] },
  { id: 22, category: 'multi_destination', input: 'ankaradan izmir antalya denizli', expectedIntent: 'search', expectedOrigin: 'ankara', expectedDestinations: ['izmir', 'antalya', 'denizli'] },
  { id: 23, category: 'multi_destination', input: 'istanbuldan konya adana mersin', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestinations: ['konya', 'adana', 'mersin'] },
  { id: 24, category: 'multi_destination', input: 'samsundan ankara istanbul izmir', expectedIntent: 'search', expectedOrigin: 'samsun', expectedDestinations: ['ankara', 'istanbul', 'izmir'] },
  { id: 25, category: 'multi_destination', input: 'bursadan istanbul veya kocaeli', expectedIntent: 'search', expectedOrigin: 'bursa', expectedDestinations: ['istanbul', 'kocaeli'], notes: 'VEYA pattern' },
  { id: 26, category: 'multi_destination', input: 'ankaradan izmir yada antalya', expectedIntent: 'search', expectedOrigin: 'ankara', expectedDestinations: ['izmir', 'antalya'], notes: 'YADA pattern' },
  { id: 27, category: 'multi_destination', input: 'konya istanbul ya da ankara', expectedIntent: 'search', expectedOrigin: 'konya', expectedDestinations: ['istanbul', 'ankara'], notes: 'YA DA pattern' },
  { id: 28, category: 'multi_destination', input: 'trabzon istanbul ankara izmir bursa', expectedIntent: 'search', expectedOrigin: 'trabzon', expectedDestinations: ['istanbul', 'ankara', 'izmir', 'bursa'] },
  { id: 29, category: 'multi_destination', input: 'adanadan istanbul veya izmir veya ankara', expectedIntent: 'search', expectedOrigin: 'adana', expectedDestinations: ['istanbul', 'izmir', 'ankara'] },
  { id: 30, category: 'multi_destination', input: 'gaziantepten istanbul ankara konya', expectedIntent: 'search', expectedOrigin: 'gaziantep', expectedDestinations: ['istanbul', 'ankara', 'konya'], notes: '-ten suffix' },

  // ===============================
  // CATEGORY 4: Region Searches (10)
  // ===============================
  { id: 31, category: 'region_search', input: 'istanbuldan ege bolgesine', expectedIntent: 'search', expectedOrigin: 'istanbul', notes: 'Ege region' },
  { id: 32, category: 'region_search', input: 'ankaradan akdeniz bolgesi', expectedIntent: 'search', expectedOrigin: 'ankara', notes: 'Akdeniz region' },
  { id: 33, category: 'region_search', input: 'izmirden ic anadoluya', expectedIntent: 'search', expectedOrigin: 'izmir', notes: 'Ic Anadolu region' },
  { id: 34, category: 'region_search', input: 'bursadan karadenize', expectedIntent: 'search', expectedOrigin: 'bursa', notes: 'Karadeniz region' },
  { id: 35, category: 'region_search', input: 'konyadan marmaraya', expectedIntent: 'search', expectedOrigin: 'konya', notes: 'Marmara region' },
  { id: 36, category: 'region_search', input: 'adanadan dogu anadoluya', expectedIntent: 'search', expectedOrigin: 'adana', notes: 'Dogu Anadolu region' },
  { id: 37, category: 'region_search', input: 'istanbuldan guneydoguya', expectedIntent: 'search', expectedOrigin: 'istanbul', notes: 'Guneydogu region' },
  { id: 38, category: 'region_search', input: 'trabzondan ege bolgesine', expectedIntent: 'search', expectedOrigin: 'trabzon', notes: 'Ege from Karadeniz' },
  { id: 39, category: 'region_search', input: 'antalyadan icanadolu', expectedIntent: 'search', expectedOrigin: 'antalya', notes: 'Compound form no space' },
  { id: 40, category: 'region_search', input: 'izmirden doguanadolubolgesi', expectedIntent: 'search', expectedOrigin: 'izmir', notes: 'Compound form' },

  // ===============================
  // CATEGORY 5: Intra-City (10)
  // ===============================
  { id: 41, category: 'intra_city', input: 'esenyurt kucukcekmece', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'istanbul', notes: 'Istanbul European districts' },
  { id: 42, category: 'intra_city', input: 'kadikoy umraniye', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'istanbul', notes: 'Istanbul Asian districts' },
  { id: 43, category: 'intra_city', input: 'pendik tuzla', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'istanbul', notes: 'Istanbul Asian coast' },
  { id: 44, category: 'intra_city', input: 'bagcilar basaksehir', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'istanbul', notes: 'Istanbul European inland' },
  { id: 45, category: 'intra_city', input: 'cankaya etimesgut', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'ankara', notes: 'Ankara districts' },
  { id: 46, category: 'intra_city', input: 'kecioren mamak', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'ankara', notes: 'Ankara districts' },
  { id: 47, category: 'intra_city', input: 'bornova konak', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'izmir', notes: 'Izmir districts' },
  { id: 48, category: 'intra_city', input: 'karsiyaka buca', expectedIntent: ['search', 'intra_city'], expectedOrigin: 'izmir', notes: 'Izmir districts' },
  { id: 49, category: 'intra_city', input: 'istanbul ici', expectedIntent: 'intra_city', expectedOrigin: 'istanbul', notes: 'Explicit intra-city' },
  { id: 50, category: 'intra_city', input: 'ankara ici yuk', expectedIntent: 'intra_city', expectedOrigin: 'ankara', notes: 'Explicit with yuk' },

  // ===============================
  // CATEGORY 6: Vehicle Mentions (10)
  // ===============================
  { id: 51, category: 'vehicle', input: 'tir ariyorum istanbul ankara', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'TIR keyword' },
  { id: 52, category: 'vehicle', input: 'istanbul ankara tir', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'TIR at end' },
  { id: 53, category: 'vehicle', input: 'kamyon izmir antalya', expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestination: 'antalya', notes: 'Kamyon' },
  { id: 54, category: 'vehicle', input: 'tenteli tir bursa konya', expectedIntent: 'search', expectedOrigin: 'bursa', expectedDestination: 'konya', notes: 'Body type + vehicle' },
  { id: 55, category: 'vehicle', input: 'frigo istanbul trabzon', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'trabzon', notes: 'Frigo (refrigerated)' },
  { id: 56, category: 'vehicle', input: 'damperli kamyon ankara sivas', expectedIntent: 'search', expectedOrigin: 'ankara', expectedDestination: 'sivas', notes: 'Damperli' },
  { id: 57, category: 'vehicle', input: 'acik kasa izmir istanbul', expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestination: 'istanbul', notes: 'Acik kasa' },
  { id: 58, category: 'vehicle', input: 'kapali dorse mersin ankara', expectedIntent: 'search', expectedOrigin: 'mersin', expectedDestination: 'ankara', notes: 'Kapali dorse' },
  { id: 59, category: 'vehicle', input: 'lowbed istanbul konya', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'konya', notes: 'Lowbed' },
  { id: 60, category: 'vehicle', input: 'panelvan ankara kayseri', expectedIntent: 'search', expectedOrigin: 'ankara', expectedDestination: 'kayseri', notes: 'Panelvan' },

  // ===============================
  // CATEGORY 7: Trucker Slang (10)
  // ===============================
  { id: 61, category: 'slang', input: '13 60 ile cikiyorum istanbul', expectedIntent: ['search', 'vehicle_info'], expectedOrigin: 'istanbul', notes: '13 60 = TIR' },
  { id: 62, category: 'slang', input: '13:60 istanbul ankara', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'Colon format' },
  { id: 63, category: 'slang', input: '1360 izmir bursa', expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestination: 'bursa', notes: 'No space' },
  { id: 64, category: 'slang', input: 'parsiyel yuk istanbul', expectedIntent: 'search', expectedOrigin: 'istanbul', notes: 'Parsiyel cargo' },
  { id: 65, category: 'slang', input: 'komple yuk ankara izmir', expectedIntent: 'search', expectedOrigin: 'ankara', expectedDestination: 'izmir', notes: 'Komple cargo' },
  { id: 66, category: 'slang', input: 'parca yuk konya', expectedIntent: 'search', expectedOrigin: 'konya', notes: 'Parca yuk = parsiyel' },
  { id: 67, category: 'slang', input: 'palet istanbul bursa', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'bursa', notes: 'Pallet cargo' },
  { id: 68, category: 'slang', input: 'nakliye istanbul trabzon', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'trabzon', notes: 'Nakliye = transport' },
  { id: 69, category: 'slang', input: 'sefer var mi ankara', expectedIntent: 'search', expectedOrigin: 'ankara', notes: 'Sefer = trip' },
  { id: 70, category: 'slang', input: 'bos dorse var istanbul', expectedIntent: ['search', 'vehicle_info'], expectedOrigin: 'istanbul', notes: 'Empty trailer' },

  // ===============================
  // CATEGORY 8: Intents (10)
  // ===============================
  { id: 71, category: 'intent', input: 'merhaba', expectedIntent: 'greeting', notes: 'Greeting' },
  { id: 72, category: 'intent', input: 'selam', expectedIntent: 'greeting', notes: 'Greeting variant' },
  { id: 73, category: 'intent', input: 'fiyat ne', expectedIntent: 'pricing', notes: 'Pricing question' },
  { id: 74, category: 'intent', input: 'ucretli mi', expectedIntent: 'pricing', notes: 'Free question' },
  { id: 75, category: 'intent', input: 'yardim', expectedIntent: 'help', notes: 'Help request' },
  { id: 76, category: 'intent', input: 'sen kimsin', expectedIntent: 'bot_identity', notes: 'Bot identity' },
  { id: 77, category: 'intent', input: 'devam', expectedIntent: 'pagination', notes: 'Pagination' },
  { id: 78, category: 'intent', input: 'daha fazla goster', expectedIntent: 'pagination', notes: 'Pagination variant' },
  { id: 79, category: 'intent', input: 'sonraki', expectedIntent: 'pagination', notes: 'Pagination next' },
  { id: 80, category: 'intent', input: 'tesekkurler', expectedIntent: 'thanks', notes: 'Thanks' },

  // ===============================
  // CATEGORY 9: Edge Cases (10)
  // ===============================
  { id: 81, category: 'edge_case', input: 'istanbl ankra', expectedIntent: ['search', 'other'], notes: 'Typos - may fail' },
  { id: 82, category: 'edge_case', input: 'ISTANBUL ANKARA', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'Uppercase' },
  { id: 83, category: 'edge_case', input: 'istanbul to ankara', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'English to' },
  { id: 84, category: 'edge_case', input: 'from izmir to bursa', expectedIntent: 'search', expectedOrigin: 'izmir', expectedDestination: 'bursa', notes: 'Full English' },
  { id: 85, category: 'edge_case', input: '   istanbul   ankara   ', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'Whitespace' },
  { id: 86, category: 'edge_case', input: 'istanbul-ankara', expectedIntent: 'search', expectedOrigin: 'istanbul', expectedDestination: 'ankara', notes: 'Dash separator' },
  { id: 87, category: 'edge_case', input: 'istanbul,ankara,izmir', expectedIntent: 'search', expectedOrigin: 'istanbul', notes: 'CSV format' },
  { id: 88, category: 'edge_case', input: '?', expectedIntent: ['clarification', 'other'], notes: 'Single char' },
  { id: 89, category: 'edge_case', input: '', expectedIntent: 'other', notes: 'Empty - may fail' },
  { id: 90, category: 'edge_case', input: 'asdfghjkl', expectedIntent: 'other', notes: 'Gibberish' },

  // ===============================
  // CATEGORY 10: Context (10)
  // ===============================
  { id: 91, category: 'context', input: 'evet', expectedIntent: 'confirmation', notes: 'Confirmation without context' },
  { id: 92, category: 'context', input: 'tamam', expectedIntent: 'confirmation', notes: 'Confirmation ok' },
  { id: 93, category: 'context', input: 'olur', expectedIntent: 'confirmation', notes: 'Confirmation olur' },
  { id: 94, category: 'context', input: 'hayir', expectedIntent: 'negation', notes: 'Negation' },
  { id: 95, category: 'context', input: 'istemiyorum', expectedIntent: 'negation', notes: 'Negation variant' },
  { id: 96, category: 'context', input: 'baska rota', expectedIntent: ['search', 'other'], notes: 'New route request' },
  { id: 97, category: 'context', input: 'gorusuruz', expectedIntent: 'goodbye', notes: 'Goodbye' },
  { id: 98, category: 'context', input: 'sagol', expectedIntent: 'thanks', notes: 'Thanks informal' },
  { id: 99, category: 'context', input: 'bb', expectedIntent: 'goodbye', notes: 'Bye bye short' },
  { id: 100, category: 'context', input: 'eyvallah', expectedIntent: 'thanks', notes: 'Thanks slang' },
];

function checkIntentCorrect(expected: Intent | Intent[], actual: Intent | 'error' | 'unknown'): boolean {
  if (actual === 'error' || actual === 'unknown') return false;

  if (Array.isArray(expected)) {
    return expected.includes(actual);
  }
  return expected === actual;
}

function checkLocationCorrect(testCase: TestCase, actualOrigin?: string, actualDestination?: string): boolean {
  // Normalize for comparison
  const normalize = (s?: string) => s?.toLowerCase().replace(/[^a-z]/g, '');

  const expectedOrigin = normalize(testCase.expectedOrigin);
  const expectedDest = normalize(testCase.expectedDestination);
  const actual0 = normalize(actualOrigin);
  const actualD = normalize(actualDestination);

  // If no expected locations, pass
  if (!expectedOrigin && !expectedDest) return true;

  // Check origin match
  const originMatch = !expectedOrigin || expectedOrigin === actual0;

  // Check destination match
  const destMatch = !expectedDest || expectedDest === actualD;

  return originMatch && destMatch;
}

async function runCustomTests(): Promise<void> {
  console.log('=== Atlas Agent Custom Tests ===\n');
  console.log(`Running ${TEST_CASES.length} test cases...\n`);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  const sql = postgres(dbUrl, { ssl: 'require' });
  const agent = new AtlasAgent({ sql });
  const outputStream = fs.createWriteStream(OUTPUT_FILE);

  const results: TestResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    // Skip empty input test
    if (testCase.input === '') {
      continue;
    }

    const startTime = Date.now();
    let result: TestResult;

    try {
      const testUserId = `CUSTOM_TEST_${testCase.id}_${Date.now()}`;
      const response = await agent.processMessage(testUserId, testCase.input);
      const latency = Date.now() - startTime;

      const intentCorrect = checkIntentCorrect(testCase.expectedIntent, response.intent || 'unknown');
      const locationCorrect = checkLocationCorrect(
        testCase,
        response.context?.lastOrigin,
        response.context?.lastDestination
      );

      result = {
        testCase,
        actualIntent: response.intent || 'unknown',
        actualResponse: response.message,
        actualOrigin: response.context?.lastOrigin,
        actualDestination: response.context?.lastDestination,
        actualJobCount: response.jobIds?.length || 0,
        latencyMs: latency,
        intentCorrect,
        locationCorrect,
        passed: intentCorrect && locationCorrect,
      };
    } catch (error) {
      const latency = Date.now() - startTime;

      result = {
        testCase,
        actualIntent: 'error',
        actualResponse: '',
        actualJobCount: 0,
        latencyMs: latency,
        error: error instanceof Error ? error.message : String(error),
        intentCorrect: false,
        locationCorrect: false,
        passed: false,
      };
    }

    results.push(result);
    outputStream.write(JSON.stringify(result) + '\n');

    if (result.passed) {
      passed++;
      console.log(`  [PASS] #${testCase.id} ${testCase.category}: "${testCase.input.substring(0, 30)}..."`);
    } else {
      failed++;
      console.log(`  [FAIL] #${testCase.id} ${testCase.category}: "${testCase.input.substring(0, 30)}..."`);
      console.log(`         Expected: ${JSON.stringify(testCase.expectedIntent)}, Got: ${result.actualIntent}`);
      if (testCase.expectedOrigin || testCase.expectedDestination) {
        console.log(`         Location: expected ${testCase.expectedOrigin}→${testCase.expectedDestination}, got ${result.actualOrigin}→${result.actualDestination}`);
      }
    }
  }

  outputStream.end();
  await sql.end();

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Total tests: ${TEST_CASES.length - 1}`); // -1 for skipped empty
  console.log(`Passed: ${passed} (${((passed / (TEST_CASES.length - 1)) * 100).toFixed(1)}%)`);
  console.log(`Failed: ${failed} (${((failed / (TEST_CASES.length - 1)) * 100).toFixed(1)}%)`);

  // Category breakdown
  console.log('\n=== By Category ===');
  const categories = [...new Set(TEST_CASES.map(t => t.category))];
  for (const cat of categories) {
    const catResults = results.filter(r => r.testCase.category === cat);
    const catPassed = catResults.filter(r => r.passed).length;
    console.log(`  ${cat}: ${catPassed}/${catResults.length} (${((catPassed / catResults.length) * 100).toFixed(0)}%)`);
  }

  console.log(`\nOutput file: ${OUTPUT_FILE}`);
}

// Run
runCustomTests()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nError:', err);
    process.exit(1);
  });
