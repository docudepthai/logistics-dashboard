/**
 * Comprehensive Atlas Agent Test
 * Fetches real conversations, runs through AtlasAgent, saves for DPO training
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import postgres from 'postgres';
import * as fs from 'fs';

// Import Atlas Agent
import { AtlasAgent } from '../../packages/agent/src/atlas-agent';

// Config
const HOURS_BACK = 8;
const OUTPUT_DIR = '/Users/caglarbinici/Whatsapp_Aggregator_Bot/test-data/atlas-dpo';

// DynamoDB setup
const dynamoClient = new DynamoDBClient({ region: 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

// PostgreSQL setup
const sql = postgres(process.env.DATABASE_URL || '', {
  ssl: 'require',
  max: 5,
  idle_timeout: 20,
});

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

interface ConversationRecord {
  pk: string;
  sk: string;
  messages: ConversationMessage[];
  context?: {
    lastOrigin?: string;
    lastDestination?: string;
    lastVehicleType?: string;
  };
  updatedAt: string;
}

interface TestResult {
  phone: string;
  userMessage: string;
  atlasResponse: string;
  intent: string;
  parsedLocations: {
    origin?: string;
    destination?: string;
  };
  jobsFound: number;
  responseTimeMs: number;
  timestamp: string;
  conversationContext?: any;
}

type Intent = 'search' | 'pagination' | 'intra_city' | 'greeting' | 'goodbye' | 'thanks' |
  'help' | 'pricing' | 'confirmation' | 'negation' | 'other' | 'error';

interface DPOTrainingPair {
  instruction: string;
  input: string;
  chosen: string;  // Atlas response (we'll mark good ones)
  rejected?: string;  // For comparison
  metadata: {
    phone: string;
    intent: string;
    jobsFound: number;
    responseTimeMs: number;
  };
}

async function getRecentConversations(): Promise<ConversationRecord[]> {
  const cutoffTime = new Date(Date.now() - HOURS_BACK * 60 * 60 * 1000).toISOString();

  console.log(`Fetching conversations since ${cutoffTime}...`);

  const conversations: ConversationRecord[] = [];
  let lastEvaluatedKey: any = undefined;

  do {
    const result = await docClient.send(new ScanCommand({
      TableName: CONVERSATIONS_TABLE,
      FilterExpression: 'sk = :sk AND updatedAt > :cutoff',
      ExpressionAttributeValues: {
        ':sk': 'CONVERSATION',
        ':cutoff': cutoffTime,
      },
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    if (result.Items) {
      conversations.push(...(result.Items as ConversationRecord[]));
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`Found ${conversations.length} conversations in last ${HOURS_BACK} hours`);
  return conversations;
}

function extractUserMessages(conversations: ConversationRecord[]): Array<{
  phone: string;
  message: string;
  context?: any;
  conversationHistory: ConversationMessage[];
}> {
  const userMessages: Array<{
    phone: string;
    message: string;
    context?: any;
    conversationHistory: ConversationMessage[];
  }> = [];

  for (const conv of conversations) {
    const phone = conv.pk.replace('USER#', '');
    const messages = conv.messages || [];

    // Extract each user message with its conversation history up to that point
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'user' && msg.content) {
        // Skip very short messages or just emojis
        const content = msg.content.trim();
        if (content.length < 2) continue;

        userMessages.push({
          phone,
          message: content,
          context: conv.context,
          conversationHistory: messages.slice(0, i), // History before this message
        });
      }
    }
  }

  console.log(`Extracted ${userMessages.length} user messages`);
  return userMessages;
}

async function runAtlasTest(): Promise<void> {
  console.log('='.repeat(60));
  console.log('COMPREHENSIVE ATLAS AGENT TEST');
  console.log('='.repeat(60));
  console.log('');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Initialize Atlas Agent with postgres connection
  const atlasAgent = new AtlasAgent({
    sql,
    conversationsTable: CONVERSATIONS_TABLE,
  });

  // Fetch conversations
  const conversations = await getRecentConversations();
  const userMessages = extractUserMessages(conversations);

  // Limit for testing (remove for full run)
  const testMessages = userMessages.slice(0, 100);

  console.log(`\nTesting ${testMessages.length} messages...\n`);

  const results: TestResult[] = [];
  const dpoData: DPOTrainingPair[] = [];

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < testMessages.length; i++) {
    const { phone, message, context, conversationHistory } = testMessages[i];

    console.log(`[${i + 1}/${testMessages.length}] ${phone}: "${message.substring(0, 50)}..."`);

    try {
      const startTime = Date.now();

      // Run through Atlas Agent (userId first, then message)
      const response = await atlasAgent.processMessage(phone, message);

      const endTime = Date.now();
      const responseTimeMs = endTime - startTime;

      // Extract context info
      const jobCount = response.jobIds?.length || 0;
      const intentStr = response.intent || 'unknown';

      // Extract metadata from response
      const result: TestResult = {
        phone,
        userMessage: message,
        atlasResponse: response.message,
        intent: intentStr,
        parsedLocations: {
          origin: response.context?.lastOrigin,
          destination: response.context?.lastDestination,
        },
        jobsFound: jobCount,
        responseTimeMs,
        timestamp: new Date().toISOString(),
        conversationContext: context,
      };

      results.push(result);

      // Create DPO training pair
      const dpoPair: DPOTrainingPair = {
        instruction: 'Sen Patron yük asistanısın. Kullanıcının mesajını analiz et ve uygun cevap ver.',
        input: message,
        chosen: response.message,
        metadata: {
          phone,
          intent: intentStr,
          jobsFound: jobCount,
          responseTimeMs,
        },
      };

      dpoData.push(dpoPair);

      successCount++;
      console.log(`   ✓ Intent: ${intentStr} | Jobs: ${jobCount} | Time: ${responseTimeMs}ms`);

    } catch (error) {
      errorCount++;
      console.log(`   ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);

      results.push({
        phone,
        userMessage: message,
        atlasResponse: `ERROR: ${error instanceof Error ? error.message : 'Unknown'}`,
        intent: 'error',
        parsedLocations: {},
        jobsFound: 0,
        responseTimeMs: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  // Full results JSON
  const resultsFile = `${OUTPUT_DIR}/atlas-test-results-${timestamp}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${resultsFile}`);

  // DPO training data JSONL
  const dpoFile = `${OUTPUT_DIR}/atlas-dpo-training-${timestamp}.jsonl`;
  const dpoContent = dpoData.map(d => JSON.stringify(d)).join('\n');
  fs.writeFileSync(dpoFile, dpoContent);
  console.log(`DPO training data saved to: ${dpoFile}`);

  // Summary statistics
  const summaryFile = `${OUTPUT_DIR}/atlas-test-summary-${timestamp}.json`;
  const summary = {
    testDate: new Date().toISOString(),
    hoursBack: HOURS_BACK,
    totalConversations: conversations.length,
    totalMessages: testMessages.length,
    successCount,
    errorCount,
    successRate: ((successCount / testMessages.length) * 100).toFixed(1) + '%',
    avgResponseTimeMs: Math.round(
      results.filter(r => r.responseTimeMs > 0).reduce((sum, r) => sum + r.responseTimeMs, 0) /
      results.filter(r => r.responseTimeMs > 0).length
    ),
    intentDistribution: results.reduce((acc, r) => {
      acc[r.intent] = (acc[r.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    jobsFoundDistribution: {
      '0': results.filter(r => r.jobsFound === 0).length,
      '1-5': results.filter(r => r.jobsFound >= 1 && r.jobsFound <= 5).length,
      '6-10': results.filter(r => r.jobsFound >= 6 && r.jobsFound <= 10).length,
      '10+': results.filter(r => r.jobsFound > 10).length,
    },
  };
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`Summary saved to: ${summaryFile}`);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total messages tested: ${testMessages.length}`);
  console.log(`Success: ${successCount} (${summary.successRate})`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Avg response time: ${summary.avgResponseTimeMs}ms`);
  console.log('\nIntent distribution:');
  Object.entries(summary.intentDistribution)
    .sort((a, b) => b[1] - a[1])
    .forEach(([intent, count]) => {
      console.log(`  ${intent}: ${count}`);
    });
  console.log('\nJobs found distribution:');
  Object.entries(summary.jobsFoundDistribution).forEach(([range, count]) => {
    console.log(`  ${range}: ${count}`);
  });

  // Close database connection
  await sql.end();

  console.log('\n✅ Test complete!');
}

// Run the test
runAtlasTest().catch(console.error);
