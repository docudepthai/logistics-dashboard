import { eq, desc, sql, and } from 'drizzle-orm';
import type { Database } from '../client.js';
import {
  rawMessages,
  type RawMessageInsert,
  type RawMessageSelect,
} from '../schema/index.js';

/**
 * Insert a new raw message
 */
export async function insertRawMessage(
  db: Database,
  message: RawMessageInsert
): Promise<RawMessageSelect> {
  const [result] = await db.insert(rawMessages).values(message).returning();
  return result!;
}

/**
 * Get raw message by message ID
 */
export async function getRawMessageByMessageId(
  db: Database,
  messageId: string
): Promise<RawMessageSelect | undefined> {
  const [result] = await db
    .select()
    .from(rawMessages)
    .where(eq(rawMessages.messageId, messageId))
    .limit(1);
  return result;
}

/**
 * Check if a raw message exists by message ID
 */
export async function rawMessageExists(
  db: Database,
  messageId: string
): Promise<boolean> {
  const [result] = await db
    .select({ count: sql<number>`count(*)` })
    .from(rawMessages)
    .where(eq(rawMessages.messageId, messageId));
  return (result?.count ?? 0) > 0;
}

/**
 * Get unprocessed messages
 */
export async function getUnprocessedMessages(
  db: Database,
  limit = 100
): Promise<RawMessageSelect[]> {
  return db
    .select()
    .from(rawMessages)
    .where(eq(rawMessages.isProcessed, false))
    .orderBy(rawMessages.receivedAt)
    .limit(limit);
}

/**
 * Mark a message as processed
 */
export async function markMessageProcessed(
  db: Database,
  messageId: string,
  error?: string
): Promise<void> {
  await db
    .update(rawMessages)
    .set({
      isProcessed: true,
      processedAt: new Date(),
      processingError: error,
    })
    .where(eq(rawMessages.messageId, messageId));
}

/**
 * Get message processing statistics
 */
export async function getMessageStats(db: Database): Promise<{
  totalMessages: number;
  processedMessages: number;
  failedMessages: number;
  pendingMessages: number;
}> {
  const [stats] = await db
    .select({
      totalMessages: sql<number>`count(*)`,
      processedMessages: sql<number>`sum(case when ${rawMessages.isProcessed} and ${rawMessages.processingError} is null then 1 else 0 end)`,
      failedMessages: sql<number>`sum(case when ${rawMessages.processingError} is not null then 1 else 0 end)`,
      pendingMessages: sql<number>`sum(case when not ${rawMessages.isProcessed} then 1 else 0 end)`,
    })
    .from(rawMessages);

  return {
    totalMessages: stats?.totalMessages ?? 0,
    processedMessages: stats?.processedMessages ?? 0,
    failedMessages: stats?.failedMessages ?? 0,
    pendingMessages: stats?.pendingMessages ?? 0,
  };
}
