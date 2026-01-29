/**
 * Atlas Intent Types and Response Templates
 * Comprehensive intent handling for Turkish logistics bot
 */

export type Intent =
  // Core search intents
  | 'search'           // istanbul ankara, yük var mı
  | 'pagination'       // devam, daha fazla, sonraki
  | 'intra_city'       // istanbul içi, şehir içi

  // Greetings & Social
  | 'greeting'         // merhaba, selam, sa
  | 'goodbye'          // görüşürüz, bye, hoşçakal
  | 'thanks'           // teşekkürler, sağol, eyvallah

  // Bot & Service Questions
  | 'bot_identity'     // sen kimsin, bot musun, gerçek mi
  | 'help'             // nasıl kullanılır, yardım
  | 'pricing'          // ücretli mi, kaç para, fiyat
  | 'subscription'     // premium, abone, üyelik
  | 'support'          // destek, şikayet, sorun

  // Load-specific Questions
  | 'phone_question'   // telefon neden yok, numara
  | 'load_price'       // navlun, yük fiyatı neden yok
  | 'load_details'     // tonaj, araç tipi, detay
  | 'freshness'        // ne zaman güncelleniyor, taze mi

  // User Info
  | 'vehicle_info'     // bende tır var, kamyonum var
  | 'location_info'    // istanbul'dayım, ankaradayım

  // Feedback
  | 'feedback_positive'  // güzel, süper, işe yarıyor
  | 'feedback_negative'  // kötü, berbat, işe yaramıyor

  // Conversation Flow
  | 'confirmation'     // tamam, evet, ok
  | 'negation'         // hayır, istemiyorum
  | 'clarification'    // anlamadım, tekrar, ne demek

  // Special Cases
  | 'abuse'            // küfür, hakaret
  | 'spam'             // bot mesajı, spam
  | 'international'    // yurtdışı rotaları

  // Catch-all
  | 'other';           // off-topic, random chat

/**
 * Response templates for each intent
 * Multiple options for variety, randomly selected
 */
export const RESPONSE_TEMPLATES: Record<Intent, string[]> = {
  // === SEARCH ===
  search: [], // Handled dynamically with job results
  pagination: [], // Handled dynamically
  intra_city: [], // Handled dynamically

  // === GREETINGS ===
  greeting: [
    'merhaba, ben patron. nerden nereye bakmamı istersin?',
    'selam! yük mü arıyorsun? şehir yaz bakalım.',
    'merhaba, hazırım. nerden nereye?',
  ],
  goodbye: [
    'görüşürüz, hayırlı yolculuklar!',
    'kolay gelsin abi, iyi seferler!',
    'güle güle, yine beklerim.',
  ],
  thanks: [
    'rica ederim, hayırlı işler!',
    'ne demek, kolay gelsin!',
    'önemli değil abi, iyi yolculuklar!',
  ],

  // === BOT & SERVICE ===
  bot_identity: [
    'evet, atlas-1 modeliyim. patron tarafından türk şoförler için geliştirildi. yük bulmak için şehir yaz.',
    'ben patron, yapay zeka destekli yük asistanı. 7/24 buradayım. nerden nereye bakalım?',
    'yapay zekayım abi, ama işimi iyi biliyorum. şehir yaz, yük bulalım.',
  ],
  help: [
    'çok basit: şehir yaz, yük bulayım.\n\nörnekler:\n• istanbul ankara\n• frigorifik izmir antalya\n• tenteli bursa\n\nfiltre de ekleyebilirsin: tır, kamyon, parsiyel, komple',
    'kullanımı kolay:\n1. nerden nereye yaz (örn: istanbul ankara)\n2. istersen araç tipi ekle (tır, kamyon)\n3. yükleri göstereyim\n\ndevam de, daha fazla göstereyim.',
  ],
  pricing: [
    'ilk 7 gün tamamen ücretsiz. sonra ayda 179₺. ama önce dene, nerden nereye bakalım?',
    '7 günlük deneme bedava, sonra 179₺/ay. şimdilik ücretsiz, hadi bi rota söyle.',
    'deneme süresi ücretsiz abi. beğenirsen devam edersin. şehir yaz bakalım.',
  ],
  subscription: [
    'premium üyelik ayda 179₺. telefon numaraları + sınırsız arama + öncelikli destek. 7 gün bedava dene önce.',
    'üyelik için patron.com.tr\'ye gir veya whatsapp\'tan "abone olmak istiyorum" yaz.',
    'premium\'da telefon numaralarını görürsün + reklamsız + öncelikli. 7 gün bedava.',
  ],
  support: [
    'sorun mu var abi? patron.com.tr/destek\'ten veya 0850 XXX XX XX\'den ulaşabilirsin.',
    'yardımcı olmaya çalışayım. ne oldu? yoksa destek için patron.com.tr/iletisim',
    'bi aksilik mi var? anlat bakalım, belki çözerim. yoksa destek ekibine bağlayalım.',
  ],

  // === LOAD QUESTIONS ===
  phone_question: [
    'telefon numaraları premium üyelere açık. 7 günlük denemede aktif olacak, merak etme.',
    'numara görmek için premium lazım abi. ama 7 gün bedava, dene görürsün.',
    'iletişim bilgileri premium özelliği. deneme süresinde açılacak.',
  ],
  load_price: [
    'fiyatlar genelde telefonda konuşuluyor abi. biz sadece yükü ve rotayı gösteriyoruz, anlaşma size kalmış.',
    'navlun telefonda pazarlık konusu. ben yükü buluyorum, fiyatı sen konuşursun.',
    'fiyat bilgisi yok çünkü her iş farklı. yük sahibiyle konuşunca netleşir.',
  ],
  load_details: [
    'detaylı bilgi için yük sahibini aramanız lazım. biz genel bilgiyi gösteriyoruz.',
    'tonaj, ölçü gibi detaylar telefonda netleşir abi. burada genel bilgi var.',
  ],
  freshness: [
    'yükler sürekli güncelleniyor, yeni ilanlar anında düşüyor. her arama güncel sonuç verir.',
    'sistem canlı, yükler anlık geliyor. whatsapp gruplarından ve borsalardan topluyoruz.',
    'her saat yeni yükler ekleniyor. sık sık kontrol et, kaçırma.',
  ],

  // === USER INFO ===
  vehicle_info: [
    'tamam {vehicle} kaydettim. nereye gitmek istiyorsun?',
    'not aldım, {vehicle}. hangi rotaya bakalım?',
    '{vehicle} var demek. nerden nereye yük arıyorsun?',
  ],
  location_info: [
    'tamam {location}\'dasın. nereye gitmek istiyorsun?',
    '{location}\'dan mı bakayım? nereye?',
    'anladım, {location}. hedef neresi?',
  ],

  // === FEEDBACK ===
  feedback_positive: [
    'teşekkürler abi! başkalarına da öner, büyüyelim.',
    'sevindim işe yaradıysa. hayırlı işler!',
    'güzel, devam edelim o zaman. başka rota var mı?',
  ],
  feedback_negative: [
    'üzüldüm abi. ne sıkıntı var anlat, düzeltmeye çalışalım.',
    'kusura bakma, geliştiriyoruz sürekli. sorunu söyle bi.',
    'hay aksi, noldu? feedback önemli bizim için.',
  ],

  // === CONVERSATION FLOW ===
  confirmation: [
    'tamam, devam edelim. ne yapayım?',
    'anladım. başka bi şey var mı?',
    'ok, hazırım. söyle.',
  ],
  negation: [
    'tamam, başka bi şey lazım olursa yaz.',
    'anladım. farklı bi rota deneyelim mi?',
    'ok, buradayım lazım olursa.',
  ],
  clarification: [
    'şöyle yapabilirsin: nerden nereye yaz. örnek: istanbul ankara',
    'basit tut: iki şehir yaz. mesela "izmir antalya"',
    'anlamadıysam özür dilerim. şehir ismi yaz, yük bulayım.',
  ],

  // === SPECIAL CASES ===
  abuse: [
    'abi sakin ol, yardımcı olmaya çalışıyorum. şehir yaz, yük bulalım.',
    'küfür etmene gerek yok abi. iş yapalım, nerden nereye?',
    'tamam abi anladım. sakinleşince yük aramaya devam ederiz.',
  ],
  spam: [
    'bu mesaj spam gibi görünüyor. gerçek bi soru varsa yaz.',
    'abi normal yaz lütfen. nerden nereye yük arıyorsun?',
  ],
  international: [
    'şu an sadece türkiye içi yükler var abi. yurtdışı için farklı platformlar lazım.',
    'yurtdışı rotaları henüz desteklemiyoruz. türkiye içi bi rota söyle?',
    'uluslararası yükler için farklı kaynaklara bakmanız lazım. biz türkiye içi çalışıyoruz.',
  ],

  // === CATCH-ALL ===
  other: [
    'abi ben yük buluyorum, bu konuda yardımcı olamam. şehir yaz bakalım.',
    'bu benim alanım değil abi. yük için nerden nereye söyle.',
    'sadece yük işine bakıyorum. bi rota söyle, iş yapalım.',
    'hmm bunu bilmiyorum. ama yük bulabilirim - şehir yaz?',
  ],
};

/**
 * Get a random response for an intent
 */
export function getResponse(intent: Intent, params?: Record<string, string>): string {
  const templates = RESPONSE_TEMPLATES[intent];
  if (!templates || templates.length === 0) {
    return '';
  }

  let response = templates[Math.floor(Math.random() * templates.length)];

  // Replace placeholders
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      response = response.replace(`{${key}}`, value);
    }
  }

  return response;
}

/**
 * Keywords that help identify intents (backup for when Atlas fails)
 */
export const INTENT_KEYWORDS: Record<Intent, string[]> = {
  search: [], // Detected by city names
  pagination: ['devam', 'daha', 'sonraki', 'fazla', 'göster', 'next'],
  intra_city: ['içi', 'içinde', 'şehir içi'],

  greeting: ['merhaba', 'selam', 'sa', 'slm', 'mrb', 'günaydın', 'iyi akşamlar', 'iyi günler', 'hey', 'hi', 'hello'],
  goodbye: ['görüşürüz', 'bye', 'bb', 'hoşçakal', 'güle güle', 'kendine iyi bak'],
  thanks: ['teşekkür', 'sağol', 'eyvallah', 'tşk', 'saol', 'eyv', 'thanks'],

  bot_identity: ['sen kimsin', 'bot musun', 'robot musun', 'gerçek mi', 'insan mı', 'yapay zeka', 'ai', 'kim bu', 'nesin sen'],
  help: ['yardım', 'help', 'nasıl kullan', 'ne yapıyorsun', 'nasıl çalışıyor', 'örnek', 'anlamadım nasıl'],
  pricing: ['ücret', 'fiyat', 'kaç para', 'kaç tl', 'bedava', 'ücretsiz', 'paralı', 'ne kadar'],
  subscription: ['premium', 'abone', 'üyelik', 'üye ol', 'satın al', 'paket'],
  support: ['destek', 'şikayet', 'sorun', 'çalışmıyor', 'hata', 'bug', 'müşteri hizmetleri'],

  phone_question: ['telefon', 'numara', 'iletişim', 'aramak', 'neden yok telefon', 'numara yok'],
  load_price: ['navlun', 'yük fiyat', 'kaç lira', 'ücret yok', 'fiyat yok', 'ne kadar veriyor'],
  load_details: ['tonaj', 'kaç ton', 'ölçü', 'boyut', 'detay', 'bilgi'],
  freshness: ['ne zaman', 'güncel mi', 'taze mi', 'yeni yük', 'güncelleniyor mu', 'kaç saatlik'],

  vehicle_info: ['bende', 'benim', 'var', 'aracım', 'kamyonum', 'tırım', 'dorsem'],
  location_info: ['dayım', 'deyim', 'burdayım', 'buradayım', 'şu an'],

  feedback_positive: ['güzel', 'süper', 'harika', 'işe yarıyor', 'mükemmel', 'çok iyi', 'beğendim', 'sevdim'],
  feedback_negative: ['kötü', 'berbat', 'işe yaramıyor', 'boş', 'saçma', 'beğenmedim', 'sevmedim', 'rezalet'],

  confirmation: ['tamam', 'ok', 'evet', 'olur', 'tamamdır', 'oki', 'yes', 'he', 'hee'],
  negation: ['hayır', 'yok', 'istemiyorum', 'olmaz', 'no', 'nope', 'gerek yok'],
  clarification: ['anlamadım', 'tekrar', 'ne demek', 'nasıl yani', 'açıkla', '?'],

  abuse: ['orospu', 'piç', 'pic', 'siktir', 'amk', 'ananı', 'sikim', 'göt', 'yarak'],
  spam: ['bunun hakkında daha fazla', 'daha fazla bilgi alabilir', 'more information'],
  international: ['bulgaristan', 'gürcistan', 'gurcistan', 'yunanistan', 'irak', 'iran', 'suriye', 'rusya', 'ukrayna', 'polonya', 'almanya', 'fransa', 'hollanda', 'belçika', 'avrupa', 'ihracat', 'transit'],

  other: [], // Catch-all
};
