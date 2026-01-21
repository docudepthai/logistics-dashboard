import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  index,
} from 'drizzle-orm/pg-core';

/**
 * Contacts table - deduplicated contacts from messages
 */
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Phone number (primary identifier)
    phoneNormalized: text('phone_normalized').notNull().unique(),
    phoneDisplay: text('phone_display'),

    // Contact names (may vary across messages)
    primaryName: text('primary_name'),
    allNames: text('all_names').array(),

    // Activity metrics
    messageCount: integer('message_count').default(0).notNull(),
    jobCount: integer('job_count').default(0).notNull(),

    // First/last seen
    firstSeen: timestamp('first_seen', { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeen: timestamp('last_seen', { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    phoneIdx: index('contacts_phone_idx').on(table.phoneNormalized),
    lastSeenIdx: index('contacts_last_seen_idx').on(table.lastSeen),
  })
);

export type ContactInsert = typeof contacts.$inferInsert;
export type ContactSelect = typeof contacts.$inferSelect;
