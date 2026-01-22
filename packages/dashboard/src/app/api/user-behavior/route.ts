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

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

interface UserProfile {
  phoneNumber: string;
  firstContactAt: string;
  freeTierExpiresAt: string;
  membershipStatus: 'free_trial' | 'expired' | 'premium';
  paidUntil?: string;
  calledAt?: string;
}

interface ConversationData {
  userId: string;
  messages: Message[];
  context: {
    lastOrigin?: string;
    lastDestination?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export async function GET() {
  try {
    // Scan all items from table with pagination
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let lastEvaluatedKey: Record<string, any> | undefined;

    do {
      const result = await docClient.send(
        new ScanCommand({
          TableName: CONVERSATIONS_TABLE,
          ExclusiveStartKey: lastEvaluatedKey,
        })
      );

      items.push(...(result.Items || []));
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Separate profiles and conversations
    const profiles: UserProfile[] = [];
    const conversations: ConversationData[] = [];

    for (const item of items) {
      if (item.sk === 'PROFILE') {
        profiles.push({
          phoneNumber: item.phoneNumber,
          firstContactAt: item.firstContactAt,
          freeTierExpiresAt: item.freeTierExpiresAt,
          membershipStatus: item.membershipStatus,
          paidUntil: item.paidUntil,
          calledAt: item.calledAt,
        });
      } else if (item.sk === 'CONVERSATION') {
        const userId = (item.pk as string)?.replace('USER#', '') || '';
        if (/^[+]?\d+$/.test(userId) && userId.length >= 10) {
          conversations.push({
            userId,
            messages: item.messages || [],
            context: item.context || {},
            createdAt: item.createdAt || '',
            updatedAt: item.updatedAt || '',
          });
        }
      }
    }

    // ===== ENGAGEMENT METRICS =====

    // Active users by time period
    const active24h = conversations.filter(c => new Date(c.updatedAt) > oneDayAgo).length;
    const active7d = conversations.filter(c => new Date(c.updatedAt) > sevenDaysAgo).length;
    const active30d = conversations.filter(c => new Date(c.updatedAt) > thirtyDaysAgo).length;

    // Total messages
    const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
    const avgMessagesPerUser = conversations.length > 0
      ? Math.round((totalMessages / conversations.length) * 10) / 10
      : 0;

    // Users who performed at least one search (have lastOrigin or lastDestination in context)
    const conversationsWithSearch = conversations.filter(c => c.context.lastOrigin || c.context.lastDestination);
    const conversationsWithoutSearch = conversations.filter(c => !c.context.lastOrigin && !c.context.lastDestination);
    const usersWhoSearched = conversationsWithSearch.length;

    // Build a map of phone -> calledAt from profiles
    const profileCalledMap = new Map<string, string | undefined>();
    for (const profile of profiles) {
      profileCalledMap.set(profile.phoneNumber, profile.calledAt);
    }

    // Return users with their called status
    const usersWhoDidntSearch = conversationsWithoutSearch.map(c => ({
      phone: c.userId,
      calledAt: profileCalledMap.get(c.userId) || null,
    }));
    const searchRate = conversations.length > 0
      ? Math.round((usersWhoSearched / conversations.length) * 100)
      : 0;

    // Return users: users who have messages on multiple different days
    const usersWithMultipleDays = conversations.filter(c => {
      const uniqueDays = new Set(
        c.messages.map(m => new Date(m.timestamp).toDateString())
      );
      return uniqueDays.size > 1;
    }).length;
    const returnRate = conversations.length > 0
      ? Math.round((usersWithMultipleDays / conversations.length) * 100)
      : 0;

    // ===== CONVERSION FUNNEL =====

    // Total users who ever started (signed up / sent first message)
    const totalUsers = profiles.length;

    // Users who completed free trial (either converted to premium or expired)
    const expiredUsers = profiles.filter(p => p.membershipStatus === 'expired').length;
    const premiumUsers = profiles.filter(p => p.membershipStatus === 'premium').length;
    const activeTrialUsers = profiles.filter(p => {
      if (p.membershipStatus !== 'free_trial') return false;
      return new Date(p.freeTierExpiresAt) > now;
    }).length;

    // Conversion rates
    const trialToPremiumRate = (totalUsers - activeTrialUsers) > 0
      ? Math.round((premiumUsers / (totalUsers - activeTrialUsers)) * 100)
      : 0;
    const trialToExpiredRate = (totalUsers - activeTrialUsers) > 0
      ? Math.round((expiredUsers / (totalUsers - activeTrialUsers)) * 100)
      : 0;

    // Funnel steps
    const funnel = [
      {
        step: 'First Message',
        count: totalUsers,
        percentage: 100,
        description: 'Users who sent their first message'
      },
      {
        step: 'First Search',
        count: usersWhoSearched,
        percentage: totalUsers > 0 ? Math.round((usersWhoSearched / totalUsers) * 100) : 0,
        description: 'Users who performed at least one search'
      },
      {
        step: 'Return Visit',
        count: usersWithMultipleDays,
        percentage: totalUsers > 0 ? Math.round((usersWithMultipleDays / totalUsers) * 100) : 0,
        description: 'Users who came back on a different day'
      },
      {
        step: 'Converted to Premium',
        count: premiumUsers,
        percentage: totalUsers > 0 ? Math.round((premiumUsers / totalUsers) * 100) : 0,
        description: 'Users who subscribed'
      },
    ];

    const engagement = {
      active24h,
      active7d,
      active30d,
      totalMessages,
      avgMessagesPerUser,
      usersWhoSearched,
      usersWhoDidntSearch,
      searchRate,
      usersWithMultipleDays,
      returnRate,
    };

    const conversion = {
      totalUsers,
      activeTrialUsers,
      expiredUsers,
      premiumUsers,
      trialToPremiumRate,
      trialToExpiredRate,
      funnel,
    };

    return NextResponse.json({ engagement, conversion });
  } catch (error) {
    console.error('Error fetching user behavior:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user behavior data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
