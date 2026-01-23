import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

interface ConversationContext {
  lastOrigin?: string;
  lastDestination?: string;
  lastJobIds?: string[];
  lastTotalCount?: number;
  swearWarned?: boolean;
}

// Bot confusion/failure phrases
const CONFUSION_PHRASES = [
  'sadece is bakarim abi',
  'nerden cikacak abi',
  'nerden nereye bakayim',
  'nerden nereye yaz',
  'anlamadim',
];

const NO_RESULTS_PHRASES = [
  'su an yok abi',
  'simdilik yok',
  'bulamadim',
  'hepsini gosterdim',
];

const FRUSTRATION_PHRASES = [
  'abi kufur etme',
  'duzgun konus',
];

const USER_CONFUSION_PATTERNS = [
  /\?{2,}/,  // Multiple question marks
  /ne\s*(yap|et|bu|oluyor)/i,  // "ne yapiyorsun", "ne bu"
  /anlamadim/i,
  /nasil/i,
  /calismiy/i,  // "calismiyor"
];

interface ProblemConversation {
  userId: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  durationMinutes: number;
  problems: string[];
  severity: 'critical' | 'warning' | 'low';
  firstMessage: string;
  lastMessage: string;
  lastBotMessage: string;
  hasSearched: boolean;
  foundResults: boolean;
  context: ConversationContext;
}

function analyzeConversation(
  userId: string,
  messages: Message[],
  context: ConversationContext,
  createdAt: string,
  updatedAt: string
): ProblemConversation | null {
  const problems: string[] = [];

  const userMessages = messages.filter(m => m.role === 'user');
  const botMessages = messages.filter(m => m.role === 'assistant');

  const firstMessage = userMessages[0]?.content || '';
  const lastMessage = messages[messages.length - 1]?.content || '';
  const lastBotMessage = botMessages[botMessages.length - 1]?.content || '';

  const durationMs = new Date(updatedAt).getTime() - new Date(createdAt).getTime();
  const durationMinutes = Math.round(durationMs / 60000);

  // Check if user searched and found results
  const hasSearched = !!(context.lastOrigin || context.lastDestination);
  const foundResults = !!(context.lastJobIds && context.lastJobIds.length > 0);

  // Problem detection

  // 1. Very short conversation (bounced)
  if (messages.length < 4 && !foundResults) {
    problems.push('Bounced: Very short conversation');
  }

  // 2. Bot confusion phrases
  const confusionCount = botMessages.filter(m =>
    CONFUSION_PHRASES.some(phrase => m.content.toLowerCase().includes(phrase))
  ).length;
  if (confusionCount > 0) {
    problems.push(`Bot confused ${confusionCount}x`);
  }

  // 3. No results found
  const noResultsCount = botMessages.filter(m =>
    NO_RESULTS_PHRASES.some(phrase => m.content.toLowerCase().includes(phrase))
  ).length;
  if (noResultsCount > 1) {
    problems.push(`No results ${noResultsCount}x`);
  }

  // 4. User frustration (swearing)
  if (context.swearWarned) {
    problems.push('User frustrated (swore)');
  }

  // 5. User confusion patterns
  const userConfusionCount = userMessages.filter(m =>
    USER_CONFUSION_PATTERNS.some(pattern => pattern.test(m.content))
  ).length;
  if (userConfusionCount > 0) {
    problems.push(`User confused ${userConfusionCount}x`);
  }

  // 6. Never searched
  if (!hasSearched && messages.length > 3) {
    problems.push('Never performed a search');
  }

  // 7. Searched but no results
  if (hasSearched && !foundResults && noResultsCount > 0) {
    problems.push('Searched but found nothing');
  }

  // 8. Short duration abrupt end
  if (durationMinutes < 2 && messages.length < 6 && !foundResults) {
    problems.push('Quick abandonment');
  }

  // If no problems, skip
  if (problems.length === 0) {
    return null;
  }

  // Determine severity
  let severity: 'critical' | 'warning' | 'low' = 'low';

  if (
    context.swearWarned ||
    (confusionCount >= 2 && !foundResults) ||
    (userConfusionCount >= 2)
  ) {
    severity = 'critical';
  } else if (
    (hasSearched && !foundResults) ||
    confusionCount >= 1 ||
    noResultsCount >= 2
  ) {
    severity = 'warning';
  }

  return {
    userId,
    messageCount: messages.length,
    createdAt,
    updatedAt,
    durationMinutes,
    problems,
    severity,
    firstMessage: firstMessage.slice(0, 100),
    lastMessage: lastMessage.slice(0, 100),
    lastBotMessage: lastBotMessage.slice(0, 150),
    hasSearched,
    foundResults,
    context,
  };
}

export async function GET() {
  try {
    // Scan all conversation items with pagination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
          FilterExpression: 'sk = :sk',
          ExpressionAttributeValues: {
            ':sk': 'CONVERSATION',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      allItems.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const problemConversations: ProblemConversation[] = [];

    for (const item of allItems) {
      const userId = (item.pk as string)?.replace('USER#', '') || 'unknown';

      // Filter out malformed entries
      if (!/^[+]?\d+$/.test(userId) || userId.length < 10) {
        continue;
      }

      const messages: Message[] = (item.messages || []).map((msg: any) => ({
        role: msg.role || 'unknown',
        content: msg.content || '',
        timestamp: msg.timestamp || '',
      }));

      const context: ConversationContext = item.context || {};

      const problem = analyzeConversation(
        userId,
        messages,
        context,
        item.createdAt || '',
        item.updatedAt || ''
      );

      if (problem) {
        problemConversations.push(problem);
      }
    }

    // Sort by severity (critical first) then by updatedAt (most recent first)
    const severityOrder = { critical: 0, warning: 1, low: 2 };
    problemConversations.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    // Stats
    const stats = {
      total: problemConversations.length,
      critical: problemConversations.filter(p => p.severity === 'critical').length,
      warning: problemConversations.filter(p => p.severity === 'warning').length,
      low: problemConversations.filter(p => p.severity === 'low').length,
    };

    return NextResponse.json({
      conversations: problemConversations,
      stats,
    });
  } catch (error) {
    console.error('Problem conversations API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch problem conversations' },
      { status: 500 }
    );
  }
}
