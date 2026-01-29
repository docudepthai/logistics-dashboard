import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
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
const TABLE_NAME = 'turkish-logistics-conversations';

interface Payment {
  merchantOid: string;
  phoneNumber: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
  paidAt?: string;
  failedAt?: string;
  failReason?: string;
  totalAmount?: number;
}

// Helper for paginated scans
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function scanAllItems(params: any): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allItems: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        ...params,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    allItems.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return allItems;
}

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Scan for all payment records with pagination
    const items = await scanAllItems({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(pk, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'PAYMENT#',
      },
    });

    const payments: Payment[] = items.map(item => ({
      merchantOid: item.pk.replace('PAYMENT#', ''),
      phoneNumber: item.phoneNumber || 'Unknown',
      amount: item.amount || item.totalAmount || 1000,
      status: item.status || 'pending',
      createdAt: item.createdAt || new Date().toISOString(),
      paidAt: item.paidAt,
      failedAt: item.failedAt,
      failReason: item.failReason,
      totalAmount: item.totalAmount,
    }));

    // Sort by createdAt descending
    payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Calculate stats
    const successPayments = payments.filter(p => p.status === 'success');
    const failedPayments = payments.filter(p => p.status === 'failed');
    const pendingPayments = payments.filter(p => p.status === 'pending');

    const totalRevenue = successPayments.reduce((sum, p) => sum + (p.totalAmount || p.amount), 0);
    const avgTransactionValue = successPayments.length > 0
      ? Math.round(totalRevenue / successPayments.length)
      : 0;

    // Time-based calculations
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Monthly revenue (current month)
    const monthlyRevenue = successPayments
      .filter(p => p.paidAt && new Date(p.paidAt) >= currentMonthStart)
      .reduce((sum, p) => sum + (p.totalAmount || p.amount), 0);

    // Last month revenue for comparison
    const lastMonthRevenue = successPayments
      .filter(p => {
        if (!p.paidAt) return false;
        const paidDate = new Date(p.paidAt);
        return paidDate >= lastMonthStart && paidDate <= lastMonthEnd;
      })
      .reduce((sum, p) => sum + (p.totalAmount || p.amount), 0);

    // Monthly growth percentage
    const monthlyGrowth = lastMonthRevenue > 0
      ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

    // Daily revenue for chart (last 30 days)
    const dailyRevenue: { date: string; revenue: number; transactions: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayPayments = successPayments.filter(p => {
        if (!p.paidAt) return false;
        return p.paidAt.startsWith(dateStr);
      });

      dailyRevenue.push({
        date: dateStr,
        revenue: dayPayments.reduce((sum, p) => sum + (p.totalAmount || p.amount), 0),
        transactions: dayPayments.length,
      });
    }

    // Weekly revenue for chart (last 12 weeks)
    const weeklyRevenue: { week: string; revenue: number; transactions: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (i * 7) - weekStart.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekPayments = successPayments.filter(p => {
        if (!p.paidAt) return false;
        const paidDate = new Date(p.paidAt);
        return paidDate >= weekStart && paidDate <= weekEnd;
      });

      weeklyRevenue.push({
        week: `W${12 - i}`,
        revenue: weekPayments.reduce((sum, p) => sum + (p.totalAmount || p.amount), 0),
        transactions: weekPayments.length,
      });
    }

    // Success rate
    const successRate = payments.length > 0
      ? Math.round((successPayments.length / payments.length) * 100)
      : 0;

    // Conversion funnel data
    const conversionData = [
      { name: 'Started', value: payments.length, fill: '#3b82f6' },
      { name: 'Completed', value: successPayments.length, fill: '#10b981' },
      { name: 'Failed', value: failedPayments.length, fill: '#ef4444' },
      { name: 'Pending', value: pendingPayments.length, fill: '#f59e0b' },
    ];

    return NextResponse.json({
      payments,
      stats: {
        totalRevenue,
        monthlyRevenue,
        lastMonthRevenue,
        monthlyGrowth,
        avgTransactionValue,
        successCount: successPayments.length,
        failedCount: failedPayments.length,
        pendingCount: pendingPayments.length,
        totalTransactions: payments.length,
        successRate,
      },
      charts: {
        dailyRevenue,
        weeklyRevenue,
        conversionData,
      },
    });
  } catch (error) {
    console.error('Payments API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments data' },
      { status: 500 }
    );
  }
}
