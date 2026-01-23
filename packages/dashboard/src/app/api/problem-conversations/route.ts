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

// Bot parsing failure - ONLY when user tried to search but bot couldn't understand
// These are problems only if they appear AFTER the first exchange
const BOT_PARSE_FAILURE = [
  'nerden cikacak abi',      // Bot couldn't find origin
  'nerden nereye bakayim',   // Bot couldn't parse location
];

// No results - problem only if repeated
const NO_RESULTS_PHRASES = [
  'su an yok abi',
  'simdilik yok',
  'bulamadim',
];

// User explicitly confused AFTER trying to use
const USER_CONFUSION_PATTERNS = [
  /\?{2,}/,           // Multiple question marks
  /anlamadim/i,       // "I don't understand"
  /calismiy/i,        // "it's not working"
  /niye.*yok/i,       // "why is there nothing"
  /bozuk/i,           // "broken"
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

  // How old is this conversation?
  const now = new Date();
  const hoursSinceUpdate = (now.getTime() - new Date(updatedAt).getTime()) / (1000 * 60 * 60);

  // Check if user searched and found results
  const hasSearched = !!(context.lastOrigin || context.lastDestination);
  const foundResults = !!(context.lastJobIds && context.lastJobIds.length > 0);

  // Skip very recent conversations - they might still be active
  if (hoursSinceUpdate < 1 && messages.length < 6) {
    return null;
  }

  // Problem detection

  // 1. Bot couldn't parse AFTER first exchange (skip first bot response - that's onboarding)
  const botMessagesAfterFirst = botMessages.slice(1); // Skip first bot message
  const parseFailureCount = botMessagesAfterFirst.filter(m =>
    BOT_PARSE_FAILURE.some(phrase => m.content.toLowerCase().includes(phrase))
  ).length;
  if (parseFailureCount > 0) {
    problems.push(`Bot couldn't parse ${parseFailureCount}x`);
  }

  // 2. Repeated no results (2+ times = user kept trying, couldn't find loads)
  const noResultsCount = botMessages.filter(m =>
    NO_RESULTS_PHRASES.some(phrase => m.content.toLowerCase().includes(phrase))
  ).length;
  if (noResultsCount >= 2) {
    problems.push(`No results ${noResultsCount}x`);
  }

  // 3. User frustration (swearing)
  if (context.swearWarned) {
    problems.push('User frustrated (swore)');
  }

  // 4. User explicitly confused (AFTER first message, not the Instagram CTA)
  const userMessagesAfterFirst = userMessages.slice(1);
  const userConfusionCount = userMessagesAfterFirst.filter(m =>
    USER_CONFUSION_PATTERNS.some(pattern => pattern.test(m.content))
  ).length;
  if (userConfusionCount > 0) {
    problems.push(`User confused ${userConfusionCount}x`);
  }

  // 5. Searched multiple times but never found anything
  if (hasSearched && !foundResults && noResultsCount >= 1 && messages.length > 4) {
    problems.push('Searched but found nothing');
  }

  // 6. Long conversation with no successful search (user stuck)
  if (!foundResults && messages.length >= 8) {
    problems.push('Long conversation, no results');
  }

  // If no problems, skip
  if (problems.length === 0) {
    return null;
  }

  // Determine severity
  let severity: 'critical' | 'warning' | 'low' = 'low';

  if (
    context.swearWarned ||
    userConfusionCount >= 1 ||
    (parseFailureCount >= 2)
  ) {
    severity = 'critical';
  } else if (
    noResultsCount >= 2 ||
    (hasSearched && !foundResults && messages.length > 4)
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
