/**
 * Run Atlas Agent Tests
 * Processes all user messages through Atlas and captures results
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import postgres from 'postgres';
import { AtlasAgent, type AtlasAgentResponse } from '../../packages/agent/src/atlas-agent.js';
import type { Intent } from '../../packages/agent/src/intents.js';

// Configuration
const CONCURRENCY = 1;  // Process one at a time
const DELAY_BETWEEN_MESSAGES_MS = 0;  // No delay needed at CONCURRENCY=1
const INPUT_FILE = path.join(__dirname, '../../test-data/conversations.jsonl');
const OUTPUT_FILE = path.join(__dirname, '../../test-data/results.jsonl');

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ConversationRecord {
  userId: string;
  messages: Message[];
  context: Record<string, unknown>;
}

interface TestResult {
  conversationId: string;
  messageIndex: number;
  userMessage: string;
  previousAssistantResponse?: string;

  // Atlas results
  atlasIntent: Intent | 'error' | 'unknown';
  atlasResponse: string;
  atlasJobCount: number;
  atlasLatencyMs: number;
  atlasError?: string;

  // Parsed context
  parsedOrigin?: string;
  parsedDestination?: string;

  // Quality indicators (populated by analyzer)
  hasLocationInMessage: boolean;
  hasCityName: boolean;
  isSearchLike: boolean;

  timestamp: string;
}

// Turkish city names for detection
const TURKISH_CITIES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep',
  'mersin', 'diyarbakir', 'kayseri', 'eskisehir', 'sanliurfa', 'samsun', 'denizli',
  'malatya', 'trabzon', 'erzurum', 'van', 'hatay', 'manisa', 'sakarya', 'balikesir',
  'tekirdag', 'kocaeli', 'mugla', 'aydin', 'ordu', 'kahramanmaras', 'afyonkarahisar',
  'sivas', 'tokat', 'giresun', 'isparta', 'aksaray', 'elazig', 'corum', 'edirne',
  'usak', 'mardin', 'kirklareli', 'rize', 'canakkale', 'zonguldak', 'kutahya',
  'nigde', 'kastamonu', 'bolu', 'karabuk', 'amasya', 'artvin', 'duzce', 'nevsehir',
  'kars', 'sirnak', 'batman', 'agri', 'sinop', 'mus', 'bingol', 'bitlis', 'hakkari',
  'kilis', 'ardahan', 'tunceli', 'igdir', 'bartin', 'karaman', 'kirikkale', 'kirsehir',
  'yalova', 'gumushane', 'bilecik', 'bayburt', 'osmaniye', 'adiyaman', 'siirt',
  // Common abbreviations
  'ist', 'ank', 'izm', 'ant', 'antep', 'urfa'
];

function containsCityName(message: string): boolean {
  const normalized = message.toLowerCase()
    .replace(/[ıİ]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c');

  return TURKISH_CITIES.some(city => {
    // Check for word boundary
    const regex = new RegExp(`(^|[^a-z])${city}([^a-z]|$|dan|den|a|e|ya|ye|da|de|tan|ten)`, 'i');
    return regex.test(normalized);
  });
}

function isSearchLikeMessage(message: string): boolean {
  const searchIndicators = [
    /yuk\s*(var|ara|bul)/i,
    /var\s*mi/i,
    /bakar\s*misin/i,
    /nereye/i,
    /nereden/i,
    /dan.*ya|den.*ye|dan.*a|den.*e/i,
    /bolge/i,
    /ici/i,
  ];
  return searchIndicators.some(r => r.test(message)) || containsCityName(message);
}

async function processConversation(
  agent: AtlasAgent,
  conversation: ConversationRecord,
  outputStream: fs.WriteStream
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < conversation.messages.length; i++) {
    const msg = conversation.messages[i];

    // Only test user messages
    if (msg.role !== 'user') continue;

    // Skip very short messages (single characters)
    if (msg.content.trim().length < 2) continue;

    // Get previous assistant response for context
    const prevMsg = i > 0 ? conversation.messages[i - 1] : undefined;
    const previousAssistantResponse = prevMsg?.role === 'assistant' ? prevMsg.content : undefined;

    const startTime = Date.now();
    let result: TestResult;

    try {
      // Use a unique test user ID to avoid polluting real conversations
      const testUserId = `TEST_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const response = await agent.processMessage(testUserId, msg.content);
      const latency = Date.now() - startTime;

      result = {
        conversationId: conversation.userId,
        messageIndex: i,
        userMessage: msg.content,
        previousAssistantResponse,

        atlasIntent: response.intent || 'unknown',
        atlasResponse: response.message,
        atlasJobCount: response.jobIds?.length || 0,
        atlasLatencyMs: latency,

        parsedOrigin: response.context?.lastOrigin,
        parsedDestination: response.context?.lastDestination,

        hasLocationInMessage: containsCityName(msg.content),
        hasCityName: containsCityName(msg.content),
        isSearchLike: isSearchLikeMessage(msg.content),

        timestamp: new Date().toISOString(),
      };

      processed++;
    } catch (error) {
      const latency = Date.now() - startTime;

      result = {
        conversationId: conversation.userId,
        messageIndex: i,
        userMessage: msg.content,
        previousAssistantResponse,

        atlasIntent: 'error',
        atlasResponse: '',
        atlasJobCount: 0,
        atlasLatencyMs: latency,
        atlasError: error instanceof Error ? error.message : String(error),

        hasLocationInMessage: containsCityName(msg.content),
        hasCityName: containsCityName(msg.content),
        isSearchLike: isSearchLikeMessage(msg.content),

        timestamp: new Date().toISOString(),
      };

      errors++;
    }

    outputStream.write(JSON.stringify(result) + '\n');

    // Add delay between messages to avoid rate limiting
    if (DELAY_BETWEEN_MESSAGES_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MESSAGES_MS));
    }
  }

  return { processed, errors };
}

async function runTests(): Promise<void> {
  console.log('=== Atlas Agent Test Runner ===\n');

  // Check input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.log('Run fetch-conversations.ts first!');
    process.exit(1);
  }

  // Initialize database connection
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(dbUrl, { ssl: 'require' });

  // Load already-processed conversation IDs for resume support
  const processedIds = new Set<string>();
  if (fs.existsSync(OUTPUT_FILE)) {
    const existingResults = fs.readFileSync(OUTPUT_FILE, 'utf-8').split('\n').filter(Boolean);
    for (const line of existingResults) {
      try {
        const result = JSON.parse(line);
        processedIds.add(result.conversationId);
      } catch {}
    }
    console.log(`Resuming: ${processedIds.size} conversations already processed, skipping...`);
  }

  // Create agent (we'll create fresh ones per batch to avoid memory issues)
  console.log('Initializing Atlas agent...');

  // Create output stream (append mode for resume)
  const outputStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });

  // Read and process conversations
  const inputStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: inputStream });

  let totalConversations = 0;
  let totalProcessed = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  // Process in batches for concurrency
  const batch: ConversationRecord[] = [];

  console.log('\nProcessing messages...\n');

  for await (const line of rl) {
    if (!line.trim()) continue;

    const conversation: ConversationRecord = JSON.parse(line);

    // Skip already-processed conversations
    if (processedIds.has(conversation.userId)) {
      continue;
    }

    batch.push(conversation);

    if (batch.length >= CONCURRENCY) {
      // Process batch in parallel
      const agent = new AtlasAgent({ sql });
      const results = await Promise.all(
        batch.map(conv => processConversation(agent, conv, outputStream))
      );

      for (const r of results) {
        totalProcessed += r.processed;
        totalErrors += r.errors;
      }
      totalConversations += batch.length;

      // Progress update
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = totalProcessed / elapsed;
      process.stdout.write(
        `\rConversations: ${totalConversations} | Messages: ${totalProcessed} | ` +
        `Errors: ${totalErrors} | Rate: ${rate.toFixed(1)}/s | Time: ${elapsed.toFixed(0)}s`
      );

      batch.length = 0;
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    const agent = new AtlasAgent({ sql });
    const results = await Promise.all(
      batch.map(conv => processConversation(agent, conv, outputStream))
    );

    for (const r of results) {
      totalProcessed += r.processed;
      totalErrors += r.errors;
    }
    totalConversations += batch.length;
  }

  outputStream.end();
  await sql.end();

  const totalTime = (Date.now() - startTime) / 1000;

  console.log('\n\n=== Test Complete ===');
  console.log(`Total conversations: ${totalConversations}`);
  console.log(`Total messages tested: ${totalProcessed}`);
  console.log(`Total errors: ${totalErrors}`);
  console.log(`Error rate: ${((totalErrors / totalProcessed) * 100).toFixed(2)}%`);
  console.log(`Total time: ${totalTime.toFixed(1)}s`);
  console.log(`Average rate: ${(totalProcessed / totalTime).toFixed(1)} messages/s`);
  console.log(`Output file: ${OUTPUT_FILE}`);
}

// Run
runTests()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nError:', err);
    process.exit(1);
  });
