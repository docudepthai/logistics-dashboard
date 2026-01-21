import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';

/**
 * Raw messages table - stores all incoming webhook messages
 */
export const rawMessages = pgTable(
  'raw_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Evolution API identifiers
    messageId: text('message_id').notNull().unique(),
    instanceName: text('instance_name').notNull(),
    remoteJid: text('remote_jid').notNull(),
    senderJid: text('sender_jid'),

    // Message content
    messageType: text('message_type').notNull(),
    content: text('content'),
    rawPayload: jsonb('raw_payload').notNull(),

    // S3 storage reference
    s3Bucket: text('s3_bucket').notNull(),
    s3Key: text('s3_key').notNull(),

    // Processing state
    isProcessed: boolean('is_processed').default(false).notNull(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    processingError: text('processing_error'),

    // Timestamps
    receivedAt: timestamp('received_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    messageTimestamp: timestamp('message_timestamp', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    messageIdIdx: index('raw_messages_message_id_idx').on(table.messageId),
    remoteJidIdx: index('raw_messages_remote_jid_idx').on(table.remoteJid),
    processedIdx: index('raw_messages_processed_idx').on(table.isProcessed),
    receivedAtIdx: index('raw_messages_received_at_idx').on(table.receivedAt),
  })
);

export type RawMessageInsert = typeof rawMessages.$inferInsert;
export type RawMessageSelect = typeof rawMessages.$inferSelect;
