/**
 * Fetch conversations from DynamoDB for Atlas testing
 * Outputs to JSONL for streaming processing
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import * as fs from 'fs';
import * as path from 'path';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface ConversationRecord {
  userId: string;
  messages: Message[];
  context: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  userMessageCount: number;
}

const OUTPUT_DIR = path.join(__dirname, '../../test-data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'conversations.jsonl');

async function fetchConversations(): Promise<void> {
  console.log('Initializing DynamoDB client...');

  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: 'eu-central-1' }),
    { marshallOptions: { removeUndefinedValues: true } }
  );

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const writeStream = fs.createWriteStream(OUTPUT_FILE);
  let totalFetched = 0;
  let totalUserMessages = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let scanCount = 0;

  console.log('Starting paginated scan of turkish-logistics-conversations...\n');

  do {
    scanCount++;
    const result = await client.send(
      new ScanCommand({
        TableName: 'turkish-logistics-conversations',
        FilterExpression: 'sk = :sk',
        ExpressionAttributeValues: { ':sk': 'CONVERSATION' },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of result.Items || []) {
      const userId = (item.pk as string)?.replace('USER#', '');

      // Skip test users and invalid phone numbers
      if (!userId || userId.startsWith('TEST_') || userId.length < 8) {
        continue;
      }

      const messages: Message[] = item.messages || [];
      const userMessages = messages.filter((m: Message) => m.role === 'user');

      // Skip conversations with less than 2 user messages (not enough context)
      if (userMessages.length < 2) {
        continue;
      }

      const conversation: ConversationRecord = {
        userId,
        messages,
        context: item.context || {},
        createdAt: item.createdAt || '',
        updatedAt: item.updatedAt || '',
        messageCount: messages.length,
        userMessageCount: userMessages.length,
      };

      // Write as JSONL (one JSON object per line)
      writeStream.write(JSON.stringify(conversation) + '\n');
      totalFetched++;
      totalUserMessages += userMessages.length;
    }

    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
    process.stdout.write(`\rScan ${scanCount}: Fetched ${totalFetched} conversations (${totalUserMessages} user messages)...`);

  } while (lastEvaluatedKey);

  writeStream.end();

  console.log('\n\n=== Fetch Complete ===');
  console.log(`Total conversations: ${totalFetched}`);
  console.log(`Total user messages: ${totalUserMessages}`);
  console.log(`Output file: ${OUTPUT_FILE}`);
  console.log(`Average messages per conversation: ${(totalUserMessages / totalFetched).toFixed(1)}`);
}

// Run
fetchConversations()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
