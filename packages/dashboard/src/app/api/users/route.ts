import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

export interface User {
  phoneNumber: string;
  firstContactAt: string;
  freeTierExpiresAt: string;
  membershipStatus: 'free_trial' | 'expired' | 'premium';
  welcomeMessageSent: boolean;
  createdAt: string;
  updatedAt: string;
  paidUntil?: string;
  paymentId?: string;
}

function isFreeTierActive(user: User): boolean {
  if (user.membershipStatus === 'premium') {
    if (user.paidUntil && new Date(user.paidUntil) < new Date()) {
      return false;
    }
    return true;
  }
  if (user.membershipStatus === 'expired') {
    return false;
  }
  return new Date(user.freeTierExpiresAt) > new Date();
}

function getDaysRemaining(user: User): number | null {
  if (user.membershipStatus === 'expired') return 0;

  const expiresAt = user.membershipStatus === 'premium' && user.paidUntil
    ? new Date(user.paidUntil)
    : new Date(user.freeTierExpiresAt);

  const now = new Date();
  const diffMs = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

export async function GET() {
  try {
    // Scan for all user profiles with pagination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allItems: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: CONVERSATIONS_TABLE,
          FilterExpression: 'sk = :sk',
          ExpressionAttributeValues: {
            ':sk': 'PROFILE',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      allItems.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const users: (User & { canViewPhones: boolean; daysRemaining: number | null })[] = allItems.map((item) => {
      const user: User = {
        phoneNumber: item.phoneNumber,
        firstContactAt: item.firstContactAt,
        freeTierExpiresAt: item.freeTierExpiresAt,
        membershipStatus: item.membershipStatus,
        welcomeMessageSent: item.welcomeMessageSent,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        paidUntil: item.paidUntil,
        paymentId: item.paymentId,
      };

      return {
        ...user,
        canViewPhones: isFreeTierActive(user),
        daysRemaining: getDaysRemaining(user),
      };
    });

    // Sort by most recent first
    users.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate stats
    const stats = {
      total: users.length,
      freeTrial: users.filter(u => u.membershipStatus === 'free_trial' && u.canViewPhones).length,
      expired: users.filter(u => !u.canViewPhones).length,
      premium: users.filter(u => u.membershipStatus === 'premium' && u.canViewPhones).length,
    };

    return NextResponse.json({ users, stats });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
