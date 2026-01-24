/**
 * Migration script to populate user preferences from existing conversation history.
 *
 * Run with: npx ts-node scripts/migrate-user-preferences.ts
 *
 * This script:
 * 1. Scans all conversations in DynamoDB
 * 2. Analyzes user messages to extract search patterns
 * 3. Populates frequentRoutes, totalSearches, firstSeen
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const REGION = 'eu-central-1';
const TABLE_NAME = 'turkish-logistics-conversations';

// Turkish provinces (simplified list for pattern matching)
const PROVINCES = new Set([
  'adana', 'adiyaman', 'afyon', 'afyonkarahisar', 'agri', 'aksaray', 'amasya', 'ankara', 'antalya', 'ardahan',
  'artvin', 'aydin', 'balikesir', 'bartin', 'batman', 'bayburt', 'bilecik', 'bingol', 'bitlis', 'bolu',
  'burdur', 'bursa', 'canakkale', 'cankiri', 'corum', 'denizli', 'diyarbakir', 'duzce', 'edirne', 'elazig',
  'erzincan', 'erzurum', 'eskisehir', 'gaziantep', 'giresun', 'gumushane', 'hakkari', 'hatay', 'igdir', 'isparta',
  'istanbul', 'izmir', 'kahramanmaras', 'karabuk', 'karaman', 'kars', 'kastamonu', 'kayseri', 'kilis', 'kirikkale',
  'kirklareli', 'kirsehir', 'kocaeli', 'konya', 'kutahya', 'malatya', 'manisa', 'mardin', 'mersin', 'mugla',
  'mus', 'nevsehir', 'nigde', 'ordu', 'osmaniye', 'rize', 'sakarya', 'samsun', 'sanliurfa', 'siirt',
  'sinop', 'sirnak', 'sivas', 'tekirdag', 'tokat', 'trabzon', 'tunceli', 'usak', 'van', 'yalova', 'yozgat', 'zonguldak',
  // Common variations
  'ist', 'ank', 'izm', 'antep', 'urfa', 'gebze', 'corlu', 'tuzla', 'hadimkoy', 'esenyurt',
]);

interface FrequentRoute {
  origin: string;
  destination?: string;
  count: number;
  lastSearched: string;
}

interface Message {
  role: string;
  content: string;
  timestamp?: string;
}

function normalizeToAscii(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c');
}

function extractLocationsFromMessage(message: string): { origin?: string; destination?: string } {
  const normalized = normalizeToAscii(message.toLowerCase());
  const words = normalized.split(/[\s\-\>→➡]+/).filter(w => w.length > 2);

  const foundLocations: string[] = [];

  for (const word of words) {
    // Strip common Turkish suffixes
    const stripped = word
      .replace(/(dan|den|tan|ten|ndan|nden)$/i, '')
      .replace(/(a|e|ya|ye|na|ne)$/i, '');

    if (PROVINCES.has(word) || PROVINCES.has(stripped)) {
      foundLocations.push(stripped || word);
    }
  }

  if (foundLocations.length === 0) return {};
  if (foundLocations.length === 1) return { origin: foundLocations[0] };
  return { origin: foundLocations[0], destination: foundLocations[1] };
}

function analyzeConversation(messages: Message[]): {
  frequentRoutes: FrequentRoute[];
  totalSearches: number;
  firstSeen?: string;
} {
  const routeMap = new Map<string, FrequentRoute>();
  let totalSearches = 0;
  let firstSeen: string | undefined;

  for (const msg of messages) {
    if (msg.role !== 'user') continue;

    // Track first seen
    if (msg.timestamp && (!firstSeen || msg.timestamp < firstSeen)) {
      firstSeen = msg.timestamp;
    }

    const { origin, destination } = extractLocationsFromMessage(msg.content);

    if (origin) {
      totalSearches++;
      const key = destination ? `${origin}-${destination}` : origin;

      const existing = routeMap.get(key);
      if (existing) {
        existing.count++;
        if (msg.timestamp && msg.timestamp > existing.lastSearched) {
          existing.lastSearched = msg.timestamp;
        }
      } else {
        routeMap.set(key, {
          origin,
          destination,
          count: 1,
          lastSearched: msg.timestamp || new Date().toISOString(),
        });
      }
    }
  }

  // Sort by count and take top 10
  const frequentRoutes = Array.from(routeMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { frequentRoutes, totalSearches, firstSeen };
}

async function migrateUsers() {
  const client = new DynamoDBClient({ region: REGION });
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log('Starting user preference migration...');

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let totalUsers = 0;
  let migratedUsers = 0;

  do {
    const scanResult = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: 'sk = :sk',
        ExpressionAttributeValues: { ':sk': 'CONVERSATION' },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = scanResult.Items || [];
    totalUsers += items.length;

    for (const item of items) {
      const pk = item.pk as string;
      const messages = (item.messages || []) as Message[];
      const existingContext = (item.context || {}) as Record<string, unknown>;

      // Skip if already has frequentRoutes
      if (existingContext.frequentRoutes && (existingContext.frequentRoutes as FrequentRoute[]).length > 0) {
        console.log(`  Skipping ${pk} - already has preferences`);
        continue;
      }

      const { frequentRoutes, totalSearches, firstSeen } = analyzeConversation(messages);

      if (frequentRoutes.length === 0) {
        console.log(`  Skipping ${pk} - no search history found`);
        continue;
      }

      // Update the conversation with learned preferences
      await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk, sk: 'CONVERSATION' },
          UpdateExpression: 'SET #ctx.frequentRoutes = :routes, #ctx.totalSearches = :total, #ctx.firstSeen = :first',
          ExpressionAttributeNames: { '#ctx': 'context' },
          ExpressionAttributeValues: {
            ':routes': frequentRoutes,
            ':total': totalSearches,
            ':first': firstSeen || item.createdAt || new Date().toISOString(),
          },
        })
      );

      migratedUsers++;
      console.log(`  Migrated ${pk}: ${frequentRoutes.length} routes, ${totalSearches} searches`);
      if (frequentRoutes[0]) {
        const topRoute = frequentRoutes[0];
        console.log(`    Top route: ${topRoute.origin}${topRoute.destination ? ' → ' + topRoute.destination : ''} (${topRoute.count}x)`);
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log(`\nMigration complete!`);
  console.log(`  Total users scanned: ${totalUsers}`);
  console.log(`  Users migrated: ${migratedUsers}`);
}

// Run migration
migrateUsers().catch(console.error);
