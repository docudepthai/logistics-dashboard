/**
 * Generate training data for Atlas fine-tuning from test results
 * Creates JSONL in Together.ai / OpenAI chat format
 */

import * as fs from 'fs';
import * as readline from 'readline';

const RESULTS_FILE = '../../test-data/results.jsonl';
const OUTPUT_FILE = './corrections.jsonl';

// System prompt (same as serve.py)
const SYSTEM_PROMPT = `Sen Patron yük asistanısın. Mesajı analiz et ve JSON döndür.

INTENT TİPLERİ:
- search = yük arıyor (şehir adı var)
- pagination = devam, daha fazla, sonraki
- intra_city = şehir içi (istanbul içi)
- greeting = merhaba, selam, sa, günaydın
- goodbye = görüşürüz, bye, hoşçakal, bb
- thanks = teşekkürler, sağol, eyvallah, tamam abi teşekkür
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
- abuse = küfür, hakaret
- spam = bot mesajı, reklam
- international = yurtdışı (irak, iran, avrupa, bulgaristan)
- other = alakasız

SADECE JSON döndür:
{"intent":"...","origin":null,"destination":null,"vehicle_type":null,"cargo_type":null}`;

// Manual corrections for misclassified examples
const MANUAL_CORRECTIONS: Record<string, { intent: string; origin?: string; destination?: string }> = {
  // Thanks (were "unknown")
  "Tamam abi teşekkür ederim": { intent: "thanks" },
  "Ok 5 gün deneyeyim teşekkür ederim": { intent: "thanks" },
  "Sağol": { intent: "thanks" },
  "Yok teşekkür ederim": { intent: "thanks" },
  "Teşekkür ederim": { intent: "thanks" },
  "Hayır teşekkür ederim": { intent: "negation" },
  "Teşekkürler": { intent: "thanks" },
  "Bana göre yok teşekkürler": { intent: "thanks" },
  "Teşekkür ederim sağ ol": { intent: "thanks" },
  "eyvallah": { intent: "thanks" },
  "eyw": { intent: "thanks" },
  "sagol": { intent: "thanks" },
  "sağol abi": { intent: "thanks" },

  // Goodbye (were "unknown")
  "Bb": { intent: "goodbye" },
  "bb": { intent: "goodbye" },
  "görüşürüz": { intent: "goodbye" },
  "hadi eyvallah": { intent: "goodbye" },

  // Abuse (were "unknown")
  "Orospu cocu": { intent: "abuse" },
  "Lan pic": { intent: "abuse" },

  // International (were "unknown")
  "Polonya Türkiye varmı": { intent: "international", origin: "polonya", destination: "turkiye" },
  "Rusya ya ya da Irak var mı": { intent: "international" },
  "Adana Gürcistan": { intent: "international", origin: "adana", destination: "gurcistan" },
  "Mersin ırak": { intent: "international", origin: "mersin", destination: "irak" },
  "İstanbul veya Gebze tarafından Bulgaristan'a yük var mı tır": { intent: "international", origin: "istanbul", destination: "bulgaristan" },

  // Spam (were "other" with high latency)
  "Merhaba! Bunun hakkında daha faza bilgi alabilir miyim?": { intent: "spam" },

  // Search that were marked as pagination
  "Kocaeli istanbul": { intent: "search", origin: "kocaeli", destination: "istanbul" },
  "Uşak İstanbul": { intent: "search", origin: "usak", destination: "istanbul" },
  "kocaeli istanbul": { intent: "search", origin: "kocaeli", destination: "istanbul" },
  "İstanbul'dan düzce kapalı tır": { intent: "search", origin: "istanbul", destination: "duzce" },

  // Simple city queries
  "Samsundan": { intent: "search", origin: "samsun" },
  "Ankara": { intent: "search", origin: "ankara" },
  "istanbul": { intent: "search", origin: "istanbul" },
  "İstanbul": { intent: "search", origin: "istanbul" },
  "izmir": { intent: "search", origin: "izmir" },
};

interface TrainingExample {
  messages: Array<{ role: string; content: string }>;
}

function createTrainingExample(userMessage: string, correctIntent: string, origin?: string, destination?: string): TrainingExample {
  const response = JSON.stringify({
    intent: correctIntent,
    origin: origin || null,
    destination: destination || null,
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
  const trainingData: TrainingExample[] = [];

  // Add manual corrections
  console.log("Adding manual corrections...");
  for (const [message, correction] of Object.entries(MANUAL_CORRECTIONS)) {
    trainingData.push(createTrainingExample(
      message,
      correction.intent,
      correction.origin,
      correction.destination
    ));
  }
  console.log(`Added ${Object.keys(MANUAL_CORRECTIONS).length} manual corrections`);

  // Read test results and add successful examples (to maintain good behavior)
  console.log("\nAdding successful examples from test results...");

  const fileStream = fs.createReadStream(RESULTS_FILE);
  const rl = readline.createInterface({ input: fileStream });

  let goodExamples = 0;
  const seenMessages = new Set<string>();

  for await (const line of rl) {
    if (!line.trim()) continue;

    const result = JSON.parse(line);
    const { userMessage, atlasIntent, atlasLatencyMs, hasCityName } = result;

    // Skip if already in manual corrections
    if (MANUAL_CORRECTIONS[userMessage]) continue;

    // Skip duplicates
    if (seenMessages.has(userMessage)) continue;
    seenMessages.add(userMessage);

    // Add good examples: clear intent, low latency, correct behavior
    const isGoodExample =
      atlasIntent !== 'unknown' &&
      atlasIntent !== 'other' &&
      atlasLatencyMs < 4000 &&
      userMessage.length > 2 &&
      userMessage.length < 100;

    if (isGoodExample && goodExamples < 500) {  // Limit to 500 good examples
      // For search intents with cities, try to extract origin/dest
      let origin = null;
      let destination = null;

      if (atlasIntent === 'search' && hasCityName) {
        // Simple heuristic: first city = origin, second = destination
        // (Real parsing is done by the model, this is just for training variety)
      }

      trainingData.push(createTrainingExample(userMessage, atlasIntent, origin, destination));
      goodExamples++;
    }
  }

  console.log(`Added ${goodExamples} good examples`);
  console.log(`Total training examples: ${trainingData.length}`);

  // Write output
  const output = trainingData.map(ex => JSON.stringify(ex)).join('\n');
  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`\nWritten to ${OUTPUT_FILE}`);
}

main().catch(console.error);
