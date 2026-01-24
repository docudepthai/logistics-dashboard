import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const ADMIN_USER = 'caglar.binici';
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

// All available pages (matches Sidebar.tsx)
const ALL_PAGES = ['overview', 'health', 'problems', 'users', 'user-analytics', 'conversations', 'crm-inactive', 'crm-contacts', 'analytics', 'finance', 'map'];

// DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.user.name;

    // Admin has access to everything
    if (username === ADMIN_USER) {
      return NextResponse.json({
        isAdmin: true,
        allowedPages: ALL_PAGES,
      });
    }

    // Get employee permissions
    try {
      const result = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `EMPLOYEE#${username}`,
          sk: 'PERMISSIONS',
        },
      }));

      return NextResponse.json({
        isAdmin: false,
        allowedPages: result.Item?.allowedPages || ALL_PAGES, // Default: all pages if not set
      });
    } catch {
      // If no permissions set, allow all pages by default
      return NextResponse.json({
        isAdmin: false,
        allowedPages: ALL_PAGES,
      });
    }
  } catch (error) {
    console.error('User permissions error:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}
