import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

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

interface EligibleUser {
  phoneNumber: string;
  firstContactAt: string;
  lastMessageAt: string;
  hoursRemaining: number;
  messageCount: number;
  firstMessage: string;
  nudgeSent: boolean;
  nudgeSentAt?: string;
}

export async function GET() {
  try {
    // Scan all items
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );
      allItems.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    // Build maps
    const profiles = new Map<string, any>();
    const conversations = new Map<string, any>();

    for (const item of allItems) {
      const phone = (item.pk as string)?.replace('USER#', '');
      if (!phone || !/^[+]?\d+$/.test(phone) || phone.length < 10) continue;

      if (item.sk === 'PROFILE') {
        profiles.set(phone, item);
      } else if (item.sk === 'CONVERSATION') {
        conversations.set(phone, item);
      }
    }

    const now = Date.now();
    const eligibleUsers: EligibleUser[] = [];

    for (const [phone, conv] of Array.from(conversations.entries())) {
      const messages: Message[] = conv.messages || [];
      const context = conv.context || {};
      const profile = profiles.get(phone);

      // Skip if user has searched (has context)
      if (context.lastOrigin || context.lastDestination) {
        continue;
      }

      // Find last user message timestamp
      const userMessages = messages.filter((m: Message) => m.role === 'user');
      if (userMessages.length === 0) continue;

      const lastUserMessage = userMessages[userMessages.length - 1];
      const lastMessageAt = new Date(lastUserMessage.timestamp).getTime();
      const hoursElapsed = (now - lastMessageAt) / (1000 * 60 * 60);
      const hoursRemaining = 24 - hoursElapsed;

      // Only include if within 24h window (can still message)
      if (hoursRemaining <= 0) continue;

      // Check if nudge was already sent
      const nudgeSent = conv.nudgeSent === true;
      const nudgeSentAt = conv.nudgeSentAt;

      eligibleUsers.push({
        phoneNumber: phone,
        firstContactAt: profile?.firstContactAt || conv.createdAt,
        lastMessageAt: lastUserMessage.timestamp,
        hoursRemaining: Math.round(hoursRemaining * 10) / 10,
        messageCount: messages.length,
        firstMessage: userMessages[0]?.content?.slice(0, 100) || '',
        nudgeSent,
        nudgeSentAt,
      });
    }

    // Sort by hours remaining (most urgent first)
    eligibleUsers.sort((a, b) => a.hoursRemaining - b.hoursRemaining);

    const stats = {
      total: eligibleUsers.length,
      urgent: eligibleUsers.filter(u => u.hoursRemaining < 6).length,
      nudgeSent: eligibleUsers.filter(u => u.nudgeSent).length,
      pending: eligibleUsers.filter(u => !u.nudgeSent).length,
    };

    return NextResponse.json({ users: eligibleUsers, stats });
  } catch (error) {
    console.error('Nudge eligible API error:', error);
    return NextResponse.json({ error: 'Failed to fetch eligible users' }, { status: 500 });
  }
}

// POST - Mark user as nudged
export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Update conversation to mark nudge sent
    await docClient.send(
      new UpdateCommand({
        TableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'CONVERSATION',
        },
        UpdateExpression: 'SET nudgeSent = :sent, nudgeSentAt = :at',
        ExpressionAttributeValues: {
          ':sent': true,
          ':at': new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark nudge error:', error);
    return NextResponse.json({ error: 'Failed to mark nudge' }, { status: 500 });
  }
}
