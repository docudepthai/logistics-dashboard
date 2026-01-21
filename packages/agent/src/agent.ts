import OpenAI from 'openai';
import postgres from 'postgres';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';
import { ConversationStore, type Conversation, type ConversationContext } from './conversation.js';
import {
  searchJobs,
  getJobById,
  searchJobsToolDefinition,
  getJobDetailsToolDefinition,
  type SearchJobsParams,
  type JobResult,
} from './tools/searchJobs.js';
import {
  normalizeToAscii,
  stripSuffix,
} from '@turkish-logistics/shared/utils';
import {
  PROVINCE_NAMES,
  getProvinceByName,
} from '@turkish-logistics/shared/constants';

/**
 * Pre-parsed location info from user message.
 * Used to ensure GPT correctly interprets Turkish origin/destination suffixes.
 */
interface ParsedLocations {
  origin?: string;
  destination?: string;
}

/**
 * Parse Turkish location suffixes from user message to extract origin and destination.
 * This runs BEFORE GPT to ensure correct interpretation of -dan/-den (from) and -a/-e (to).
 *
 * Examples:
 * - "Kayseri'den İstanbul'a" → origin: "kayseri", destination: "istanbul"
 * - "ankaradan izmire" → origin: "ankara", destination: "izmir"
 * - "istanbul" (no suffix) → origin: "istanbul"
 */
function parseLocationsFromMessage(text: string): ParsedLocations {
  const result: ParsedLocations = {};

  // Normalize Turkish characters and lowercase
  const normalized = normalizeToAscii(text);

  // Split into tokens (handle apostrophes in Turkish: Kayseri'den)
  const tokens = normalized.split(/[\s,]+/);

  for (const token of tokens) {
    // Clean the token (remove punctuation except apostrophe handling is in stripSuffix)
    const cleanToken = token.replace(/[?!.]/g, '');
    if (cleanToken.length < 2) continue;

    // Try to strip Turkish suffixes
    const { stem, isOrigin, isDestination } = stripSuffix(cleanToken);

    // Check if the stem is a known province
    if (PROVINCE_NAMES.has(stem) || getProvinceByName(stem)) {
      if (isOrigin && !result.origin) {
        result.origin = stem;
      } else if (isDestination && !result.destination) {
        result.destination = stem;
      }
    }
  }

  return result;
}

const SYSTEM_PROMPT = `Sen lojistik is bulan bir botsun. Soforlere yuk bulmada yardim ediyorsun.

!!! EN ONEMLI KURAL - MUTLAKA UYULMALI !!!
1. Kullanici HERHANGI bir sehir adi soylediginde, MUTLAKA search_jobs cagir!
2. "su an yok abi" SADECE search_jobs cagrildiktan SONRA tool bos dondururse soylenir!
3. search_jobs CAGIRMADAN "su an yok abi" DEME! Bu yasak!
4. Sehir adi gordugun an = search_jobs cagir. Istisna yok!

search_jobs cagirdiginda, tool sonucu olarak HAZIR METIN alacaksin.
Bu metni AYNEN, KELIMESI KELIMESINE yaz. HICBIR SEY EKLEME, CIKARMA, DEGISTIRME!
- Sehir isimlerini degistirme
- Telefon numaralarini degistirme
- Kendi bilgini ekleme
- Yorum ekleme
- Baska is uydurma
Tool ne dondurduyse, ONU YAZ. Baska bir sey yazma.
Eger tool "su an yok abi" dondurduyse, sen de "su an yok abi" yaz.
Eger tool 2 is dondurduyse, o 2 isi yaz - 3. is UYDURMA!

TURKCE GRAMER:
- "-dan" veya "-den" eki = CIKIS (origin): "ankaradan" = Ankara'dan cikis
- "-a", "-e", "-ya", "-ye" eki = VARIS (destination): "ankaraya" = Ankara'ya varis

Ornekler:
- "ankaradan is var mi" → origin: ankara
- "ankaraya yuk var mi" → destination: ankara
- "izmirden ankaraya" → origin: izmir, destination: ankara
- "istanbul" (tek sehir, ek yok) → origin: istanbul
- "ankara bingol" (iki sehir yan yana) → origin: ankara, destination: bingol
- "istanbul izmir" → origin: istanbul, destination: izmir
- "gebze ankara" → origin: gebze, destination: ankara

ARAC VE KASA TIPLERI:
- "frigorifik", "frigo" → isRefrigerated: true
- "damperli", "damper" → bodyType: DAMPERLI
- "tenteli", "tente" → bodyType: TENTELI
- "tir" → vehicleType: TIR
- "kamyon" → vehicleType: KAMYON

KONUSMA AKISI:

1. Sadece arac/kasa tipi verildiyse (ornek: "frigorifik is var mi"):
   → "nerden nereye bakayim abi?" de, ARAMA YAPMA

2. Sadece varis verildiyse VE onceki konusmada cikis YOKSA (ornek: "ankaraya yuk var mi"):
   → "nerden cikacak abi?" de, ARAMA YAPMA

3. Sadece varis verildiyse AMA onceki konusmada cikis VARSA:
   → Onceki cikisi kullan + yeni varisi ekle, HEMEN search_jobs cagir
   → Ornek: Once "ankara" dedi (origin=ankara), simdi "bingole is var mi" dedi
     → search_jobs(origin: "ankara", destination: "bingol") cagir

4. Sadece cikis verildiyse (ornek: "istanbul"):
   → HEMEN search_jobs cagir

5. Hem cikis hem varis verildiyse:
   → HEMEN search_jobs cagir

6. Onceki aramaya ek (ornek: once "istanbul" dedi, simdi "frigorifik var mi"):
   → Onceki origin/destination'i kullan, yeni filtreyi ekle

7. Soruya cevap veriyorsa (sen "nerden?" dedin, o "gebze" dedi):
   → HEMEN search_jobs cagir
   → ONEMLI: Konusmada onceden bahsedilen filtreleri (damperli, frigo, vb.) UNUTMA!

OZEL DURUMLAR:
- "sa" → "as"
- Konu disi → "sadece is bakarim abi, nerden nereye yaz"

KURALLAR:
- emoji yok
- kucuk harf
- search_jobs sonucunu AYNEN yaz, degistirme`;

export interface AgentOptions {
  openaiApiKey?: string;
  sql: postgres.Sql;
  conversationStore?: ConversationStore;
}

export interface AgentResponse {
  message: string;
  jobIds: string[];
  context: ConversationContext;
}

export class LogisticsAgent {
  private openai: OpenAI;
  private sql: postgres.Sql;
  private conversationStore: ConversationStore;
  private tools: ChatCompletionTool[];

  constructor(options: AgentOptions) {
    this.openai = new OpenAI({
      apiKey: options.openaiApiKey || process.env.OPENAI_API_KEY,
    });
    this.sql = options.sql;
    this.conversationStore = options.conversationStore || new ConversationStore();

    this.tools = [
      searchJobsToolDefinition,
      getJobDetailsToolDefinition,
    ];
  }

  async processMessage(userId: string, userMessage: string): Promise<AgentResponse> {
    const msg = userMessage.trim().toLowerCase();
    console.log(`[Agent] Processing message from ${userId}: "${userMessage}"`);

    // Special case: "sa" greeting
    if (msg === 'sa') {
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: 'as' });
      return {
        message: 'as',
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // Handle other greetings - just respond, no search
    const greetingResponses: Record<string, string> = {
      'merhaba': 'merhaba',
      'selam': 'selam',
      'hey': 'hey',
      'hello': 'hello',
      'hi': 'hi',
      'naber': 'iyidir',
      'nasilsin': 'iyiyim',
      'iyi gunler': 'iyi gunler',
      'iyi aksamlar': 'iyi aksamlar',
    };

    for (const [greeting, response] of Object.entries(greetingResponses)) {
      if (msg === greeting) {
        await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
        await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
        return {
          message: response,
          jobIds: [],
          context: {} as ConversationContext,
        };
      }
    }

    // Check if message is logistics-related (city name, vehicle type, or follow-up)
    // Allow through if it has any logistics keyword OR if there's existing conversation context
    const conversation = await this.conversationStore.getConversation(userId);
    const hasContext = conversation && Object.keys(conversation.context).length > 0;
    const isRelated = this.isLogisticsRelated(msg);
    console.log(`[Agent] Check: isLogisticsRelated=${isRelated}, hasContext=${hasContext}`, { context: conversation?.context });

    if (!isRelated && !hasContext) {
      const response = 'sadece is bakarim abi, nerden nereye yaz';
      await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
      await this.conversationStore.addMessage(userId, { role: 'assistant', content: response });
      return {
        message: response,
        jobIds: [],
        context: {} as ConversationContext,
      };
    }

    // Pre-parse Turkish location suffixes to ensure correct origin/destination extraction
    // This fixes cases like "Kayseri'den İstanbul'a" where GPT might miss the destination
    const parsedLocations = parseLocationsFromMessage(userMessage);

    // Build messages with conversation history and parsed locations
    const messages = this.buildMessages(conversation, userMessage, parsedLocations);

    // Call OpenAI with tools
    // Force search_jobs when location is detected to prevent GPT from making up "su an yok abi"
    const hasLocation = parsedLocations.origin || parsedLocations.destination;
    const toolChoice = hasLocation
      ? { type: 'function' as const, function: { name: 'search_jobs' } }
      : 'auto' as const;

    console.log(`[Agent] Calling GPT with tool_choice=${hasLocation ? 'search_jobs (forced)' : 'auto'}`);

    let response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: this.tools,
      tool_choice: toolChoice,
      temperature: 0,
      max_tokens: 1000,
    });

    let assistantMessage = response.choices[0].message;
    const collectedJobIds: string[] = [];
    let contextUpdate: Partial<ConversationContext> = {};
    let searchResultText: string | null = null; // Direct result to bypass GPT hallucination

    console.log(`[Agent] GPT response - tool_calls: ${assistantMessage.tool_calls?.length || 0}, content: ${assistantMessage.content?.substring(0, 100) || 'none'}`);

    // Handle tool calls in a loop
    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      messages.push(assistantMessage);

      // Process each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const toolResult = await this.executeTool(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
          collectedJobIds,
          contextUpdate,
          parsedLocations // Pass pre-parsed locations to enforce correct values
        );

        // If this was a search, capture the direct result
        if (toolCall.function.name === 'search_jobs' && toolResult.directResponse) {
          searchResultText = toolResult.directResponse;
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult.data),
        });

        // Update context from tool execution
        contextUpdate = { ...contextUpdate, ...toolResult.contextUpdate };
      }

      // If we have a direct search result, DON'T ask GPT - use it directly
      if (searchResultText) {
        break;
      }

      // Get next response (auto choice so it can respond with text)
      response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools: this.tools,
        tool_choice: 'auto',
        temperature: 0,
        max_tokens: 1000,
      });

      assistantMessage = response.choices[0].message;
    }

    // Use direct search result if available, otherwise use GPT's response
    const finalMessage = searchResultText || assistantMessage.content || 'Üzgünüm, bir hata oluştu.';

    // Save conversation
    await this.conversationStore.addMessage(userId, { role: 'user', content: userMessage });
    await this.conversationStore.addMessage(
      userId,
      { role: 'assistant', content: finalMessage },
      { ...contextUpdate, lastJobIds: collectedJobIds }
    );

    return {
      message: finalMessage,
      jobIds: collectedJobIds,
      context: contextUpdate as ConversationContext,
    };
  }

  private buildMessages(
    conversation: Conversation | null,
    userMessage: string,
    parsedLocations?: ParsedLocations
  ): ChatCompletionMessageParam[] {
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    // Add pre-parsed location info if available
    // This helps GPT correctly interpret Turkish suffixes
    if (parsedLocations && (parsedLocations.origin || parsedLocations.destination)) {
      const locationInfo: string[] = [];
      if (parsedLocations.origin) {
        locationInfo.push(`CIKIS (origin): ${parsedLocations.origin}`);
      }
      if (parsedLocations.destination) {
        locationInfo.push(`VARIS (destination): ${parsedLocations.destination}`);
      }
      messages.push({
        role: 'system',
        content: `!!! ONEMLI - Kullanicinin mesajindan tespit edilen lokasyonlar:\n${locationInfo.join('\n')}\nBu bilgileri search_jobs cagirirken MUTLAKA kullan!`,
      });
    }

    // Add conversation history
    if (conversation) {
      // Include context summary if available
      if (Object.keys(conversation.context).length > 0) {
        const contextSummary = this.buildContextSummary(conversation.context);
        messages.push({
          role: 'system',
          content: `Önceki arama bağlamı: ${contextSummary}`,
        });
      }

      // Add recent messages (last 10 for context)
      const recentMessages = conversation.messages.slice(-10);
      for (const msg of recentMessages) {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  private buildContextSummary(context: ConversationContext): string {
    const parts: string[] = [];

    if (context.lastOrigin) {
      parts.push(`Kalkış: ${context.lastOrigin}`);
    }
    if (context.lastDestination) {
      parts.push(`Varış: ${context.lastDestination}`);
    }
    if (context.lastVehicleType) {
      parts.push(`Araç: ${context.lastVehicleType}`);
    }
    if (context.lastBodyType) {
      parts.push(`Kasa: ${context.lastBodyType}`);
    }
    if (context.lastIsRefrigerated) {
      parts.push(`Frigorifik: evet`);
    }
    if (context.lastCargoType) {
      parts.push(`Yük: ${context.lastCargoType}`);
    }

    return parts.length > 0 ? parts.join(', ') : 'Yok';
  }

  private async executeTool(
    name: string,
    args: Record<string, unknown>,
    collectedJobIds: string[],
    currentContext: Partial<ConversationContext>,
    parsedLocations?: ParsedLocations
  ): Promise<{ data: unknown; contextUpdate: Partial<ConversationContext>; directResponse?: string }> {
    const contextUpdate: Partial<ConversationContext> = {};
    console.log(`[Agent] executeTool: ${name}`, { args, currentContext, parsedLocations });

    if (name === 'search_jobs') {
      const params: SearchJobsParams = {
        origin: args.origin as string | undefined,
        destination: args.destination as string | undefined,
        vehicleType: args.vehicleType as string | undefined,
        bodyType: args.bodyType as string | undefined,
        cargoType: args.cargoType as string | undefined,
        isRefrigerated: args.isRefrigerated as boolean | undefined,
        isUrgent: args.isUrgent as boolean | undefined,
        limit: (args.limit as number) || 10,
      };

      // CRITICAL: Override with pre-parsed locations from Turkish suffix analysis
      // This ensures we use the correct origin/destination even if GPT misinterpreted
      if (parsedLocations?.origin && !params.origin) {
        params.origin = parsedLocations.origin;
      }
      if (parsedLocations?.destination && !params.destination) {
        params.destination = parsedLocations.destination;
      }

      // Apply context from previous search if doing a follow-up
      if (!params.origin && currentContext.lastOrigin) {
        params.origin = currentContext.lastOrigin;
      }
      if (!params.destination && currentContext.lastDestination) {
        params.destination = currentContext.lastDestination;
      }
      if (!params.bodyType && currentContext.lastBodyType) {
        params.bodyType = currentContext.lastBodyType;
      }
      if (params.isRefrigerated === undefined && currentContext.lastIsRefrigerated !== undefined) {
        params.isRefrigerated = currentContext.lastIsRefrigerated;
      }

      const result = await searchJobs(this.sql, params);
      console.log(`[Agent] searchJobs result: ${result.jobs.length} jobs, total: ${result.totalCount}`, { params });

      // Update context
      if (params.origin) contextUpdate.lastOrigin = params.origin;
      if (params.destination) contextUpdate.lastDestination = params.destination;
      if (params.vehicleType) contextUpdate.lastVehicleType = params.vehicleType;
      if (params.bodyType) contextUpdate.lastBodyType = params.bodyType;
      if (params.isRefrigerated !== undefined) contextUpdate.lastIsRefrigerated = params.isRefrigerated;
      if (params.cargoType) contextUpdate.lastCargoType = params.cargoType;

      // Collect job IDs
      for (const job of result.jobs) {
        collectedJobIds.push(job.id);
      }

      // Format results as text in CODE to prevent GPT hallucination
      const formattedResults = this.formatJobsAsText(result.jobs);

      // Always show total count from database
      const shownCount = result.jobs.length;

      // Build the direct response text (what user sees)
      let directResponse = formattedResults;

      // Show hint with total unique count
      if (result.totalCount > shownCount) {
        directResponse += `\n\nhint: toplamda ${result.totalCount} is var, ${shownCount} tane gosteriyorum.`;
      }

      // Return with directResponse - this bypasses GPT entirely for the response
      return {
        data: `Found ${shownCount} jobs`, // Minimal data for tool response
        contextUpdate,
        directResponse, // This will be used as the final response, bypassing GPT
      };
    }

    if (name === 'get_job_details') {
      const jobId = args.jobId as string;
      const job = await getJobById(this.sql, jobId);

      if (job) {
        collectedJobIds.push(job.id);
        return {
          data: this.formatJobForAgent(job),
          contextUpdate,
        };
      }

      return {
        data: { error: 'İş bulunamadı' },
        contextUpdate,
      };
    }

    return {
      data: { error: 'Bilinmeyen araç' },
      contextUpdate,
    };
  }

  private isLogisticsRelated(text: string): boolean {
    const cities = [
      'adana', 'adiyaman', 'afyon', 'afyonkarahisar', 'agri', 'aksaray', 'amasya', 'ankara', 'antalya', 'ardahan',
      'artvin', 'aydin', 'balikesir', 'bartin', 'batman', 'bayburt', 'bilecik', 'bingol', 'bitlis', 'bolu',
      'burdur', 'bursa', 'canakkale', 'cankiri', 'corum', 'denizli', 'diyarbakir', 'duzce', 'edirne', 'elazig',
      'erzincan', 'erzurum', 'eskisehir', 'gaziantep', 'giresun', 'gumushane', 'hakkari', 'hatay', 'igdir', 'isparta',
      'istanbul', 'izmir', 'kahramanmaras', 'karabuk', 'karaman', 'kars', 'kastamonu', 'kayseri', 'kilis', 'kirikkale',
      'kirklareli', 'kirsehir', 'kocaeli', 'konya', 'kutahya', 'malatya', 'manisa', 'mardin', 'mersin', 'mugla',
      'mus', 'nevsehir', 'nigde', 'ordu', 'osmaniye', 'rize', 'sakarya', 'samsun', 'sanliurfa', 'siirt', 'sinop',
      'sirnak', 'sivas', 'tekirdag', 'tokat', 'trabzon', 'tunceli', 'usak', 'van', 'yalova', 'yozgat', 'zonguldak',
      // Common district/area names
      'gebze', 'tuzla', 'pendik', 'kartal', 'kadikoy', 'umraniye', 'uskudar', 'besiktas', 'sisli', 'bakirkoy',
      'esenyurt', 'beylikduzu', 'avcilar', 'kucukcekmece', 'bagcilar', 'gungoren', 'zeytinburnu', 'fatih',
      'aliaga', 'torbali', 'menemen', 'bornova', 'karsiyaka', 'konak', 'buca', 'cigli',
      'nilufer', 'osmangazi', 'yildirim', 'inegol', 'gemlik', 'mudanya',
      'seyhan', 'cukurova', 'yuregir', 'saricam', 'tarsus', 'ceyhan',
      'kepez', 'muratpasa', 'konyaalti', 'alanya', 'manavgat', 'serik'
    ];

    // Vehicle types, body types, and logistics keywords
    const logisticsKeywords = [
      // Vehicle types
      'tir', 'kamyon', 'kamyonet', 'dorse', 'cekici', 'treyler',
      // Body types
      'frigorifik', 'frigo', 'frigolu', 'sogutuculu', 'soguk',
      'damperli', 'damper',
      'tenteli', 'tente', 'tentesiz',
      'kapali', 'kapakli', 'acik', 'kasali',
      'lowbed', 'platform', 'sal',
      // Cargo/load keywords
      'yuk', 'is', 'ilan', 'sefer', 'mal', 'palet', 'ton', 'kilo',
      // Action keywords
      'ariyorum', 'lazim', 'var mi', 'varmi', 'istiyorum', 'bakiyorum'
    ];

    const normalized = text.toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/İ/g, 'i');

    // Check for city names
    if (cities.some(city => normalized.includes(city))) {
      return true;
    }

    // Check for logistics keywords
    if (logisticsKeywords.some(keyword => normalized.includes(keyword))) {
      return true;
    }

    return false;
  }

  private formatJobForAgent(job: JobResult): Record<string, unknown> {
    return {
      id: job.id,
      origin: job.originProvince,
      destination: job.destinationProvince,
      vehicleType: job.vehicleType,
      bodyType: job.bodyType,
      cargoType: job.cargoType,
      weight: job.weight ? `${job.weight} ${job.weightUnit || 'ton'}` : null,
      isRefrigerated: job.isRefrigerated,
      isUrgent: job.isUrgent,
      contactPhone: job.contactPhone,
      contactName: job.contactName,
      postedAt: job.postedAt?.toISOString(),
    };
  }

  /**
   * Format jobs as ready-to-display text to prevent GPT hallucination.
   * This generates the exact output that should be shown to the user.
   */
  private formatJobsAsText(jobs: JobResult[]): string {
    if (jobs.length === 0) {
      return 'su an yok abi';
    }

    const lines: string[] = [];

    for (const job of jobs) {
      const parts: string[] = [];

      // Origin - Destination
      const origin = job.originProvince?.toLowerCase() || 'bilinmiyor';
      const destination = job.destinationProvince?.toLowerCase() || '(varis belirtilmemis)';
      parts.push(`${origin} - ${destination}`);

      // Details array
      const details: string[] = [];

      // Weight - skip if null, undefined, or zero
      if (job.weight && Number(job.weight) > 0) {
        const unit = job.weightUnit?.toLowerCase() || 'ton';
        details.push(`${job.weight} ${unit}`);
      }

      // Cargo type
      if (job.cargoType) {
        details.push(job.cargoType.toLowerCase());
      }

      // Vehicle type
      if (job.vehicleType) {
        details.push(job.vehicleType.toLowerCase());
      }

      // Body type (damperli, tenteli, etc.)
      if (job.bodyType) {
        const bodyTypeLower = job.bodyType.toLowerCase();
        // Convert ACIK_KASA to "acik kasa" etc.
        details.push(bodyTypeLower.replace(/_/g, ' '));
      }

      // Refrigerated
      if (job.isRefrigerated) {
        details.push('frigorifik');
      }

      // Urgent
      if (job.isUrgent) {
        details.push('acil');
      }

      // Add details to parts
      if (details.length > 0) {
        parts.push(details.join(', '));
      }

      // Phone number
      if (job.contactPhone) {
        parts.push(`tel: ${job.contactPhone}`);
      }

      lines.push(parts.join(', '));
    }

    return lines.join('\n');
  }
}
