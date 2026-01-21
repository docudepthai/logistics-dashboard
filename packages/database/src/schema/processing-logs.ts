import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
  jsonb,
  pgEnum,
} from 'drizzle-orm/pg-core';

/**
 * Processing status enum
 */
export const processingStatusEnum = pgEnum('processing_status', [
  'received',
  'queued',
  'processing',
  'parsed',
  'stored',
  'failed',
  'skipped',
]);

/**
 * Processing logs table - audit trail for message processing
 */
export const processingLogs = pgTable(
  'processing_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Reference
    rawMessageId: uuid('raw_message_id').notNull(),
    messageId: text('message_id'),

    // Status
    status: processingStatusEnum('status').notNull(),
    stage: text('stage').notNull(),

    // Error details
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),

    // Performance
    durationMs: integer('duration_ms'),

    // Context
    metadata: jsonb('metadata'),
    lambdaRequestId: text('lambda_request_id'),

    // Timestamp
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    rawMessageIdIdx: index('processing_logs_raw_message_id_idx').on(
      table.rawMessageId
    ),
    statusIdx: index('processing_logs_status_idx').on(table.status),
    createdAtIdx: index('processing_logs_created_at_idx').on(table.createdAt),
  })
);

export type ProcessingLogInsert = typeof processingLogs.$inferInsert;
export type ProcessingLogSelect = typeof processingLogs.$inferSelect;
