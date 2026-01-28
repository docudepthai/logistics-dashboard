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
  freeTierExpiresAt?: string; // Optional - only set when trial starts (first search)
  membershipStatus: 'free_trial' | 'expired' | 'premium';
  welcomeMessageSent: boolean;
  createdAt: string;
  updatedAt: string;
  paidUntil?: string;
  paymentId?: string;
  trialStartedAt?: string; // Set on first job search
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
  // Trial hasn't started yet - user can view phones (trial starts on first search)
  if (!user.trialStartedAt || !user.freeTierExpiresAt) {
    return true;
  }
  return new Date(user.freeTierExpiresAt) > new Date();
}

function getDaysRemaining(user: User): number | null {
  if (user.membershipStatus === 'expired') return 0;

  // Trial hasn't started yet - return null to show "-" in dashboard
  if (!user.trialStartedAt || !user.freeTierExpiresAt) {
    return null;
  }

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
          FilterExpression: 'begins_with(pk, :pkPrefix) AND sk = :sk',
          ExpressionAttributeValues: {
            ':pkPrefix': 'USER#',
            ':sk': 'PROFILE',
          },
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      allItems.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    const users: (User & { canViewPhones: boolean; daysRemaining: number | null })[] = allItems
      .filter((item) => item.phoneNumber) // Skip items without phoneNumber
      .map((item) => {
      const user: User = {
        phoneNumber: item.phoneNumber || '',
        firstContactAt: item.firstContactAt || item.createdAt || new Date().toISOString(),
        freeTierExpiresAt: item.freeTierExpiresAt, // May be undefined if trial hasn't started
        membershipStatus: item.membershipStatus || 'free_trial',
        welcomeMessageSent: item.welcomeMessageSent ?? false,
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString(),
        paidUntil: item.paidUntil,
        paymentId: item.paymentId,
        trialStartedAt: item.trialStartedAt, // May be undefined if trial hasn't started
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
