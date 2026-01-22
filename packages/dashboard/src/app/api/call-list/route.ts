import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, DeleteCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});

const docClient = DynamoDBDocumentClient.from(dynamoClient);
const CONVERSATIONS_TABLE = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

export interface CallListItem {
  phoneNumber: string;
  reason: string;
  notes: string;
  calledAt: string | null;
  addedAt: string;
  autoAdded: boolean; // true if auto-added because user didn't search
}

// GET - Get all call list items (also auto-adds users who didn't search)
export async function GET() {
  try {
    // First, get all conversations and call list items in parallel
    const [conversationsResult, callListResult] = await Promise.all([
      docClient.send(
        new ScanCommand({
          TableName: CONVERSATIONS_TABLE,
          FilterExpression: 'sk = :conversation',
          ExpressionAttributeValues: {
            ':conversation': 'CONVERSATION',
          },
          ProjectionExpression: 'pk, context',
        })
      ),
      docClient.send(
        new ScanCommand({
          TableName: CONVERSATIONS_TABLE,
          FilterExpression: 'sk = :callList',
          ExpressionAttributeValues: {
            ':callList': 'CALL_LIST',
          },
        })
      ),
    ]);

    // Find users who didn't search and aren't in call list
    const callListPhones = new Set(
      (callListResult.Items || []).map(item => item.phoneNumber as string)
    );

    const usersToAdd = (conversationsResult.Items || [])
      .filter(item => {
        const phoneNumber = (item.pk as string)?.replace('USER#', '');
        if (!phoneNumber || !/^[+]?\d+$/.test(phoneNumber) || phoneNumber.length < 10) return false;
        if (callListPhones.has(phoneNumber)) return false;
        const context = item.context as Record<string, unknown> | undefined;
        return !context?.lastOrigin && !context?.lastDestination;
      })
      .map(item => (item.pk as string).replace('USER#', ''));

    // Auto-add users who didn't search
    for (const phoneNumber of usersToAdd) {
      try {
        await docClient.send(
          new PutCommand({
            TableName: CONVERSATIONS_TABLE,
            Item: {
              pk: `USER#${phoneNumber}`,
              sk: 'CALL_LIST',
              phoneNumber,
              reason: 'Kullanmadı',
              notes: '',
              calledAt: null,
              addedAt: new Date().toISOString(),
              autoAdded: true,
            },
            ConditionExpression: 'attribute_not_exists(pk)',
          })
        );
      } catch {
        // Ignore - item might already exist
      }
    }

    // Re-fetch call list if we added new items
    let finalItems = callListResult.Items || [];
    if (usersToAdd.length > 0) {
      const refreshedResult = await docClient.send(
        new ScanCommand({
          TableName: CONVERSATIONS_TABLE,
          FilterExpression: 'sk = :callList',
          ExpressionAttributeValues: {
            ':callList': 'CALL_LIST',
          },
        })
      );
      finalItems = refreshedResult.Items || [];
    }

    const items: CallListItem[] = finalItems.map(item => ({
      phoneNumber: item.phoneNumber,
      reason: item.reason || '',
      notes: item.notes || '',
      calledAt: item.calledAt || null,
      addedAt: item.addedAt || '',
      autoAdded: item.autoAdded || false,
    }));

    // Sort by addedAt desc (newest first), uncalled first
    items.sort((a, b) => {
      // Uncalled items first
      if (!a.calledAt && b.calledAt) return -1;
      if (a.calledAt && !b.calledAt) return 1;
      // Then by addedAt desc
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    });

    return NextResponse.json({ items, autoAdded: usersToAdd.length });
  } catch (error) {
    console.error('Error fetching call list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch call list', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Add to call list or update existing
export async function POST(request: NextRequest) {
  try {
    const { phoneNumber, reason, notes, autoAdded } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Check if already exists
    const existing = await docClient.send(
      new GetCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'CALL_LIST',
        },
      })
    );

    if (existing.Item) {
      // Update existing
      await docClient.send(
        new UpdateCommand({
          TableName: CONVERSATIONS_TABLE,
          Key: {
            pk: `USER#${phoneNumber}`,
            sk: 'CALL_LIST',
          },
          UpdateExpression: 'SET reason = :reason, notes = :notes',
          ExpressionAttributeValues: {
            ':reason': reason || existing.Item.reason || '',
            ':notes': notes !== undefined ? notes : (existing.Item.notes || ''),
          },
        })
      );
    } else {
      // Create new
      await docClient.send(
        new PutCommand({
          TableName: CONVERSATIONS_TABLE,
          Item: {
            pk: `USER#${phoneNumber}`,
            sk: 'CALL_LIST',
            phoneNumber,
            reason: reason || '',
            notes: notes || '',
            calledAt: null,
            addedAt: new Date().toISOString(),
            autoAdded: autoAdded || false,
          },
        })
      );
    }

    return NextResponse.json({ success: true, phoneNumber });
  } catch (error) {
    console.error('Error adding to call list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to add to call list', details: errorMessage },
      { status: 500 }
    );
  }
}

// PATCH - Update call list item (mark as called, update notes)
export async function PATCH(request: NextRequest) {
  try {
    const { phoneNumber, calledAt, notes, reason } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    const updateExpressions: string[] = [];
    const expressionValues: Record<string, unknown> = {};

    if (calledAt !== undefined) {
      updateExpressions.push('calledAt = :calledAt');
      expressionValues[':calledAt'] = calledAt;
    }
    if (notes !== undefined) {
      updateExpressions.push('notes = :notes');
      expressionValues[':notes'] = notes;
    }
    if (reason !== undefined) {
      updateExpressions.push('reason = :reason');
      expressionValues[':reason'] = reason;
    }

    if (updateExpressions.length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    await docClient.send(
      new UpdateCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'CALL_LIST',
        },
        UpdateExpression: `SET ${updateExpressions.join(', ')}`,
        ExpressionAttributeValues: expressionValues,
      })
    );

    return NextResponse.json({ success: true, phoneNumber });
  } catch (error) {
    console.error('Error updating call list:', error);
    return NextResponse.json(
      { error: 'Failed to update call list' },
      { status: 500 }
    );
  }
}

// DELETE - Remove from call list
export async function DELETE(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    await docClient.send(
      new DeleteCommand({
        TableName: CONVERSATIONS_TABLE,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'CALL_LIST',
        },
      })
    );

    return NextResponse.json({ success: true, phoneNumber });
  } catch (error) {
    console.error('Error removing from call list:', error);
    return NextResponse.json(
      { error: 'Failed to remove from call list' },
      { status: 500 }
    );
  }
}
