/**
 * Fix existing users who haven't searched yet
 * - For users who have searched (lastOrigin in context), set trialStartedAt to their first search time
 * - For users who haven't searched, remove freeTierExpiresAt so trial doesn't start
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamoClient = new DynamoDBClient({ region: 'eu-central-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);
const TABLE_NAME = process.env.CONVERSATIONS_TABLE || 'turkish-logistics-conversations';

interface UserProfile {
  pk: string;
  sk: string;
  phoneNumber: string;
  membershipStatus: string;
  freeTierExpiresAt?: string;
  trialStartedAt?: string;
  createdAt: string;
}

interface ConversationContext {
  lastOrigin?: string;
  lastSearched?: string;
}

async function getUserConversationContext(phoneNumber: string): Promise<ConversationContext | null> {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { pk: `USER#${phoneNumber}`, sk: 'CONVERSATION' },
  }));

  if (!result.Item) return null;

  return {
    lastOrigin: result.Item.context?.lastOrigin,
    lastSearched: result.Item.context?.lastSearched,
  };
}

async function fixUserTrial(user: UserProfile): Promise<{ action: string; phone: string }> {
  const phoneNumber = user.phoneNumber;

  // Skip premium users
  if (user.membershipStatus === 'premium') {
    return { action: 'skipped_premium', phone: phoneNumber };
  }

  // Already has trialStartedAt set - skip
  if (user.trialStartedAt) {
    return { action: 'already_set', phone: phoneNumber };
  }

  // Check if user has searched by looking at conversation context
  const context = await getUserConversationContext(phoneNumber);
  const hasSearched = !!(context?.lastOrigin);

  if (hasSearched) {
    // User has searched - set trialStartedAt to their createdAt date (approximate first search)
    // The freeTierExpiresAt should already be set correctly
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${phoneNumber}`, sk: 'PROFILE' },
      UpdateExpression: 'SET trialStartedAt = :started',
      ExpressionAttributeValues: {
        ':started': user.createdAt, // Use createdAt as approximate first search time
      },
    }));
    return { action: 'set_trial_started', phone: phoneNumber };
  } else {
    // User hasn't searched - remove freeTierExpiresAt so trial doesn't start
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `USER#${phoneNumber}`, sk: 'PROFILE' },
      UpdateExpression: 'REMOVE freeTierExpiresAt',
    }));
    return { action: 'removed_expiration', phone: phoneNumber };
  }
}

async function main() {
  console.log('Fixing user trial status...\n');

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let totalUsers = 0;
  const results: Record<string, number> = {
    skipped_premium: 0,
    already_set: 0,
    set_trial_started: 0,
    removed_expiration: 0,
    error: 0,
  };

  do {
    const scanResult = await docClient.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'sk = :sk',
      ExpressionAttributeValues: { ':sk': 'PROFILE' },
      ExclusiveStartKey: lastEvaluatedKey,
    }));

    for (const item of scanResult.Items || []) {
      totalUsers++;
      try {
        const result = await fixUserTrial(item as UserProfile);
        results[result.action]++;
        if (result.action !== 'skipped_premium' && result.action !== 'already_set') {
          console.log(`[${result.action}] ${result.phone}`);
        }
      } catch (error) {
        console.error(`Error processing ${item.phoneNumber}:`, error);
        results.error++;
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  console.log('\n=== Summary ===');
  console.log(`Total users: ${totalUsers}`);
  console.log(`Premium (skipped): ${results.skipped_premium}`);
  console.log(`Already has trialStartedAt: ${results.already_set}`);
  console.log(`Set trialStartedAt (has searched): ${results.set_trial_started}`);
  console.log(`Removed expiration (hasn't searched): ${results.removed_expiration}`);
  console.log(`Errors: ${results.error}`);
}

main().catch(console.error);
