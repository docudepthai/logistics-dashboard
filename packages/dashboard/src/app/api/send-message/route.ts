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

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

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

    const errorMsg = data.error?.message || 'Unknown WhatsApp API error';
    return { success: false, error: errorMsg };
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Check if the last user message is within 24 hours
function isWithin24HourWindow(messages: Message[]): { isWithin: boolean; lastUserMessageTime?: Date; hoursAgo?: number } {
  // Find the last user message
  const userMessages = messages.filter(m => m.role === 'user');
  if (userMessages.length === 0) {
    return { isWithin: false };
  }

  const lastUserMessage = userMessages[userMessages.length - 1];
  const lastUserMessageTime = new Date(lastUserMessage.timestamp);
  const now = new Date();
  const hoursAgo = (now.getTime() - lastUserMessageTime.getTime()) / (1000 * 60 * 60);

  return {
    isWithin: hoursAgo <= 24,
    lastUserMessageTime,
    hoursAgo: Math.round(hoursAgo),
  };
}

// POST - Send custom message to a user
export async function POST(request: Request) {
  try {
    const { phoneNumber, message } = await request.json();

    if (!phoneNumber) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 });
    }

    if (message.length > 4096) {
      return NextResponse.json({ error: 'Message too long (max 4096 characters)' }, { status: 400 });
    }

    // Get conversation to check 24-hour window
    const conversationResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'CONVERSATION',
        },
      })
    );

    const messages: Message[] = conversationResult.Item?.messages || [];
    const windowCheck = isWithin24HourWindow(messages);

    if (!windowCheck.isWithin) {
      return NextResponse.json(
        {
          error: '24 saat penceresi dolmus. Kullanici son mesajini ' + (windowCheck.hoursAgo ? `${windowCheck.hoursAgo} saat once` : 'cok uzun zaman once') + ' gonderdi.',
          windowExpired: true,
          hoursAgo: windowCheck.hoursAgo,
        },
        { status: 400 }
      );
    }

    // Send the custom message
    const result = await sendWhatsAppMessage(phoneNumber, message.trim());

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send WhatsApp message' },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();

    // Add the message to conversation history
    const newMessage: Message = {
      role: 'assistant',
      content: message.trim(),
      timestamp: now,
    };

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          pk: `USER#${phoneNumber}`,
          sk: 'CONVERSATION',
        },
        UpdateExpression: 'SET messages = :messages, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':messages': [...messages, newMessage],
          ':updatedAt': now,
        },
      })
    );

    return NextResponse.json({
      success: true,
      phoneNumber,
      messageId: result.messageId,
      message: newMessage,
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to send message' },
      { status: 500 }
    );
  }
}
