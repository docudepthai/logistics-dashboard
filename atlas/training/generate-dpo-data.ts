/**
 * Generate DPO (Direct Preference Optimization) training data
 * Creates pairs of (chosen, rejected) from Atlas mistakes
 */

import * as fs from 'fs';
import * as readline from 'readline';

const RESULTS_FILE = '../../test-data/results.jsonl';
const OUTPUT_FILE = './dpo-training.jsonl';

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

// Pattern-based corrections (same as generate-1.2-data.ts)
const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string }> = [
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
  { pattern: /ananı/i, intent: 'abuse' },
  { pattern: /sikim/i, intent: 'abuse' },

  // Spam
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
  { pattern: /fransa/i, intent: 'international' },
  { pattern: /paris/i, intent: 'international' },
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

interface TestResult {
  userMessage: string;
  atlasIntent: string;
}

interface DPOExample {
  prompt: string;
  chosen: string;
  rejected: string;
}

function makeResponse(intent: string): string {
  return JSON.stringify({
    intent,
    origin: null,
    destination: null,
    vehicle_type: null,
    cargo_type: null
  });
}

function getCorrectIntent(message: string, currentIntent: string): string | null {
  const normalized = message.toLowerCase().trim();

  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(normalized) && currentIntent !== intent) {
      return intent;
    }
  }

  return null;
}

async function main() {
  console.log('=== Generating DPO Training Data ===\n');

  const dpoExamples: DPOExample[] = [];
  const seenMessages = new Set<string>();

  const fileStream = fs.createReadStream(RESULTS_FILE);
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    if (!line.trim()) continue;

    const result: TestResult = JSON.parse(line);
    const { userMessage, atlasIntent } = result;

    // Skip duplicates
    if (seenMessages.has(userMessage)) continue;
    seenMessages.add(userMessage);

    // Skip very short or very long
    if (userMessage.length < 2 || userMessage.length > 150) continue;

    // Check if Atlas got it wrong
    const correctIntent = getCorrectIntent(userMessage, atlasIntent);

    if (correctIntent) {
      // This is a mistake - create DPO pair
      const prompt = `${SYSTEM_PROMPT}\n\nUser: ${userMessage}`;

      dpoExamples.push({
        prompt,
        chosen: makeResponse(correctIntent),    // What it SHOULD say
        rejected: makeResponse(atlasIntent)     // What Atlas ACTUALLY said (wrong)
      });
    }
  }

  console.log(`Total DPO pairs: ${dpoExamples.length}`);

  // Write output
  const output = dpoExamples.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`Written to ${OUTPUT_FILE}`);

  // Show examples
  console.log('\nExample DPO pairs:');
  console.log('------------------');
  for (const ex of dpoExamples.slice(0, 5)) {
    const userMsg = ex.prompt.split('User: ')[1];
    const chosen = JSON.parse(ex.chosen).intent;
    const rejected = JSON.parse(ex.rejected).intent;
    console.log(`"${userMsg}": ${rejected} → ${chosen}`);
  }
}

main().catch(console.error);
