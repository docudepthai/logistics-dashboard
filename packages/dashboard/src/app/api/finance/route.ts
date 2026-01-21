import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

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

export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Scan for all payment records
    const result = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(pk, :prefix)',
      ExpressionAttributeValues: {
        ':prefix': 'PAYMENT#',
      },
    }));

    const payments: Payment[] = (result.Items || []).map(item => ({
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

    // Monthly revenue (current month)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlyRevenue = successPayments
      .filter(p => p.paidAt && new Date(p.paidAt) >= currentMonthStart)
      .reduce((sum, p) => sum + (p.totalAmount || p.amount), 0);

    return NextResponse.json({
      payments,
      stats: {
        totalRevenue,
        monthlyRevenue,
        successCount: successPayments.length,
        failedCount: failedPayments.length,
        pendingCount: pendingPayments.length,
        totalTransactions: payments.length,
      },
    });
  } catch (error) {
    console.error('Finance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finance data' },
      { status: 500 }
    );
  }
}
