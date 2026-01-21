import { NextResponse } from 'next/server';
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

export async function GET() {
  try {
    // Only get CONVERSATION items (not PROFILE items)
    const result = await docClient.send(
      new ScanCommand({
        TableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
        FilterExpression: 'sk = :sk',
        ExpressionAttributeValues: {
          ':sk': 'CONVERSATION',
        },
      })
    );

    const conversations: Conversation[] = (result.Items || [])
      .map((item) => {
        // Extract user ID from pk (format: "USER#18575401309")
        const userId = (item.pk as string)?.replace('USER#', '') || 'unknown';

        // Parse messages
        const messages: Message[] = (item.messages || []).map((msg: any) => ({
          role: msg.role || msg.M?.role?.S || 'unknown',
          content: msg.content || msg.M?.content?.S || '',
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
          messageCount: messages.length,
        };
      })
      // Filter out malformed entries (wamid, MSG#, etc.) - only keep phone numbers
      .filter((conv) => {
        // Valid phone numbers start with digits or + followed by digits
        return /^[+]?\d+$/.test(conv.userId) && conv.userId.length >= 10;
      });

    // Sort by updatedAt (most recent first)
    conversations.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Conversations API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}
