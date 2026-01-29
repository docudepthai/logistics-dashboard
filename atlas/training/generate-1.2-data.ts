/**
 * Generate training data for Atlas-1.2 from test results
 * Analyzes Atlas-1.0 mistakes and creates corrections
 */

import * as fs from 'fs';
import * as readline from 'readline';

const RESULTS_FILE = '../../test-data/results.jsonl';
const OUTPUT_FILE = './corrections-1.2.jsonl';

// System prompt (same as serve.py)
const SYSTEM_PROMPT = `Sen Patron yük asistanısın. Mesajı analiz et ve JSON döndür.

INTENT TİPLERİ:
- search = yük arıyor (şehir adı var)
- pagination = devam, daha fazla, sonraki
- intra_city = şehir içi (istanbul içi)
- greeting = merhaba, selam, sa, günaydın
- goodbye = görüşürüz, bye, hoşçakal, bb, hadi eyvallah
- thanks = teşekkürler, sağol, eyvallah, tamam teşekkür
- bot_identity = sen kimsin, bot musun, gerçek mi
- help = nasıl kullanılır, yardım, örnek
- pricing = ücretli mi, kaç para, fiyat
- subscription = premium, abone, üyelik
- support = destek, şikayet, sorun var
- phone_question = telefon neden yok, numara
- load_price = navlun, yük fiyatı neden yok
- freshness = ne zaman güncelleniyor, taze mi
- vehicle_info = bende tır var, kamyonum var
- location_info = istanbul'dayım, buradayım
- feedback_positive = güzel, süper, işe yarıyor
- feedback_negative = kötü, berbat, işe yaramıyor
- confirmation = tamam, evet, ok
- negation = hayır, istemiyorum
- abuse = küfür, hakaret (orospu, piç, siktir)
- spam = bot mesajı, "bunun hakkında daha fazla bilgi"
- international = yurtdışı (irak, iran, avrupa, bulgaristan, gürcistan, rusya, polonya)
- other = alakasız

SADECE JSON döndür:
{"intent":"...","origin":null,"destination":null,"vehicle_type":null,"cargo_type":null}`;

interface TestResult {
  userMessage: string;
  atlasIntent: string;
  atlasLatencyMs: number;
  hasCityName: boolean;
}

interface TrainingExample {
  messages: Array<{ role: string; content: string }>;
}

// Pattern-based corrections
const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string; origin?: string; dest?: string }> = [
  // Goodbye
  { pattern: /^bb$/i, intent: 'goodbye' },
  { pattern: /^görüşürüz$/i, intent: 'goodbye' },
  { pattern: /^hadi eyvallah$/i, intent: 'goodbye' },
  { pattern: /^bye$/i, intent: 'goodbye' },
  { pattern: /^hoşçakal/i, intent: 'goodbye' },

  // Thanks
  { pattern: /teşekkür/i, intent: 'thanks' },
  { pattern: /^sağol/i, intent: 'thanks' },
  { pattern: /^eyvallah$/i, intent: 'thanks' },
  { pattern: /^eyw$/i, intent: 'thanks' },
  { pattern: /^sagol/i, intent: 'thanks' },

  // Abuse
  { pattern: /orospu/i, intent: 'abuse' },
  { pattern: /piç/i, intent: 'abuse' },
  { pattern: /pic/i, intent: 'abuse' },
  { pattern: /siktir/i, intent: 'abuse' },
  { pattern: /amk/i, intent: 'abuse' },

  // Spam (bot messages)
  { pattern: /bunun hakkında daha faz/i, intent: 'spam' },
  { pattern: /daha fazla bilgi alabilir/i, intent: 'spam' },

  // International
  { pattern: /polonya/i, intent: 'international' },
  { pattern: /bulgaristan/i, intent: 'international' },
  { pattern: /gürcistan/i, intent: 'international' },
  { pattern: /gurcistan/i, intent: 'international' },
  { pattern: /rusya/i, intent: 'international' },
  { pattern: /ukrayna/i, intent: 'international' },
  { pattern: /irak/i, intent: 'international' },
  { pattern: /iran/i, intent: 'international' },
  { pattern: /avrupa/i, intent: 'international' },
  { pattern: /almanya/i, intent: 'international' },
  { pattern: /ihracat/i, intent: 'international' },

  // Confirmation
  { pattern: /^tamam$/i, intent: 'confirmation' },
  { pattern: /^ok$/i, intent: 'confirmation' },
  { pattern: /^evet$/i, intent: 'confirmation' },
  { pattern: /^olur$/i, intent: 'confirmation' },

  // Negation
  { pattern: /^hayır$/i, intent: 'negation' },
  { pattern: /^yok$/i, intent: 'negation' },
  { pattern: /istemiyorum/i, intent: 'negation' },
];

function getCorrectIntent(message: string, currentIntent: string): string | null {
  const normalized = message.toLowerCase().trim();

  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(normalized) && currentIntent !== intent) {
      return intent;
    }
  }

  return null;
}

function createTrainingExample(userMessage: string, intent: string, origin?: string, dest?: string): TrainingExample {
  const response = JSON.stringify({
    intent,
    origin: origin || null,
    destination: dest || null,
    vehicle_type: null,
    cargo_type: null
  });

  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
      { role: "assistant", content: response }
    ]
  };
}

async function main() {
  console.log('=== Generating Atlas-1.2 Training Data ===\n');

  const trainingData: TrainingExample[] = [];
  const seenMessages = new Set<string>();

  const corrections: Array<{ message: string; was: string; shouldBe: string }> = [];
  const goodExamples: Array<{ message: string; intent: string }> = [];

  // Read results
  const fileStream = fs.createReadStream(RESULTS_FILE);
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    if (!line.trim()) continue;

    const result: TestResult = JSON.parse(line);
    const { userMessage, atlasIntent, atlasLatencyMs } = result;

    // Skip duplicates
    if (seenMessages.has(userMessage)) continue;
    seenMessages.add(userMessage);

    // Skip very short or very long
    if (userMessage.length < 2 || userMessage.length > 150) continue;

    // Check if Atlas got it wrong
    const correctIntent = getCorrectIntent(userMessage, atlasIntent);

    if (correctIntent) {
      // This is a mistake - add correction
      corrections.push({ message: userMessage, was: atlasIntent, shouldBe: correctIntent });
      trainingData.push(createTrainingExample(userMessage, correctIntent));
    } else if (
      atlasIntent !== 'unknown' &&
      atlasIntent !== 'other' &&
      atlasLatencyMs < 4000 &&
      goodExamples.length < 300
    ) {
      // Good example - keep some for reinforcement
      goodExamples.push({ message: userMessage, intent: atlasIntent });
      trainingData.push(createTrainingExample(userMessage, atlasIntent));
    }
  }

  // Summary
  console.log('Corrections found:');
  console.log('------------------');
  for (const c of corrections.slice(0, 20)) {
    console.log(`  "${c.message}" : ${c.was} → ${c.shouldBe}`);
  }
  if (corrections.length > 20) {
    console.log(`  ... and ${corrections.length - 20} more`);
  }

  console.log(`\nTotal corrections: ${corrections.length}`);
  console.log(`Good examples kept: ${goodExamples.length}`);
  console.log(`Total training examples: ${trainingData.length}`);

  // Write output
  const output = trainingData.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nWritten to ${OUTPUT_FILE}`);

  // Intent distribution of corrections
  console.log('\nCorrection breakdown by intent:');
  const intentCounts: Record<string, number> = {};
  for (const c of corrections) {
    intentCounts[c.shouldBe] = (intentCounts[c.shouldBe] || 0) + 1;
  }
  for (const [intent, count] of Object.entries(intentCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${intent}: ${count}`);
  }
}

main().catch(console.error);
