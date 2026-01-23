import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const SETTINGS_KEY = { pk: 'SETTINGS', sk: 'NUDGE_CONFIG' };
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

const DEFAULT_SETTINGS = {
  mode: 'manual' as 'automatic' | 'manual',
  triggerHours: 3,
  messageTemplate: 'abi merhaba, dun yazmistin ama hic is aramadin. nasil calistigini gostereyim mi? ornek: "istanbul ankara" yaz, sana yukler gostereyim. bedava 7 gun, istersen dene.',
  lastUpdated: null as string | null,
  updatedBy: null as string | null,
};

export type NudgeSettings = typeof DEFAULT_SETTINGS;

// GET - Fetch current settings
export async function GET() {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: SETTINGS_KEY,
      })
    );

    if (result.Item) {
      return NextResponse.json({
        mode: result.Item.mode || DEFAULT_SETTINGS.mode,
        triggerHours: result.Item.triggerHours ?? DEFAULT_SETTINGS.triggerHours,
        messageTemplate: result.Item.messageTemplate || DEFAULT_SETTINGS.messageTemplate,
        lastUpdated: result.Item.lastUpdated,
        updatedBy: result.Item.updatedBy,
      });
    }

    return NextResponse.json(DEFAULT_SETTINGS);
  } catch (error) {
    console.error('Nudge settings GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// POST - Update settings
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mode, triggerHours, messageTemplate, updatedBy } = body;

    // Validate
    if (mode && !['automatic', 'manual'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (triggerHours !== undefined && (triggerHours < 1 || triggerHours > 23)) {
      return NextResponse.json({ error: 'triggerHours must be between 1 and 23' }, { status: 400 });
    }

    // Get current settings first
    const current = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: SETTINGS_KEY,
      })
    );

    const currentSettings = current.Item || DEFAULT_SETTINGS;

    // Merge with new values
    const newSettings = {
      ...SETTINGS_KEY,
      mode: mode ?? currentSettings.mode ?? DEFAULT_SETTINGS.mode,
      triggerHours: triggerHours ?? currentSettings.triggerHours ?? DEFAULT_SETTINGS.triggerHours,
      messageTemplate: messageTemplate ?? currentSettings.messageTemplate ?? DEFAULT_SETTINGS.messageTemplate,
      lastUpdated: new Date().toISOString(),
      updatedBy: updatedBy || null,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: newSettings,
      })
    );

    return NextResponse.json({
      mode: newSettings.mode,
      triggerHours: newSettings.triggerHours,
      messageTemplate: newSettings.messageTemplate,
      lastUpdated: newSettings.lastUpdated,
      updatedBy: newSettings.updatedBy,
    });
  } catch (error) {
    console.error('Nudge settings POST error:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
