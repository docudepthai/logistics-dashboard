/**
 * Auto-Nudge Lambda Handler
 *
 * Runs on a schedule (every 15 minutes) to automatically send nudge messages
 * to users who:
 * 1. Haven't performed a search (no lastOrigin/lastDestination in context)
 * 2. Are within the 24h WhatsApp messaging window
 * 3. Haven't been nudged yet
 * 4. Are within the configured trigger window (e.g., 3 hours before window closes)
 *
 * The function is idempotent - it marks users as nudged immediately after sending
 * to prevent duplicate messages.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Initialize clients
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Constants
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

// Default settings
const DEFAULT_SETTINGS = {
  mode: 'manual' as const,
  triggerHours: 3,
  messageTemplate: 'abi merhaba, dun kaydolmuştun ama hic is aramadin. nasil calistigini gostereyim mi? ornek: "istanbul ankara" yaz, sana yukler gostereyim. bedava 7 gun, istersen dene.',
};

interface NudgeSettings {
  mode: 'automatic' | 'manual';
  triggerHours: number;
  messageTemplate: string;
}

interface Message {
  role: string;
  content: string;
  timestamp: string;
}

interface NudgeResult {
  phoneNumber: string;
  success: boolean;
  error?: string;
}

/**
 * Fetch nudge settings from DynamoDB
 */
async function getNudgeSettings(): Promise<NudgeSettings> {
  try {
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: 'SETTINGS', sk: 'NUDGE_CONFIG' },
      })
    );

    if (result.Item) {
      return {
        mode: result.Item.mode || DEFAULT_SETTINGS.mode,
        triggerHours: result.Item.triggerHours ?? DEFAULT_SETTINGS.triggerHours,
        messageTemplate: result.Item.messageTemplate || DEFAULT_SETTINGS.messageTemplate,
      };
    }

    return DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Failed to fetch nudge settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Send a WhatsApp text message
 */
async function sendWhatsAppMessage(phoneNumber: string, message: string): Promise<boolean> {
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.error('WhatsApp credentials not configured');
    return false;
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

    const data = await response.json() as { messages?: Array<{ id: string }> };

    if (data.messages?.[0]?.id) {
      console.log(`✓ Message sent to ${phoneNumber}, message_id: ${data.messages[0].id}`);
      return true;
    } else {
      console.error(`✗ Failed to send to ${phoneNumber}:`, JSON.stringify(data));
      return false;
    }
  } catch (error) {
    console.error(`✗ Error sending to ${phoneNumber}:`, error);
    return false;
  }
}

/**
 * Mark a user as nudged and save message to conversation history
 */
async function markAsNudgedAndSaveMessage(phoneNumber: string, message: string): Promise<void> {
  const now = new Date().toISOString();

  // First, get current conversation to append message
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `USER#${phoneNumber}`,
        sk: 'CONVERSATION',
      },
    })
  );

  const currentMessages: Message[] = result.Item?.messages || [];

  // Add the nudge message to conversation history as assistant message
  const newMessage: Message = {
    role: 'assistant',
    content: message,
    timestamp: now,
  };

  // Update with nudge status and new message
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        pk: `USER#${phoneNumber}`,
        sk: 'CONVERSATION',
      },
      UpdateExpression: 'SET nudgeSent = :sent, nudgeSentAt = :at, messages = :messages, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':sent': true,
        ':at': now,
        ':messages': [...currentMessages, newMessage],
        ':updatedAt': now,
      },
    })
  );
}

/**
 * Get all eligible users for nudging
 */
async function getEligibleUsers(triggerHours: number): Promise<Array<{ phoneNumber: string; hoursRemaining: number }>> {
  // Scan all items
  const allItems: any[] = [];
  let lastEvaluatedKey: Record<string, any> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );
    allItems.push(...(result.Items || []));
    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Build maps
  const conversations = new Map<string, any>();

  for (const item of allItems) {
    const phone = (item.pk as string)?.replace('USER#', '');
    if (!phone || !/^[+]?\d+$/.test(phone) || phone.length < 10) continue;

    if (item.sk === 'CONVERSATION') {
      conversations.set(phone, item);
    }
  }

  const now = Date.now();
  const eligibleUsers: Array<{ phoneNumber: string; hoursRemaining: number }> = [];

  for (const [phone, conv] of Array.from(conversations.entries())) {
    const messages: Message[] = conv.messages || [];
    const context = conv.context || {};

    // Skip if already nudged
    if (conv.nudgeSent === true) {
      continue;
    }

    // Skip if user has searched (has context)
    if (context.lastOrigin || context.lastDestination) {
      continue;
    }

    // Find last user message timestamp
    const userMessages = messages.filter((m: Message) => m.role === 'user');
    if (userMessages.length === 0) continue;

    const lastUserMessage = userMessages[userMessages.length - 1];
    if (!lastUserMessage) continue;
    const lastMessageAt = new Date(lastUserMessage.timestamp).getTime();
    const hoursElapsed = (now - lastMessageAt) / (1000 * 60 * 60);
    const hoursRemaining = 24 - hoursElapsed;

    // Only include if within 24h window AND within trigger window
    if (hoursRemaining > 0 && hoursRemaining <= triggerHours) {
      eligibleUsers.push({
        phoneNumber: phone,
        hoursRemaining,
      });
    }
  }

  // Sort by urgency (least time remaining first)
  eligibleUsers.sort((a, b) => a.hoursRemaining - b.hoursRemaining);

  return eligibleUsers;
}

/**
 * Lambda handler - triggered by EventBridge schedule
 */
export async function handler(event: any): Promise<{ statusCode: number; body: string }> {
  const startTime = Date.now();
  console.log('=== Auto-Nudge Lambda Started ===');
  console.log('Event:', JSON.stringify(event));

  try {
    // 1. Get settings
    const settings = await getNudgeSettings();
    console.log(`Settings: mode=${settings.mode}, triggerHours=${settings.triggerHours}`);

    // 2. Check if automatic mode is enabled
    if (settings.mode !== 'automatic') {
      console.log('Automatic mode is disabled. Exiting.');
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Automatic mode disabled',
          mode: settings.mode,
        }),
      };
    }

    // 3. Get eligible users
    const eligibleUsers = await getEligibleUsers(settings.triggerHours);
    console.log(`Found ${eligibleUsers.length} eligible users`);

    if (eligibleUsers.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No eligible users to nudge',
          checked: true,
        }),
      };
    }

    // 4. Send messages with rate limiting (max 10 per run to avoid issues)
    const maxPerRun = 10;
    const usersToProcess = eligibleUsers.slice(0, maxPerRun);
    const results: NudgeResult[] = [];

    for (const user of usersToProcess) {
      console.log(`Processing ${user.phoneNumber} (${user.hoursRemaining.toFixed(1)}h remaining)`);

      // Send the message first
      const success = await sendWhatsAppMessage(user.phoneNumber, settings.messageTemplate);

      // Mark as nudged and save message to conversation history
      await markAsNudgedAndSaveMessage(user.phoneNumber, settings.messageTemplate);

      results.push({
        phoneNumber: user.phoneNumber,
        success,
        error: success ? undefined : 'Failed to send message',
      });

      // Small delay between messages to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 5. Log summary
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const duration = Date.now() - startTime;

    console.log('=== Auto-Nudge Summary ===');
    console.log(`Processed: ${results.length}`);
    console.log(`Successful: ${successful}`);
    console.log(`Failed: ${failed}`);
    console.log(`Remaining eligible: ${eligibleUsers.length - usersToProcess.length}`);
    console.log(`Duration: ${duration}ms`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Auto-nudge completed',
        processed: results.length,
        successful,
        failed,
        remainingEligible: eligibleUsers.length - usersToProcess.length,
        duration,
        results,
      }),
    };
  } catch (error) {
    console.error('Auto-nudge error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: 'Auto-nudge failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}
