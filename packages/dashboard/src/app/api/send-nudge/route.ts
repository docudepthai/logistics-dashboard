import { NextResponse } from 'next/server';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

export const dynamic = 'force-dynamic';

const dynamoClient = new DynamoDBClient({
  region: process.env.REGION || 'eu-central-1',
  credentials: process.env.MY_AWS_ACCESS_KEY_ID ? {
    accessKeyId: process.env.MY_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.MY_AWS_SECRET_ACCESS_KEY || '',
  } : undefined,
});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '975431092314310';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';

const DEFAULT_MESSAGE = 'abi merhaba, dun kaydolmuştun ama hic is aramadin. nasil calistigini gostereyim mi? ornek: "istanbul ankara" yaz, sana yukler gostereyim. bedava 7 gun, istersen dene.';

interface SendResult {
  success: boolean;
  error?: string;
  messageId?: string;
}

async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<SendResult> {
  if (!WHATSAPP_ACCESS_TOKEN) {
    return { success: false, error: 'WHATSAPP_ACCESS_TOKEN not configured' };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: message },
        }),
      }
    );

    const data = await response.json();

    if (data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }

    // Return error from WhatsApp API if available
    const errorMsg = data.error?.message || 'Unknown WhatsApp API error';
    return { success: false, error: errorMsg };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// POST - Send nudge to a specific user
export async function POST(request: Request) {
  try {
    const { phoneNumber } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Get message template from settings
    const settingsResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'SETTINGS', sk: 'NUDGE_CONFIG' },
      })
    );

    const message = settingsResult.Item?.messageTemplate || DEFAULT_MESSAGE;

    // Send the message
    const result = await sendWhatsAppMessage(phoneNumber, message);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send WhatsApp message' },
        { status: 500 }
      );
    }

    // Mark as nudged in conversation
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'CONVERSATION',
        },
        UpdateExpression: 'SET nudgeSent = :sent, nudgeSentAt = :at',
        ExpressionAttributeValues: {
          ':sent': true,
          ':at': new Date().toISOString(),
        },
      })
    );

    return NextResponse.json({ success: true, phoneNumber, messageId: result.messageId });
  } catch (error) {
    console.error('Send nudge error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send nudge' },
      { status: 500 }
    );
  }
}
