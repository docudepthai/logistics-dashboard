import { NextRequest, NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

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

// Helper to check if user has searched (has origin or destination in context)
function hasSearched(context: Record<string, unknown> | undefined): boolean {
  if (!context) return false;
  return !!(context.lastOrigin || context.lastDestination);
}

// GET - Get all call list items (also auto-adds users who haven't searched)
export async function GET() {
  try {
    // Fetch both call list items and conversations in parallel
    const [callListResult, conversationsResult] = await Promise.all([
      docClient.send(
        new ScanCommand({
          TableName: CONVERSATIONS_TABLE,
          FilterExpression: 'sk = :callList',
          ExpressionAttributeValues: {
            ':callList': 'CALL_LIST',
          },
        })
      ),
      docClient.send(
        new ScanCommand({
          TableName: CONVERSATIONS_TABLE,
          FilterExpression: 'sk = :conversation',
          ExpressionAttributeValues: {
            ':conversation': 'CONVERSATION',
          },
          ProjectionExpression: 'pk, #ctx',
          ExpressionAttributeNames: {
            '#ctx': 'context',
          },
        })
      ),
    ]);

    // Build a map of phone -> context for quick lookup
    const phoneContextMap = new Map<string, Record<string, unknown> | undefined>();
    for (const item of conversationsResult.Items || []) {
      const phone = (item.pk as string)?.replace('USER#', '') || '';
      phoneContextMap.set(phone, item.context as Record<string, unknown> | undefined);
    }

    // Get existing call list items
    const existingCallListItems = callListResult.Items || [];
    const existingPhones = new Set(
      existingCallListItems.map(item => item.phoneNumber as string)
    );

    // Find auto-added users who have NOW searched - remove them from call list
    const usersToRemove = existingCallListItems
      .filter(item => {
        // Only auto-remove if they were auto-added (not manually added)
        if (!item.autoAdded) return false;
        // Check if they have now searched
        const context = phoneContextMap.get(item.phoneNumber as string);
        return hasSearched(context);
      })
      .map(item => item.phoneNumber as string);

    // Remove users who have now searched
    if (usersToRemove.length > 0) {
      const removePromises = usersToRemove.map(phone =>
        docClient.send(
          new DeleteCommand({
            TableName: CONVERSATIONS_TABLE,
            Key: {
              pk: `USER#${phone}`,
              sk: 'CALL_LIST',
            },
          })
        ).catch(() => {}) // Ignore errors
      );
      await Promise.all(removePromises);
      // Update the existing phones set
      for (const phone of usersToRemove) {
        existingPhones.delete(phone);
      }
    }

    // Find users who haven't searched and aren't in call list
    const usersToAdd = (conversationsResult.Items || [])
      .filter(item => {
        const phone = (item.pk as string)?.replace('USER#', '') || '';
        // Must be a valid phone number (10+ digits)
        if (!/^[+]?\d{10,}$/.test(phone)) return false;
        // Not already in call list
        if (existingPhones.has(phone)) return false;
        // Hasn't searched
        return !hasSearched(item.context as Record<string, unknown>);
      })
      .map(item => (item.pk as string).replace('USER#', ''));

    // Auto-add users who haven't searched (in background, don't wait)
    if (usersToAdd.length > 0) {
      const addPromises = usersToAdd.map(phone =>
        docClient.send(
          new PutCommand({
            TableName: CONVERSATIONS_TABLE,
            Item: {
              pk: `USER#${phone}`,
              sk: 'CALL_LIST',
              phoneNumber: phone,
              reason: 'İş fonksiyonu kullanılmamış',
              notes: '',
              calledAt: null,
              addedAt: new Date().toISOString(),
              autoAdded: true,
            },
            ConditionExpression: 'attribute_not_exists(pk)', // Only add if not exists
          })
        ).catch(() => {}) // Ignore errors (e.g., if already exists)
      );
      // Wait for all to complete
      await Promise.all(addPromises);
    }

    // Re-fetch call list after auto-adding/removing
    const finalResult = (usersToAdd.length > 0 || usersToRemove.length > 0)
      ? await docClient.send(
          new ScanCommand({
            TableName: CONVERSATIONS_TABLE,
            FilterExpression: 'sk = :callList',
            ExpressionAttributeValues: {
              ':callList': 'CALL_LIST',
            },
          })
        )
      : callListResult;

    const items: CallListItem[] = (finalResult.Items || []).map(item => ({
      phoneNumber: item.phoneNumber || '',
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

    return NextResponse.json({ items, autoAdded: usersToAdd.length, autoRemoved: usersToRemove.length });
  } catch (error) {
    console.error('Error fetching call list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch call list', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Add to call list (upsert)
export async function POST(request: NextRequest) {
  // Debug info for troubleshooting
  const debugInfo = {
    region: process.env.REGION || 'not set',
    table: process.env.CONVERSATIONS_TABLE || 'not set',
    hasKey: !!process.env.MY_AWS_ACCESS_KEY_ID,
    hasSecret: !!process.env.MY_AWS_SECRET_ACCESS_KEY,
  };

  try {
    const body = await request.json();
    const { phoneNumber, reason, notes, autoAdded } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required', debug: debugInfo }, { status: 400 });
    }

    // Simple upsert - just put the item (will overwrite if exists)
    await docClient.send(
      new PutCommand({
        TableName: CONVERSATIONS_TABLE,
        Item: {
          pk: `USER#${phoneNumber}`,
          sk: 'CALL_LIST',
          phoneNumber: phoneNumber,
          reason: reason || 'Kullanmadı',
          notes: notes || '',
          calledAt: null,
          addedAt: new Date().toISOString(),
          autoAdded: autoAdded === true,
        },
      })
    );

    return NextResponse.json({ success: true, phoneNumber });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    return NextResponse.json(
      {
        error: 'Failed to add to call list',
        details: errorMessage,
        errorName,
        debug: debugInfo,
      },
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
