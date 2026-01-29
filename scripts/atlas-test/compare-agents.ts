/**
 * Compare Atlas Agent vs GPT Agent (10% sample)
 * Establishes baseline for Atlas quality compared to the working GPT implementation
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import postgres from 'postgres';
import { AtlasAgent } from '../../packages/agent/src/atlas-agent.js';
import { LogisticsAgent, type AgentResponse } from '../../packages/agent/src/agent.js';

// Configuration
const SAMPLE_RATE = 0.1; // 10% sample
const INPUT_FILE = path.join(__dirname, '../../test-data/conversations.jsonl');
const OUTPUT_FILE = path.join(__dirname, '../../test-data/comparison.jsonl');

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ConversationRecord {
  userId: string;
  messages: Message[];
}

interface ComparisonResult {
  conversationId: string;
  messageIndex: number;
  userMessage: string;

  // Atlas results
  atlasResponse: string;
  atlasOrigin?: string;
  atlasDestination?: string;
  atlasJobCount: number;
  atlasLatencyMs: number;
  atlasError?: string;

  // GPT results
  gptResponse: string;
  gptOrigin?: string;
  gptDestination?: string;
  gptJobCount: number;
  gptLatencyMs: number;
  gptError?: string;

  // Comparison metrics
  responseMatch: boolean;
  locationMatch: boolean;
  jobOverlap: number; // Jaccard similarity

  timestamp: string;
}

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 1 : intersection / union;
}

function responseSimilar(a: string, b: string): boolean {
  // Normalize for comparison
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const na = normalize(a);
  const nb = normalize(b);

  // Check if core content matches
  if (na === nb) return true;

  // Check if both are "no results" responses
  const noResultsPatterns = ['yok', 'bulamadim', 'bulunamadi', 'mevcut degil'];
  const aNoResults = noResultsPatterns.some(p => na.includes(p));
  const bNoResults = noResultsPatterns.some(p => nb.includes(p));
  if (aNoResults && bNoResults) return true;

  // Check if both have results (contain job details)
  const hasResults = (s: string) => s.includes('tel:') || s.includes('ton') || s.includes('🚚');
  if (hasResults(a) && hasResults(b)) return true;

  return false;
}

async function runComparison(): Promise<void> {
  console.log('=== Atlas vs GPT Agent Comparison ===\n');
  console.log(`Sample rate: ${SAMPLE_RATE * 100}%\n`);

  // Check input file exists
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`Input file not found: ${INPUT_FILE}`);
    console.log('Run fetch-conversations.ts first!');
    process.exit(1);
  }

  // Initialize database and agents
  const dbUrl = process.env.DATABASE_URL;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!dbUrl) {
    console.error('DATABASE_URL environment variable is required');
    process.exit(1);
  }

  if (!openaiKey) {
    console.error('OPENAI_API_KEY environment variable is required for GPT comparison');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = postgres(dbUrl, { ssl: 'require' });

  console.log('Initializing agents...');
  const atlasAgent = new AtlasAgent({ sql });
  const gptAgent = new LogisticsAgent({ sql, openaiApiKey: openaiKey });

  // Create output stream
  const outputStream = fs.createWriteStream(OUTPUT_FILE);

  // Read and process conversations
  const inputStream = fs.createReadStream(INPUT_FILE);
  const rl = readline.createInterface({ input: inputStream });

  let totalConversations = 0;
  let sampledMessages = 0;
  let skippedMessages = 0;
  const startTime = Date.now();

  // Metrics
  let responseMatches = 0;
  let locationMatches = 0;
  let totalJobOverlap = 0;

  console.log('\nProcessing messages (10% sample)...\n');

  for await (const line of rl) {
    if (!line.trim()) continue;

    const conversation: ConversationRecord = JSON.parse(line);
    totalConversations++;

    for (let i = 0; i < conversation.messages.length; i++) {
      const msg = conversation.messages[i];

      // Only test user messages
      if (msg.role !== 'user') continue;

      // Skip very short messages
      if (msg.content.trim().length < 3) continue;

      // 10% sample
      if (Math.random() > SAMPLE_RATE) {
        skippedMessages++;
        continue;
      }

      sampledMessages++;

      // Generate unique test user IDs
      const testId = `COMPARE_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const atlasUserId = `ATLAS_${testId}`;
      const gptUserId = `GPT_${testId}`;

      let result: ComparisonResult;

      try {
        // Run Atlas
        const atlasStart = Date.now();
        const atlasResp = await atlasAgent.processMessage(atlasUserId, msg.content);
        const atlasLatency = Date.now() - atlasStart;

        // Run GPT
        const gptStart = Date.now();
        let gptResp: AgentResponse;
        let gptError: string | undefined;

        try {
          gptResp = await gptAgent.processMessage(gptUserId, msg.content);
        } catch (e) {
          gptError = e instanceof Error ? e.message : String(e);
          gptResp = { message: '', jobIds: [], context: {} };
        }
        const gptLatency = Date.now() - gptStart;

        // Calculate comparison metrics
        const responseMatch = responseSimilar(atlasResp.message, gptResp.message);
        const locationMatch =
          (atlasResp.context?.lastOrigin?.toLowerCase() === gptResp.context?.lastOrigin?.toLowerCase()) &&
          (atlasResp.context?.lastDestination?.toLowerCase() === gptResp.context?.lastDestination?.toLowerCase());
        const jobOverlap = jaccard(atlasResp.jobIds || [], gptResp.jobIds || []);

        result = {
          conversationId: conversation.userId,
          messageIndex: i,
          userMessage: msg.content,

          atlasResponse: atlasResp.message,
          atlasOrigin: atlasResp.context?.lastOrigin,
          atlasDestination: atlasResp.context?.lastDestination,
          atlasJobCount: atlasResp.jobIds?.length || 0,
          atlasLatencyMs: atlasLatency,

          gptResponse: gptResp.message,
          gptOrigin: gptResp.context?.lastOrigin,
          gptDestination: gptResp.context?.lastDestination,
          gptJobCount: gptResp.jobIds?.length || 0,
          gptLatencyMs: gptLatency,
          gptError,

          responseMatch,
          locationMatch,
          jobOverlap,

          timestamp: new Date().toISOString(),
        };

        if (responseMatch) responseMatches++;
        if (locationMatch) locationMatches++;
        totalJobOverlap += jobOverlap;

      } catch (error) {
        result = {
          conversationId: conversation.userId,
          messageIndex: i,
          userMessage: msg.content,

          atlasResponse: '',
          atlasJobCount: 0,
          atlasLatencyMs: 0,
          atlasError: error instanceof Error ? error.message : String(error),

          gptResponse: '',
          gptJobCount: 0,
          gptLatencyMs: 0,

          responseMatch: false,
          locationMatch: false,
          jobOverlap: 0,

          timestamp: new Date().toISOString(),
        };
      }

      outputStream.write(JSON.stringify(result) + '\n');

      // Progress update
      if (sampledMessages % 10 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const matchRate = (responseMatches / sampledMessages * 100).toFixed(1);
        process.stdout.write(
          `\rSampled: ${sampledMessages} | Convs: ${totalConversations} | ` +
          `Match rate: ${matchRate}% | Elapsed: ${elapsed.toFixed(0)}s`
        );
      }
    }
  }

  outputStream.end();
  await sql.end();

  const totalTime = (Date.now() - startTime) / 1000;

  console.log('\n\n=== Comparison Complete ===');
  console.log(`Total conversations: ${totalConversations}`);
  console.log(`Sampled messages: ${sampledMessages}`);
  console.log(`Skipped messages: ${skippedMessages}`);
  console.log(`Total time: ${totalTime.toFixed(1)}s`);

  console.log('\n=== Comparison Metrics ===');
  console.log(`Response match rate: ${(responseMatches / sampledMessages * 100).toFixed(1)}%`);
  console.log(`Location match rate: ${(locationMatches / sampledMessages * 100).toFixed(1)}%`);
  console.log(`Avg job overlap (Jaccard): ${(totalJobOverlap / sampledMessages * 100).toFixed(1)}%`);

  console.log(`\nOutput file: ${OUTPUT_FILE}`);
}

// Run
runComparison()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nError:', err);
    process.exit(1);
  });
