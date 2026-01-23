import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

export async function GET(request: NextRequest) {
  const phone = request.nextUrl.searchParams.get('phone');

  if (!phone) {
    return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
  }

  try {
    // Query all items for this user (PROFILE and CONVERSATION)
    const result = await docClient.send(
      new QueryCommand({
        TableName: process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations',
        KeyConditionExpression: 'pk = :pk',
        ExpressionAttributeValues: {
          ':pk': `USER#${phone}`,
        },
      })
    );

    let profile = null;
    let conversation = null;

    for (const item of result.Items || []) {
      if (item.sk === 'PROFILE') {
        profile = {
          phoneNumber: item.phoneNumber,
          firstContactAt: item.firstContactAt,
          freeTierExpiresAt: item.freeTierExpiresAt,
          membershipStatus: item.membershipStatus,
          welcomeMessageSent: item.welcomeMessageSent,
          paidUntil: item.paidUntil,
          paymentId: item.paymentId,
        };
      } else if (item.sk === 'CONVERSATION') {
        conversation = {
          messages: item.messages || [],
          context: item.context || {},
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        };
      }
    }

    return NextResponse.json({ profile, conversation });
  } catch (error) {
    console.error('User profile API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
