import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const ADMIN_USER = 'caglar.binici';
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

// All available pages in the dashboard
export const ALL_PAGES = [
  { id: 'overview', name: 'Overview', href: '/' },
  { id: 'conversations', name: 'Conversations', href: '/conversations' },
  { id: 'crm', name: 'CRM', href: '/crm' },
  { id: 'map', name: 'Routes', href: '/map' },
  { id: 'analytics', name: 'Analytics', href: '/analytics' },
  { id: 'finance', name: 'Finance', href: '/finance' },
  { id: 'users', name: 'Users', href: '/users' },
  { id: 'health', name: 'Health', href: '/health' },
];

// Employee definitions
const EMPLOYEES = [
  { username: 'sadettin.okan', displayName: 'Sadettin Okan' },
  { username: 'atakan.akarsu', displayName: 'Atakan Akarsu' },
];

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

// GET - Fetch all employees with their permissions
export async function GET(request: Request) {
  try {
    const session = await getServerSession();

    // Only admin can access
    if (session?.user?.name !== ADMIN_USER) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get permissions for all employees
    const employeesWithPermissions = await Promise.all(
      EMPLOYEES.map(async (emp) => {
        try {
          const result = await docClient.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: `EMPLOYEE#${emp.username}`,
              sk: 'PERMISSIONS',
            },
          }));

          return {
            ...emp,
            allowedPages: result.Item?.allowedPages || ALL_PAGES.map(p => p.id), // Default: all pages
          };
        } catch {
          return {
            ...emp,
            allowedPages: ALL_PAGES.map(p => p.id), // Default: all pages
          };
        }
      })
    );

    return NextResponse.json({
      employees: employeesWithPermissions,
      allPages: ALL_PAGES,
    });
  } catch (error) {
    console.error('Employees API error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST - Update employee permissions
export async function POST(request: Request) {
  try {
    const session = await getServerSession();

    // Only admin can update
    if (session?.user?.name !== ADMIN_USER) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { username, allowedPages } = body;

    if (!username || !allowedPages) {
      return NextResponse.json({ error: 'Missing username or allowedPages' }, { status: 400 });
    }

    // Validate employee exists
    if (!EMPLOYEES.find(e => e.username === username)) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Save permissions
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk: `EMPLOYEE#${username}`,
        sk: 'PERMISSIONS',
        allowedPages,
        updatedAt: new Date().toISOString(),
      },
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update permissions error:', error);
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
  }
}
