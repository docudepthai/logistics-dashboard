import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  decimal,
  boolean,
  index,
  jsonb,
} from 'drizzle-orm/pg-core';
import { rawMessages } from './messages.js';

/**
 * Jobs table - stores parsed logistics job postings
 */
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Reference to raw message
    messageId: text('message_id')
      .notNull()
      .unique()
      .references(() => rawMessages.messageId),
    sourceGroupJid: text('source_group_jid').notNull(),
    rawText: text('raw_text').notNull(),

    // Origin location
    originMentioned: text('origin_mentioned'),
    originProvince: text('origin_province'),
    originProvinceCode: integer('origin_province_code'),
    originDistrict: text('origin_district'),

    // Destination location
    destinationMentioned: text('destination_mentioned'),
    destinationProvince: text('destination_province'),
    destinationProvinceCode: integer('destination_province_code'),
    destinationDistrict: text('destination_district'),

    // Vehicle information
    vehicleType: text('vehicle_type'),
    bodyType: text('body_type'),
    isRefrigerated: boolean('is_refrigerated').default(false).notNull(),

    // Contact information
    contactPhone: text('contact_phone'),
    contactPhoneNormalized: text('contact_phone_normalized'),
    contactName: text('contact_name'),

    // Sender information (from WhatsApp - for ML training)
    senderJid: text('sender_jid'),
    senderPhone: text('sender_phone'),

    // Cargo details
    weight: decimal('weight', { precision: 10, scale: 2 }),
    weightUnit: text('weight_unit').default('ton'),
    cargoType: text('cargo_type'),
    loadType: text('load_type'), // FTL or LTL (parsiyel)

    // Urgency
    isUrgent: boolean('is_urgent').default(false).notNull(),

    // Parsing metadata
    confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
    confidenceLevel: text('confidence_level'),
    parsedFields: jsonb('parsed_fields'),

    // All routes extracted from multi-route messages
    // Format: [{origin: "Kayseri", destination: "Istanbul", vehicle?: "TIR"}, ...]
    routes: jsonb('routes').$type<Array<{
      origin: string;
      destination: string;
      originCode?: number;
      destinationCode?: number;
      vehicle?: string;
      bodyType?: string;
    }>>(),

    // Status and timestamps
    messageType: text('message_type'),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => ({
    messageIdIdx: index('jobs_message_id_idx').on(table.messageId),
    sourceGroupIdx: index('jobs_source_group_idx').on(table.sourceGroupJid),
    originProvinceIdx: index('jobs_origin_province_idx').on(
      table.originProvince
    ),
    destProvinceIdx: index('jobs_dest_province_idx').on(
      table.destinationProvince
    ),
    routeIdx: index('jobs_route_idx').on(
      table.originProvince,
      table.destinationProvince
    ),
    vehicleTypeIdx: index('jobs_vehicle_type_idx').on(table.vehicleType),
    postedAtIdx: index('jobs_posted_at_idx').on(table.postedAt),
    isActiveIdx: index('jobs_is_active_idx').on(table.isActive),
    contactPhoneIdx: index('jobs_contact_phone_idx').on(
      table.contactPhoneNormalized
    ),
    // GIN index for efficient JSONB routes querying
    routesIdx: index('jobs_routes_idx').using('gin', table.routes),
  })
);

export type JobInsert = typeof jobs.$inferInsert;
export type JobSelect = typeof jobs.$inferSelect;
