import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import postgres from 'postgres';
import { createHmac } from 'crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { LogisticsAgent, ConversationStore, UserStore } from '@turkish-logistics/agent';
import { maskPhoneNumbersInText } from '@turkish-logistics/shared/utils';

// WhatsApp signature validation
function verifyWhatsAppSignature(event: APIGatewayProxyEvent): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;

  // If no app secret configured, skip validation (for development)
  if (!appSecret) {
    console.warn('WHATSAPP_APP_SECRET not configured, skipping signature validation');
    return true;
  }

  const signature = event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256'];

  if (!signature) {
    console.error('Missing X-Hub-Signature-256 header');
    return false;
  }

  const body = event.body || '';
  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret)
    .update(body)
    .digest('hex');

  const isValid = signature === expectedSignature;

  if (!isValid) {
    console.error('Invalid webhook signature');
  }

  return isValid;
}

// Database connection (reused across invocations)
let sql: postgres.Sql | null = null;
let agent: LogisticsAgent | null = null;
let userStore: UserStore | null = null;

// DynamoDB client for deduplication
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const DEDUP_TABLE = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';
const DEDUP_TTL_SECONDS = 30 * 60; // 30 minutes

async function isDuplicateMessage(messageId: string): Promise<boolean> {
  try {
    // Check if message already processed
    const result = await docClient.send(new GetCommand({
      TableName: DEDUP_TABLE,
      Key: { pk: `MSG#${messageId}`, sk: 'DEDUP' },
    }));

    if (result.Item) {
      return true;
    }

    // Mark message as processed with TTL
    const ttl = Math.floor(Date.now() / 1000) + DEDUP_TTL_SECONDS;
    await docClient.send(new PutCommand({
      TableName: DEDUP_TABLE,
      Item: {
        pk: `MSG#${messageId}`,
        sk: 'DEDUP',
        processedAt: Date.now(),
        ttl,
      },
      ConditionExpression: 'attribute_not_exists(pk)',
    }));

    return false;
  } catch (error: unknown) {
    // If conditional check fails, another Lambda already processed it
    if (error && typeof error === 'object' && 'name' in error && error.name === 'ConditionalCheckFailedException') {
      return true;
    }
    // On other errors, log but don't block (fallback to allowing processing)
    console.error('Dedup check error:', error);
    return false;
  }
}

function getSql(): postgres.Sql {
  if (!sql) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    sql = postgres(connectionString, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return sql;
}

function getAgent(): LogisticsAgent {
  if (!agent) {
    const conversationStore = new ConversationStore({
      tableName: process.env.CONVERSATIONS_TABLE,
    });

    agent = new LogisticsAgent({
      openaiApiKey: process.env.OPENAI_API_KEY,
      sql: getSql(),
      conversationStore,
    });
  }
  return agent;
}

function getUserStore(): UserStore {
  if (!userStore) {
    userStore = new UserStore({
      tableName: process.env.CONVERSATIONS_TABLE,
    });
  }
  return userStore;
}

// WhatsApp Business API client
async function sendWhatsAppMessage(to: string, message: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn('WhatsApp credentials not configured, skipping message send');
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to send WhatsApp message:', error);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}

// Send WhatsApp video message (supports both media ID and URL)
async function sendWhatsAppVideoMessage(to: string, mediaIdOrUrl: string, caption?: string): Promise<void> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    console.warn('WhatsApp credentials not configured, skipping video send');
    return;
  }

  // Determine if it's a URL or media ID
  const isUrl = mediaIdOrUrl.startsWith('http://') || mediaIdOrUrl.startsWith('https://');
  const videoPayload: { id?: string; link?: string; caption?: string } = isUrl
    ? { link: mediaIdOrUrl }
    : { id: mediaIdOrUrl };

  if (caption) {
    videoPayload.caption = caption;
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'video',
        video: videoPayload,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Failed to send WhatsApp video:', error);
    throw new Error(`WhatsApp API error: ${response.status}`);
  }
}

// Send welcome message sequence (video + text) to new users
async function sendWelcomeMessage(to: string): Promise<void> {
  // Support both media ID and URL via environment variables
  const welcomeVideoSource = process.env.WELCOME_VIDEO_URL || process.env.WELCOME_VIDEO_MEDIA_ID;

  // Send video if configured
  if (welcomeVideoSource) {
    try {
      await sendWhatsAppVideoMessage(to, welcomeVideoSource);
    } catch (error) {
      console.error('Failed to send welcome video:', error);
      // Continue with text even if video fails
    }
  }

  // Send welcome text
  const welcomeText = `Merhaba! Turkiye'nin en buyuk lojistik yuk bulma platformuna hos geldiniz.

1 hafta boyunca tum ozellikleri UCRETSIZ kullanabilirsiniz!

Nasil kullanilir? Sehir adi yazarak yuk arayabilirsiniz. Ornegin: "istanbul ankara"`;

  await sendWhatsAppMessage(to, welcomeText);
}

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  };
}

// Turkish cities for detecting job search queries
const TURKISH_CITIES = [
  'istanbul', 'ankara', 'izmir', 'bursa', 'antalya', 'adana', 'konya',
  'gaziantep', 'mersin', 'diyarbakir', 'kayseri', 'eskisehir', 'samsun',
  'denizli', 'sanliurfa', 'adapazari', 'malatya', 'kahramanmaras', 'van',
  'erzurum', 'batman', 'elazig', 'manisa', 'sivas', 'gebze', 'balikesir',
  'trabzon', 'adiyaman', 'corlu', 'hatay', 'antakya', 'iskenderun', 'tarsus',
  'kocaeli', 'sakarya', 'tekirdag', 'edirne', 'mugla', 'aydin', 'kutahya',
  'zonguldak', 'usak', 'afyon', 'nigde', 'nevsehir', 'aksaray', 'karaman',
  'isparta', 'bolu', 'duzce', 'karabuk', 'bartin', 'kastamonu', 'cankiri',
  'corum', 'amasya', 'tokat', 'ordu', 'giresun', 'rize', 'artvin', 'ardahan',
  'kars', 'igdir', 'agri', 'mus', 'bitlis', 'siirt', 'sirnak', 'hakkari',
  'mardin', 'bingol', 'tunceli', 'yozgat', 'kirsehir', 'kirikkale'
];

// Vehicle types and logistics keywords
const LOGISTICS_KEYWORDS = [
  'tir', 'kamyon', 'kamyonet', 'frigorifik', 'frigo', 'damperli', 'damper',
  'tenteli', 'tente', 'kapali', 'yuk', 'sefer', 'is', 'ilan'
];

function isJobSearchQuery(text: string): boolean {
  const lower = text.toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');

  // Check if message contains any city name or logistics keyword
  return TURKISH_CITIES.some(city => lower.includes(city)) ||
         LOGISTICS_KEYWORDS.some(keyword => lower.includes(keyword));
}

// WhatsApp webhook verification (GET request)
function handleVerification(event: APIGatewayProxyEvent): APIGatewayProxyResult {
  const mode = event.queryStringParameters?.['hub.mode'];
  const token = event.queryStringParameters?.['hub.verify_token'];
  const challenge = event.queryStringParameters?.['hub.challenge'];

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'turkish-logistics-verify';

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('Webhook verified');
    return {
      statusCode: 200,
      body: challenge || '',
    };
  }

  return response(403, { error: 'Verification failed' });
}

// Extract message from WhatsApp webhook payload
interface WhatsAppMessage {
  from: string;
  text?: { body: string };
  type: string;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: WhatsAppMessage[];
        metadata?: {
          phone_number_id: string;
        };
      };
    }>;
  }>;
}

// Evolution API payload structure
interface EvolutionAPIPayload {
  event?: string;
  instance?: string;
  data?: {
    key?: {
      id?: string;
      remoteJid?: string;
      fromMe?: boolean;
      participant?: string;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
  };
}

function extractMessage(payload: WhatsAppWebhookPayload | EvolutionAPIPayload): { from: string; text: string; id: string } | null {
  try {
    // Try WhatsApp Business API format first
    const waPayload = payload as WhatsAppWebhookPayload;
    if (waPayload.object === 'whatsapp_business_account') {
      const message = waPayload.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (message && message.type === 'text' && message.text?.body) {
        return {
          from: message.from,
          text: message.text.body,
          id: (message as { id?: string }).id || `${message.from}-${Date.now()}`,
        };
      }
    }

    // Try Evolution API format
    const evoPayload = payload as EvolutionAPIPayload;
    if (evoPayload.event === 'messages.upsert' && evoPayload.data) {
      const data = evoPayload.data;
      // Skip messages from the bot itself
      if (data.key?.fromMe) {
        return null;
      }

      const text = data.message?.conversation || data.message?.extendedTextMessage?.text;
      if (!text) {
        return null;
      }

      // For personal chats, use remoteJid. For groups, use participant.
      const from = data.key?.participant?.replace('@s.whatsapp.net', '') ||
                   data.key?.remoteJid?.replace('@s.whatsapp.net', '') || '';

      return {
        from,
        text,
        id: data.key?.id || `${from}-${Date.now()}`,
      };
    }

    return null;
  } catch {
    return null;
  }
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log('Query handler invoked:', event.httpMethod);

  // Handle webhook verification
  if (event.httpMethod === 'GET') {
    return handleVerification(event);
  }

  // Handle incoming messages
  if (event.httpMethod !== 'POST') {
    return response(405, { error: 'Method not allowed' });
  }

  // Verify WhatsApp webhook signature
  if (!verifyWhatsAppSignature(event)) {
    return response(401, { error: 'Invalid signature' });
  }

  try {
    const payload = JSON.parse(event.body || '{}');

    // Extract message (supports both WhatsApp Business API and Evolution API formats)
    const message = extractMessage(payload);

    if (!message) {
      // No text message to process (could be status update, etc.)
      return response(200, { status: 'ignored' });
    }

    console.log(`Received message from ${message.from}: ${message.text.substring(0, 50)}...`);

    // Check for duplicate (WhatsApp may retry webhooks)
    if (await isDuplicateMessage(message.id)) {
      console.log(`Duplicate message ignored: ${message.id}`);
      return response(200, { status: 'duplicate_ignored' });
    }

    // Easter eggs
    if (message.text.toLowerCase().includes('yarrak')) {
      await sendWhatsAppMessage(message.from, 'xd');
      return response(200, { status: 'xd' });
    }

    if (message.text.toLowerCase().includes('sadettin okan')) {
      await sendWhatsAppMessage(message.from, 'gay');
      return response(200, { status: 'easter_egg' });
    }

    // === USER MANAGEMENT ===
    const store = getUserStore();
    const { user, isNewUser } = await store.getOrCreateUser(message.from);
    console.log(`User ${message.from}: isNewUser=${isNewUser}, status=${user.membershipStatus}`);

    // Send welcome message to new users
    if (isNewUser && !user.welcomeMessageSent) {
      try {
        await sendWelcomeMessage(message.from);
        await store.markWelcomeMessageSent(message.from);
        console.log(`Sent welcome message to new user: ${message.from}`);
      } catch (error) {
        console.error('Failed to send welcome message:', error);
        // Don't fail the request if welcome message fails
      }
    }

    // Check if user can view phone numbers
    const canViewPhones = store.isFreeTierActive(user);

    // Only send "bakiyorum" if it looks like a job search (contains city names)
    if (isJobSearchQuery(message.text)) {
      await sendWhatsAppMessage(message.from, 'bakiyorum');
    }

    // Process with agent
    const agentInstance = getAgent();
    const result = await agentInstance.processMessage(message.from, message.text);

    console.log(`Agent response: ${result.message.substring(0, 100)}...`);

    // Apply phone masking for expired users
    let responseText = result.message;
    if (!canViewPhones) {
      responseText = maskPhoneNumbersInText(responseText);
      responseText += '\n\n(Telefon numaralarini gormek icin uyelik alin)';
      console.log(`Masked phone numbers for expired user: ${message.from}`);
    }

    // Send response
    await sendWhatsAppMessage(message.from, responseText);

    return response(200, {
      status: 'processed',
      jobsFound: result.jobIds.length,
      isNewUser,
      canViewPhones,
    });

  } catch (error) {
    console.error('Error processing query:', error);

    // Try to send error message to user
    try {
      const payload = JSON.parse(event.body || '{}');
      const message = extractMessage(payload);
      if (message) {
        await sendWhatsAppMessage(
          message.from,
          'Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.'
        );
      }
    } catch {
      // Ignore send error
    }

    return response(500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
