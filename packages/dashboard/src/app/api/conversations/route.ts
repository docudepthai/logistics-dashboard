import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Limit response size to prevent 413 errors
const MAX_CONVERSATIONS = 200;

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

interface Conversation {
  userId: string;
  messages: Message[];
  context: {
    lastOrigin?: string;
    lastDestination?: string;
    lastBodyType?: string;
  };
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), MAX_CONVERSATIONS);

    // Scan with pagination to get conversation items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey: Record<string, any> | undefined;
    let scannedCount = 0;
    const maxScan = 5000; // Limit total scan to prevent timeout

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
      scannedCount += result.ScannedCount || 0;
    } while (lastEvaluatedKey && scannedCount < maxScan);

    let conversations: Conversation[] = allItems
      .map((item) => {
        // Extract user ID from pk (format: "USER#18575401309")
        const userId = (item.pk as string)?.replace('USER#', '') || 'unknown';

        // Parse messages - limit to last 10 messages to reduce payload
        const allMessages = item.messages || [];
        const recentMessages = allMessages.slice(-10);
        const messages: Message[] = recentMessages.map((msg: any) => ({
          role: msg.role || msg.M?.role?.S || 'unknown',
          content: (msg.content || msg.M?.content?.S || '').slice(0, 500), // Truncate long messages
          timestamp: msg.timestamp || msg.M?.timestamp?.S || '',
        }));

        // Parse context
        const ctx = item.context || {};
        const context = {
          lastOrigin: ctx.lastOrigin || ctx.M?.lastOrigin?.S,
          lastDestination: ctx.lastDestination || ctx.M?.lastDestination?.S,
          lastBodyType: ctx.lastBodyType || ctx.M?.lastBodyType?.S,
        };

        return {
          userId,
          messages,
          context,
          createdAt: item.createdAt || '',
          updatedAt: item.updatedAt || '',
          messageCount: allMessages.length, // Show total count
        };
      })
      // Filter out malformed entries (wamid, MSG#, etc.) - only keep phone numbers
      .filter((conv) => {
        // Valid phone numbers start with digits or + followed by digits
        return /^[+]?\d+$/.test(conv.userId) && conv.userId.length >= 10;
      });

    // Apply search filter if provided
    if (search) {
      const searchDigits = search.replace(/\D/g, '');
      conversations = conversations.filter(c => c.userId.includes(searchDigits));
    }

    // Sort by updatedAt (most recent first)
    conversations.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    // Get total count before pagination
    const total = conversations.length;

    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedConversations = conversations.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      conversations: paginatedConversations,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
