import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminSetUserPasswordCommand,
  AdminGetUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const ADMIN_USER = 'caglar.binici';
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';
const COGNITO_USER_POOL_ID = 'eu-central-1_kbo7DP9KO';

// All available pages in the dashboard (matches Sidebar.tsx)
const ALL_PAGES = [
  { id: 'overview', name: 'Overview', href: '/' },
  { id: 'health', name: 'Health', href: '/health' },
  { id: 'problems', name: 'Problems', href: '/problems' },
  { id: 'users', name: 'Users', href: '/users' },
  { id: 'user-analytics', name: 'User Analytics', href: '/user-analytics' },
  { id: 'conversations', name: 'Conversations', href: '/conversations' },
  { id: 'crm-inactive', name: 'Inactive Users', href: '/crm/pasif-kullanicilar' },
  { id: 'crm-contacts', name: 'Contact List', href: '/crm/iletisim-listesi' },
  { id: 'analytics', name: 'Analytics', href: '/analytics' },
  { id: 'finance', name: 'Finance', href: '/finance' },
  { id: 'map', name: 'Routes', href: '/map' },
];

// Lazy-initialized clients to avoid module loading issues
let _dynamoClient: DynamoDBClient | null = null;
let _docClient: DynamoDBDocumentClient | null = null;
let _cognitoClient: CognitoIdentityProviderClient | null = null;

function getDynamoClient() {
  if (!_dynamoClient) {
    _dynamoClient = new DynamoDBClient({
      region: process.env.REGION || 'eu-central-1',
      credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
      } : undefined,
    });
  }
  return _dynamoClient;
}

function getDocClient() {
  if (!_docClient) {
    _docClient = DynamoDBDocumentClient.from(getDynamoClient());
  }
  return _docClient;
}

function getCognitoClient() {
  if (!_cognitoClient) {
    _cognitoClient = new CognitoIdentityProviderClient({
      region: process.env.REGION || 'eu-central-1',
      credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
        accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
      } : undefined,
    });
  }
  return _cognitoClient;
}

export const dynamic = 'force-dynamic';

// GET - Fetch all employees with their permissions
export async function GET() {
  try {
    const session = await getServerSession();

    if (session?.user?.name !== ADMIN_USER) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get all employees from DynamoDB
    const employeesResult = await getDocClient().send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(pk, :pk) AND sk = :sk',
      ExpressionAttributeValues: {
        ':pk': 'EMPLOYEE#',
        ':sk': 'PROFILE',
      },
    }));

    // Get Cognito users for status
    let cognitoUsers: Map<string, { status: string; email: string }> = new Map();
    try {
      const cognitoResult = await getCognitoClient().send(new ListUsersCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Limit: 60,
      }));

      for (const user of cognitoResult.Users || []) {
        const username = user.Username || '';
        const email = user.Attributes?.find(a => a.Name === 'email')?.Value || '';
        const status = user.Enabled ? 'active' : 'inactive';
        cognitoUsers.set(username, { status, email });
      }
    } catch (err) {
      console.error('Failed to fetch Cognito users:', err);
    }

    // Combine DynamoDB and Cognito data
    const employees = await Promise.all(
      (employeesResult.Items || []).map(async (item) => {
        const username = item.username;

        // Get permissions
        let allowedPages = ALL_PAGES.map(p => p.id); // Default: all pages
        try {
          const permResult = await getDocClient().send(new GetCommand({
            TableName: TABLE_NAME,
            Key: {
              pk: `EMPLOYEE#${username}`,
              sk: 'PERMISSIONS',
            },
          }));
          if (permResult.Item?.allowedPages) {
            allowedPages = Array.isArray(permResult.Item.allowedPages)
              ? permResult.Item.allowedPages
              : [];
          }
        } catch {
          // Use default
        }

        const cognitoInfo = cognitoUsers.get(username);

        return {
          username,
          displayName: item.displayName || username,
          email: item.email || cognitoInfo?.email || '',
          allowedPages,
          status: cognitoInfo?.status || 'inactive',
          createdAt: item.createdAt,
        };
      })
    );

    // Sort by displayName
    employees.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json({
      employees,
      allPages: ALL_PAGES,
    });
  } catch (error) {
    console.error('Employees API error:', error);
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }
}

// POST - Update employee permissions
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (session?.user?.name !== ADMIN_USER) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { username, allowedPages } = body;

    if (!username || !allowedPages) {
      return NextResponse.json({ error: 'Missing username or allowedPages' }, { status: 400 });
    }

    // Save permissions
    await getDocClient().send(new PutCommand({
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

// PUT - Create employee, update employee, or reset password
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (session?.user?.name !== ADMIN_USER) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { action, username, displayName, email, tempPassword } = body;

    if (action === 'create') {
      // Validate required fields
      if (!username || !displayName || !email || !tempPassword) {
        return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
      }

      // Create Cognito user
      try {
        await getCognitoClient().send(new AdminCreateUserCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: username,
          TemporaryPassword: tempPassword,
          UserAttributes: [
            { Name: 'email', Value: email },
            { Name: 'email_verified', Value: 'true' },
            { Name: 'name', Value: displayName },
          ],
          MessageAction: 'SUPPRESS', // Don't send email, we'll give them the password
        }));
      } catch (err: unknown) {
        const error = err as { name?: string; message?: string };
        if (error.name === 'UsernameExistsException') {
          return NextResponse.json({ error: 'Username already exists in Cognito' }, { status: 400 });
        }
        console.error('Cognito create error:', error);
        return NextResponse.json({ error: error.message || 'Failed to create Cognito user' }, { status: 500 });
      }

      // Save employee profile to DynamoDB
      await getDocClient().send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `EMPLOYEE#${username}`,
          sk: 'PROFILE',
          username,
          displayName,
          email,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }));

      // Set default permissions (all pages)
      await getDocClient().send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `EMPLOYEE#${username}`,
          sk: 'PERMISSIONS',
          allowedPages: ALL_PAGES.map(p => p.id),
          updatedAt: new Date().toISOString(),
        },
      }));

      return NextResponse.json({ success: true });
    }

    if (action === 'update') {
      if (!username) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 });
      }

      // Update DynamoDB profile
      await getDocClient().send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `EMPLOYEE#${username}`,
          sk: 'PROFILE',
          username,
          displayName: displayName || username,
          email: email || '',
          updatedAt: new Date().toISOString(),
        },
      }));

      return NextResponse.json({ success: true });
    }

    if (action === 'reset-password') {
      if (!username) {
        return NextResponse.json({ error: 'Username is required' }, { status: 400 });
      }

      // Generate a new temporary password
      const newTempPassword = `Temp${Math.random().toString(36).slice(2, 8)}!${Math.floor(Math.random() * 100)}`;

      try {
        await getCognitoClient().send(new AdminSetUserPasswordCommand({
          UserPoolId: COGNITO_USER_POOL_ID,
          Username: username,
          Password: newTempPassword,
          Permanent: false,
        }));
      } catch (err: unknown) {
        const error = err as { message?: string };
        console.error('Cognito reset password error:', error);
        return NextResponse.json({ error: error.message || 'Failed to reset password' }, { status: 500 });
      }

      return NextResponse.json({ success: true, tempPassword: newTempPassword });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('PUT employees error:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}

// DELETE - Delete employee from Cognito and DynamoDB
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();

    if (session?.user?.name !== ADMIN_USER) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    // Prevent deleting admin
    if (username === ADMIN_USER) {
      return NextResponse.json({ error: 'Cannot delete admin user' }, { status: 400 });
    }

    // Delete from Cognito
    try {
      await getCognitoClient().send(new AdminDeleteUserCommand({
        UserPoolId: COGNITO_USER_POOL_ID,
        Username: username,
      }));
    } catch (err: unknown) {
      const error = err as { name?: string; message?: string };
      // Ignore if user doesn't exist in Cognito
      if (error.name !== 'UserNotFoundException') {
        console.error('Cognito delete error:', error);
      }
    }

    // Delete from DynamoDB - profile and permissions
    await Promise.all([
      getDocClient().send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `EMPLOYEE#${username}`,
          sk: 'PROFILE',
        },
      })),
      getDocClient().send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `EMPLOYEE#${username}`,
          sk: 'PERMISSIONS',
        },
      })),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
