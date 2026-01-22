import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

// GET - Get called status for a user
export async function GET(request: NextRequest) {
  const phoneNumber = request.nextUrl.searchParams.get('phone');

  if (!phoneNumber) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }

  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'PROFILE',
        },
        ProjectionExpression: 'calledAt',
      })
    );

    return NextResponse.json({
      phoneNumber,
      called: !!result.Item?.calledAt,
      calledAt: result.Item?.calledAt || null,
    });
  } catch (error) {
    console.error('Error getting called status:', error);
    return NextResponse.json(
      { error: 'Failed to get called status' },
      { status: 500 }
    );
  }
}

// POST - Mark user as called or uncalled
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, called } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    if (called) {
      // Mark as called
      await docClient.send(
        new UpdateCommand({
          TableName: CONVERSATIONS_TABLE,
          Key: {
            pk: `USER#${phoneNumber}`,
            sk: 'PROFILE',
          },
          UpdateExpression: 'SET calledAt = :now',
          ExpressionAttributeValues: {
            ':now': new Date().toISOString(),
          },
        })
      );
    } else {
      // Remove called status
      await docClient.send(
        new UpdateCommand({
          TableName: CONVERSATIONS_TABLE,
          Key: {
            pk: `USER#${phoneNumber}`,
            sk: 'PROFILE',
          },
          UpdateExpression: 'REMOVE calledAt',
        })
      );
    }

    return NextResponse.json({
      phoneNumber,
      called,
      calledAt: called ? new Date().toISOString() : null,
    });
  } catch (error) {
    console.error('Error updating called status:', error);
    return NextResponse.json(
      { error: 'Failed to update called status' },
      { status: 500 }
    );
  }
}
