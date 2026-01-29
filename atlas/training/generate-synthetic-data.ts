/**
 * Generate comprehensive synthetic training data for Atlas
 * Covers all weak areas with variations
 */

import * as fs from 'fs';

const OUTPUT_FILE = './synthetic-training.jsonl';

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

interface TrainingExample {
  messages: Array<{ role: string; content: string }>;
}

function makeExample(userMessage: string, intent: string, origin?: string, dest?: string): TrainingExample {
  return {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
      { role: "assistant", content: JSON.stringify({
        intent,
        origin: origin || null,
        destination: dest || null,
        vehicle_type: null,
        cargo_type: null
      })}
    ]
  };
}

// ============= INTERNATIONAL ROUTES =============
const TURKISH_CITIES = [
  "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya", "gaziantep",
  "mersin", "kayseri", "eskişehir", "samsun", "trabzon", "erzurum", "diyarbakır",
  "malatya", "van", "hatay", "manisa", "denizli", "kocaeli", "sakarya", "tekirdağ",
  "gebze", "çorlu", "adapazarı"
];

const INTERNATIONAL_DESTINATIONS = [
  "bulgaristan", "gürcistan", "gurcistan", "yunanistan", "irak", "iran", "suriye",
  "rusya", "ukrayna", "polonya", "almanya", "fransa", "italya", "hollanda",
  "belçika", "avusturya", "macaristan", "romanya", "sırbistan", "makedonya",
  "arnavutluk", "kosova", "bosna", "hırvatistan", "slovenya", "çekya",
  "avrupa", "ortadoğu", "balkanlar"
];

const internationalExamples: TrainingExample[] = [];

// Pattern: "city country"
for (const city of TURKISH_CITIES.slice(0, 15)) {
  for (const country of INTERNATIONAL_DESTINATIONS.slice(0, 10)) {
    internationalExamples.push(makeExample(`${city} ${country}`, "international", city, country));
  }
}

// Pattern: "city'den country'ye"
const cityCountryPairs = [
  ["istanbul", "bulgaristan"], ["istanbul", "almanya"], ["istanbul", "polonya"],
  ["ankara", "irak"], ["ankara", "iran"], ["gaziantep", "suriye"],
  ["trabzon", "gürcistan"], ["erzurum", "iran"], ["van", "iran"],
  ["mersin", "irak"], ["adana", "suriye"], ["hatay", "suriye"],
  ["izmir", "yunanistan"], ["tekirdağ", "bulgaristan"], ["edirne", "bulgaristan"],
  ["bursa", "almanya"], ["kocaeli", "avrupa"], ["gebze", "avrupa"],
];

for (const [city, country] of cityCountryPairs) {
  internationalExamples.push(makeExample(`${city}'den ${country}'ye`, "international", city, country));
  internationalExamples.push(makeExample(`${city}dan ${country}a`, "international", city, country));
  internationalExamples.push(makeExample(`${city} - ${country}`, "international", city, country));
  internationalExamples.push(makeExample(`${city} ${country} yük var mı`, "international", city, country));
  internationalExamples.push(makeExample(`${city} ${country} tır`, "international", city, country));
}

// Questions about international
const internationalQuestions = [
  "yurtdışı yük var mı",
  "avrupa yükü arıyorum",
  "ihracat yükü var mı",
  "export yük",
  "balkan ülkelerine yük",
  "ortadoğuya yük var mı",
  "irak iran tarafı",
  "rusyaya yük",
  "almanyaya gidecek yük",
  "bulgaristana yük lazım",
  "gürcistana gidiyorum yük var mı",
];
for (const q of internationalQuestions) {
  internationalExamples.push(makeExample(q, "international"));
}

// ============= THANKS =============
const thanksExamples: TrainingExample[] = [
  "teşekkürler",
  "teşekkür ederim",
  "çok teşekkürler",
  "sağol",
  "sağ ol",
  "sağolun",
  "eyvallah",
  "eyv",
  "eyw",
  "sagol",
  "saol",
  "tamam teşekkürler",
  "tamam sağol",
  "ok teşekkürler",
  "teşekkür ederim abi",
  "sağol abi",
  "sağol kardeşim",
  "teşekkürler hocam",
  "çok sağol",
  "teşekkür ettim",
  "tşk",
  "tşkler",
  "tşk ederim",
  "yok teşekkürler",
  "hayır teşekkürler",
  "olmadı teşekkürler",
  "bulamadık sağol",
  "baktım teşekkürler",
  "ilgilenmiyorum teşekkürler",
  "şimdilik teşekkürler",
  "sonra bakarım sağol",
].map(msg => makeExample(msg, "thanks"));

// ============= GOODBYE =============
const goodbyeExamples: TrainingExample[] = [
  "bb",
  "bye",
  "bay bay",
  "görüşürüz",
  "hoşçakal",
  "hoşça kal",
  "hadi eyvallah",
  "eyvallah hadi",
  "kendine iyi bak",
  "iyi günler",
  "iyi akşamlar",
  "iyi geceler",
  "hayırlı işler",
  "kolay gelsin hadi",
  "hadi bb",
  "tamam bb",
  "ok bb",
  "görüşmek üzere",
  "sonra görüşürüz",
  "hadi görüşürüz",
  "kapatıyorum",
  "ben kaçıyorum",
  "gitmem lazım",
].map(msg => makeExample(msg, "goodbye"));

// ============= ABUSE =============
const abuseExamples: TrainingExample[] = [
  "orospu",
  "orospu çocuğu",
  "orospu cocu",
  "piç",
  "pic",
  "piç kurusu",
  "siktir",
  "siktir git",
  "siktirgit",
  "amk",
  "amına koyim",
  "amına koyayım",
  "ananı",
  "ananı sikeyim",
  "sikerim",
  "sikeyim",
  "yallah",
  "defol",
  "salak",
  "aptal",
  "gerizekalı",
  "mal",
  "dangalak",
  "hıyar",
  "puşt",
  "ibne",
  "göt",
  "yarrak",
  "sg",
  "s.g",
  "aq",
  "a.q",
  "mq",
].map(msg => makeExample(msg, "abuse"));

// ============= SPAM =============
const spamExamples: TrainingExample[] = [
  "Merhaba! Bunun hakkında daha fazla bilgi alabilir miyim?",
  "Merhaba! Bunun hakkında daha faza bilgi alabilir miyim?",
  "Bu konuda daha fazla bilgi alabilir miyim?",
  "Detaylı bilgi alabilir miyim?",
  "Bu ürün hakkında bilgi",
  "Fiyat bilgisi alabilir miyim",
  "İletişime geçebilir misiniz",
  "Numara paylaşır mısınız",
  "WhatsApp numaranız nedir",
  "Reklam yapmak istiyorum",
  "İş birliği yapmak ister misiniz",
  "Tanıtım fırsatı",
  "Özel teklif",
  "Kazanç fırsatı",
  "Evden çalışma imkanı",
  "Günlük 500 TL kazanın",
].map(msg => makeExample(msg, "spam"));

// ============= CONFIRMATION =============
const confirmationExamples: TrainingExample[] = [
  "tamam",
  "ok",
  "okay",
  "olur",
  "evet",
  "he",
  "hee",
  "hı hı",
  "aynen",
  "doğru",
  "tamamdır",
  "oldu",
  "kabul",
  "anladım",
  "anlaştık",
  "uygun",
  "peki",
  "tamam anladım",
  "ok anladım",
  "evet olur",
  "tamam bakarım",
  "olur bakarım",
].map(msg => makeExample(msg, "confirmation"));

// ============= NEGATION =============
const negationExamples: TrainingExample[] = [
  "hayır",
  "yok",
  "istemiyorum",
  "istemem",
  "olmaz",
  "gerek yok",
  "lazım değil",
  "boşver",
  "bırak",
  "ilgilenmiyorum",
  "başka bir şey",
  "vazgeçtim",
  "iptal",
  "hayır istemiyorum",
  "yok gerek yok",
  "bana göre değil",
  "uymuyor",
  "olmadı",
  "pas",
  "geçiyorum",
].map(msg => makeExample(msg, "negation"));

// ============= GREETING =============
const greetingExamples: TrainingExample[] = [
  "merhaba",
  "merhabalar",
  "selam",
  "selamün aleyküm",
  "sa",
  "as",
  "günaydın",
  "iyi günler",
  "iyi akşamlar",
  "hey",
  "hi",
  "slm",
  "mrb",
  "selamlar",
  "herkese merhaba",
  "merhaba patron",
  "selam abi",
].map(msg => makeExample(msg, "greeting"));

// ============= PAGINATION =============
const paginationExamples: TrainingExample[] = [
  "devam",
  "daha fazla",
  "daha",
  "başka",
  "başka var mı",
  "sonraki",
  "sonrakiler",
  "diğerleri",
  "diğer",
  "bir daha",
  "tekrar",
  "daha göster",
  "devam et",
  "devam edelim",
  "daha fazla göster",
  "başka yükler",
  "diğer yükler",
  "sonraki sayfa",
  "daha var mı",
  "başka ne var",
].map(msg => makeExample(msg, "pagination"));

// ============= INTRA-CITY =============
const intraCityExamples: TrainingExample[] = [];
const cities = ["istanbul", "ankara", "izmir", "bursa", "antalya", "konya", "adana", "gaziantep"];
for (const city of cities) {
  intraCityExamples.push(makeExample(`${city} içi`, "intra_city", city, city));
  intraCityExamples.push(makeExample(`${city} ici`, "intra_city", city, city));
  intraCityExamples.push(makeExample(`${city} şehir içi`, "intra_city", city, city));
  intraCityExamples.push(makeExample(`${city} içinde`, "intra_city", city, city));
  intraCityExamples.push(makeExample(`${city} içi yük`, "intra_city", city, city));
}

// ============= PRICING =============
const pricingExamples: TrainingExample[] = [
  "fiyat ne",
  "fiyatı ne",
  "kaç para",
  "ne kadar",
  "ücretli mi",
  "ücretsiz mi",
  "paralı mı",
  "bedava mı",
  "aylık ücreti ne",
  "haftalık kaç para",
  "deneme süresi var mı",
  "7 günden sonra ne kadar",
  "premium fiyatı",
  "vip üyelik kaç para",
].map(msg => makeExample(msg, "pricing"));

// ============= SUBSCRIPTION =============
const subscriptionExamples: TrainingExample[] = [
  "abone olmak istiyorum",
  "üye olmak istiyorum",
  "premium almak istiyorum",
  "vip üyelik",
  "üyelik nasıl alınır",
  "abone oldum mu",
  "üyeliğim var mı",
  "deneme sürem bitti",
  "üyelik yenilemek istiyorum",
  "abonelik iptal",
].map(msg => makeExample(msg, "subscription"));

// ============= VEHICLE INFO =============
const vehicleInfoExamples: TrainingExample[] = [
  "bende tır var",
  "kamyonum var",
  "aracım var",
  "13.60 tenteli var",
  "tırım boş",
  "aracım hazır",
  "frigo tırım var",
  "kamyonumla yük almak istiyorum",
  "10 tonluk kamyonum var",
  "panelvan var bende",
  "doblo var",
  "mercedes actros var",
  "scania var",
].map(msg => makeExample(msg, "vehicle_info"));

// ============= LOCATION INFO =============
const locationInfoExamples: TrainingExample[] = [
  "istanbuldayım",
  "istanbul'dayım",
  "ankaradayım",
  "buradayım",
  "burdayım",
  "gebzedeyim",
  "şu an izmirdeyim",
  "konumum ankara",
  "mevcut konum istanbul",
  "şu an neredeyim",
].map(msg => makeExample(msg, "location_info"));

// ============= BOT IDENTITY =============
const botIdentityExamples: TrainingExample[] = [
  "sen kimsin",
  "kimsin sen",
  "bot musun",
  "robot musun",
  "gerçek misin",
  "insan mısın",
  "yapay zeka mısın",
  "canlı destek mi bu",
  "otomatik mesaj mı",
  "kim yazıyor",
].map(msg => makeExample(msg, "bot_identity"));

// ============= HELP =============
const helpExamples: TrainingExample[] = [
  "nasıl kullanılır",
  "yardım",
  "help",
  "ne yapabilirim",
  "nasıl yük bulurum",
  "örnek göster",
  "nasıl arama yapılır",
  "komutlar ne",
  "ne yazmalıyım",
  "anlamadım nasıl kullanıyorum",
].map(msg => makeExample(msg, "help"));

// ============= FEEDBACK POSITIVE =============
const feedbackPositiveExamples: TrainingExample[] = [
  "güzel",
  "süper",
  "harika",
  "çok iyi",
  "mükemmel",
  "işe yarıyor",
  "faydalı",
  "güzel uygulama",
  "beğendim",
  "tavsiye ederim",
].map(msg => makeExample(msg, "feedback_positive"));

// ============= FEEDBACK NEGATIVE =============
const feedbackNegativeExamples: TrainingExample[] = [
  "kötü",
  "berbat",
  "işe yaramıyor",
  "faydasız",
  "boş iş",
  "çalışmıyor",
  "beğenmedim",
  "saçma",
  "rezalet",
  "hiç yük yok",
].map(msg => makeExample(msg, "feedback_negative"));

// ============= OTHER (irrelevant) =============
const otherExamples: TrainingExample[] = [
  "hava durumu nasıl",
  "bugün maç var mı",
  "dolar kaç",
  "bitcoin ne kadar",
  "saat kaç",
  "kız arkadaşım yok",
  "yemek tarifi",
  "film önerisi",
  "şarkı söyle",
  "fıkra anlat",
  "çeviri yap",
  "matematik sorusu",
].map(msg => makeExample(msg, "other"));

// ============= COMBINE ALL =============
const allExamples = [
  ...internationalExamples,
  ...thanksExamples,
  ...goodbyeExamples,
  ...abuseExamples,
  ...spamExamples,
  ...confirmationExamples,
  ...negationExamples,
  ...greetingExamples,
  ...paginationExamples,
  ...intraCityExamples,
  ...pricingExamples,
  ...subscriptionExamples,
  ...vehicleInfoExamples,
  ...locationInfoExamples,
  ...botIdentityExamples,
  ...helpExamples,
  ...feedbackPositiveExamples,
  ...feedbackNegativeExamples,
  ...otherExamples,
];

// Summary
console.log('=== Synthetic Training Data Generator ===\n');
console.log('Examples by intent:');
console.log(`  international: ${internationalExamples.length}`);
console.log(`  thanks: ${thanksExamples.length}`);
console.log(`  goodbye: ${goodbyeExamples.length}`);
console.log(`  abuse: ${abuseExamples.length}`);
console.log(`  spam: ${spamExamples.length}`);
console.log(`  confirmation: ${confirmationExamples.length}`);
console.log(`  negation: ${negationExamples.length}`);
console.log(`  greeting: ${greetingExamples.length}`);
console.log(`  pagination: ${paginationExamples.length}`);
console.log(`  intra_city: ${intraCityExamples.length}`);
console.log(`  pricing: ${pricingExamples.length}`);
console.log(`  subscription: ${subscriptionExamples.length}`);
console.log(`  vehicle_info: ${vehicleInfoExamples.length}`);
console.log(`  location_info: ${locationInfoExamples.length}`);
console.log(`  bot_identity: ${botIdentityExamples.length}`);
console.log(`  help: ${helpExamples.length}`);
console.log(`  feedback_positive: ${feedbackPositiveExamples.length}`);
console.log(`  feedback_negative: ${feedbackNegativeExamples.length}`);
console.log(`  other: ${otherExamples.length}`);
console.log(`\nTotal: ${allExamples.length}`);

// Write output
const output = allExamples.map(ex => JSON.stringify(ex)).join('\n');
fs.writeFileSync(OUTPUT_FILE, output);
console.log(`\nWritten to ${OUTPUT_FILE}`);
