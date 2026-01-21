import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Source groups table - tracks WhatsApp groups being monitored
 */
export const sourceGroups = pgTable(
  'source_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // WhatsApp identifier
    jid: text('jid').notNull().unique(),
    displayName: text('display_name'),

    // Status
    isActive: boolean('is_active').default(true).notNull(),
    isMonitored: boolean('is_monitored').default(true).notNull(),

    // Statistics
    messageCount: integer('message_count').default(0).notNull(),
    jobCount: integer('job_count').default(0).notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    jidIdx: index('source_groups_jid_idx').on(table.jid),
    isActiveIdx: index('source_groups_is_active_idx').on(table.isActive),
    isMonitoredIdx: index('source_groups_is_monitored_idx').on(
      table.isMonitored
    ),
  })
);

export type SourceGroupInsert = typeof sourceGroups.$inferInsert;
export type SourceGroupSelect = typeof sourceGroups.$inferSelect;
