/**
 * Run Atlas Agent Tests (Quick Sample)
 * Processes 50 conversations for quick feedback
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import postgres from 'postgres';
import { AtlasAgent, type AtlasAgentResponse } from '../../packages/agent/src/atlas-agent.js';
import type { Intent } from '../../packages/agent/src/intents.js';

// Configuration
const MAX_CONVERSATIONS = 50;
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
  atlasIntent: Intent | 'error' | 'unknown';
  atlasResponse: string;
  atlasJobCount: number;
  atlasLatencyMs: number;
  atlasError?: string;
  parsedOrigin?: string;
  parsedDestination?: string;
  hasLocationInMessage: boolean;
  hasCityName: boolean;
  isSearchLike: boolean;
  timestamp: string;
}

const TURKISH_CITIES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya', 'gaziantep',
  'mersin', 'diyarbakir', 'kayseri', 'eskisehir', 'sanliurfa', 'samsun', 'denizli',
  'malatya', 'trabzon', 'erzurum', 'van', 'hatay', 'manisa', 'sakarya', 'balikesir'
];

function containsCityName(message: string): boolean {
  const normalized = message.toLowerCase().replace(/[ıİşŞğĞüÜöÖçÇ]/g, c =>
    ({ 'ı': 'i', 'İ': 'i', 'ş': 's', 'Ş': 's', 'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c' })[c] || c
  );
  return TURKISH_CITIES.some(city => normalized.includes(city));
}

function isSearchLikeMessage(message: string): boolean {
  return /yuk|var\s*mi|bakar|nereye|nereden|dan.*ya|bolge|ici/i.test(message) || containsCityName(message);
}

async function runTests(): Promise<void> {
  console.log('=== Atlas Agent Sample Test Runner ===\n');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(dbUrl, { ssl: 'require' });

  const outputStream = fs.createWriteStream(OUTPUT_FILE);
  const inputStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: inputStream });

  let totalConversations = 0;
  let totalProcessed = 0;
  let totalErrors = 0;
  const startTime = Date.now();

  console.log(`\nProcessing first ${MAX_CONVERSATIONS} conversations...\n`);

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (totalConversations >= MAX_CONVERSATIONS) break;

    const conversation: ConversationRecord = JSON.parse(line);
    totalConversations++;

    const agent = new AtlasAgent({ sql });

    for (let i = 0; i < conversation.messages.length; i++) {
      const msg = conversation.messages[i];
      if (msg.role !== 'user') continue;
      if (msg.content.trim().length < 2) continue;

      const prevMsg = i > 0 ? conversation.messages[i - 1] : undefined;
      const previousAssistantResponse = prevMsg?.role === 'assistant' ? prevMsg.content : undefined;

      const startTime = Date.now();
      let result: TestResult;

      try {
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
        totalProcessed++;
      } catch (error) {
        result = {
          conversationId: conversation.userId,
          messageIndex: i,
          userMessage: msg.content,
          previousAssistantResponse,
          atlasIntent: 'error',
          atlasResponse: '',
          atlasJobCount: 0,
          atlasLatencyMs: Date.now() - startTime,
          atlasError: error instanceof Error ? error.message : String(error),
          hasLocationInMessage: containsCityName(msg.content),
          hasCityName: containsCityName(msg.content),
          isSearchLike: isSearchLikeMessage(msg.content),
          timestamp: new Date().toISOString(),
        };
        totalErrors++;
        totalProcessed++;
      }

      outputStream.write(JSON.stringify(result) + '\n');
    }

    const elapsed = (Date.now() - startTime) / 1000;
    process.stdout.write(`\rConversations: ${totalConversations}/${MAX_CONVERSATIONS} | Messages: ${totalProcessed} | Errors: ${totalErrors} | Time: ${elapsed.toFixed(0)}s`);
  }

  outputStream.end();
  await sql.end();

  const totalTime = (Date.now() - startTime) / 1000;

  console.log('\n\n=== Test Complete ===');
  console.log(`Total conversations: ${totalConversations}`);
  console.log(`Total messages: ${totalProcessed}`);
  console.log(`Errors: ${totalErrors} (${((totalErrors / totalProcessed) * 100).toFixed(2)}%)`);
  console.log(`Time: ${totalTime.toFixed(1)}s`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

runTests()
  .then(() => { console.log('\nDone!'); process.exit(0); })
  .catch((err) => { console.error('\nError:', err); process.exit(1); });
