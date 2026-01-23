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
  isFromAtakan?: boolean;
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
          isFromAtakan: item.isFromAtakan,
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

    // ===== TRAFFIC SOURCES =====

    // Instagram ad CTA message pattern
    const instagramPattern = /bunun hakkında daha faz(l)?a bilgi/i;

    // Build profile maps for source detection
    const profileStatusMap = new Map<string, string>();
    const profileIsFromAtakanMap = new Map<string, boolean>();
    for (const profile of profiles) {
      profileStatusMap.set(profile.phoneNumber, profile.membershipStatus);
      profileIsFromAtakanMap.set(profile.phoneNumber, profile.isFromAtakan || false);
    }

    // Detect source for each conversation based on first user message and profile flags
    const userSourceMap = new Map<string, 'instagram' | 'organic' | 'atakan'>();

    for (const conv of conversations) {
      // Check if user is from Atakan referral (NAZPX code)
      if (profileIsFromAtakanMap.get(conv.userId)) {
        userSourceMap.set(conv.userId, 'atakan');
        continue;
      }

      // Find the first user message
      const firstUserMessage = conv.messages.find(m => m.role === 'user');
      if (firstUserMessage) {
        const isInstagram = instagramPattern.test(firstUserMessage.content);
        userSourceMap.set(conv.userId, isInstagram ? 'instagram' : 'organic');
      } else {
        userSourceMap.set(conv.userId, 'organic');
      }
    }

    // Count by source
    const instagramUsers = Array.from(userSourceMap.values()).filter(s => s === 'instagram').length;
    const organicUsers = Array.from(userSourceMap.values()).filter(s => s === 'organic').length;
    const atakanUsers = Array.from(userSourceMap.values()).filter(s => s === 'atakan').length;

    // Calculate conversions by source
    let instagramPremium = 0;
    let instagramTotal = 0;
    let organicPremium = 0;
    let organicTotal = 0;
    let atakanPremium = 0;
    let atakanTotal = 0;

    for (const [userId, source] of Array.from(userSourceMap.entries())) {
      const status = profileStatusMap.get(userId);
      if (status) {
        if (source === 'instagram') {
          instagramTotal++;
          if (status === 'premium') instagramPremium++;
        } else if (source === 'atakan') {
          atakanTotal++;
          if (status === 'premium') atakanPremium++;
        } else {
          organicTotal++;
          if (status === 'premium') organicPremium++;
        }
      }
    }

    const trafficSources = {
      instagram: {
        count: instagramUsers,
        percentage: conversations.length > 0 ? Math.round((instagramUsers / conversations.length) * 100) : 0,
        premiumCount: instagramPremium,
        conversionRate: instagramTotal > 0 ? Math.round((instagramPremium / instagramTotal) * 100) : 0,
      },
      organic: {
        count: organicUsers,
        percentage: conversations.length > 0 ? Math.round((organicUsers / conversations.length) * 100) : 0,
        premiumCount: organicPremium,
        conversionRate: organicTotal > 0 ? Math.round((organicPremium / organicTotal) * 100) : 0,
      },
      atakan: {
        count: atakanUsers,
        percentage: conversations.length > 0 ? Math.round((atakanUsers / conversations.length) * 100) : 0,
        premiumCount: atakanPremium,
        conversionRate: atakanTotal > 0 ? Math.round((atakanPremium / atakanTotal) * 100) : 0,
      },
    };

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

    // ===== SEARCH ANALYSIS =====

    // Count origins, destinations, and routes from user searches
    const originCounts = new Map<string, number>();
    const destinationCounts = new Map<string, number>();
    const routeCounts = new Map<string, number>();

    for (const conv of conversationsWithSearch) {
      const origin = conv.context.lastOrigin;
      const destination = conv.context.lastDestination;

      if (origin) {
        originCounts.set(origin, (originCounts.get(origin) || 0) + 1);
      }
      if (destination) {
        destinationCounts.set(destination, (destinationCounts.get(destination) || 0) + 1);
      }
      if (origin && destination) {
        const route = `${origin} → ${destination}`;
        routeCounts.set(route, (routeCounts.get(route) || 0) + 1);
      }
    }

    // Sort and get top 10
    const topOrigins = Array.from(originCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const topDestinations = Array.from(destinationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const topRoutes = Array.from(routeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([route, count]) => ({ route, count }));

    const searchAnalysis = {
      topOrigins,
      topDestinations,
      topRoutes,
      totalSearches: conversationsWithSearch.length,
      uniqueOrigins: originCounts.size,
      uniqueDestinations: destinationCounts.size,
    };

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
    // Only count users who signed up at least 1 day ago (they had a chance to return)
    const eligibleForReturn = conversations.filter(c => {
      const createdDate = new Date(c.createdAt);
      return createdDate < oneDayAgo; // Signed up before today
    });
    const usersWithMultipleDays = eligibleForReturn.filter(c => {
      const uniqueDays = new Set(
        c.messages.map(m => new Date(m.timestamp).toDateString())
      );
      return uniqueDays.size > 1;
    }).length;
    const returnRate = eligibleForReturn.length > 0
      ? Math.round((usersWithMultipleDays / eligibleForReturn.length) * 100)
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
        percentage: returnRate,
        description: `${eligibleForReturn.length} eligible users (signed up >1 day ago)`
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

    return NextResponse.json({ engagement, conversion, trafficSources, searchAnalysis });
  } catch (error) {
    console.error('Error fetching user behavior:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user behavior data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
