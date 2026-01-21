import { pgTable, text, integer, uuid, index } from 'drizzle-orm/pg-core';

/**
 * Provinces reference table - all 81 Turkish provinces
 */
export const provinces = pgTable('provinces', {
  code: integer('code').primaryKey(),
  name: text('name').notNull(),
  normalized: text('normalized').notNull(),
  region: text('region').notNull(),
});

export type ProvinceInsert = typeof provinces.$inferInsert;
export type ProvinceSelect = typeof provinces.$inferSelect;

/**
 * Districts reference table - major districts mapped to provinces
 */
export const districts = pgTable(
  'districts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    normalized: text('normalized').notNull(),
    provinceCode: integer('province_code')
      .notNull()
      .references(() => provinces.code),
    isLogisticsHub: integer('is_logistics_hub').default(0).notNull(),
  },
  (table) => ({
    provinceCodeIdx: index('districts_province_code_idx').on(
      table.provinceCode
    ),
    normalizedIdx: index('districts_normalized_idx').on(table.normalized),
  })
);

export type DistrictInsert = typeof districts.$inferInsert;
export type DistrictSelect = typeof districts.$inferSelect;
