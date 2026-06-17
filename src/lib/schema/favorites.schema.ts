import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const ledgerFavorites = sqliteTable('ledger_favorites', {
  id:                   text('id').primaryKey(),
  profileId:            text('profile_id').notNull(),
  name:                 text('name').notNull(),
  type:                 text('type').notNull(),
  amount:               real('amount').notNull().default(0),
  category:             text('category').notNull().default(''),
  subCategory:          text('sub_category').notNull().default(''),
  associatedParty:      text('associated_party').notNull().default(''),
  ownerName:            text('owner_name'),
  description:          text('description'),
  immediateSettlement:  integer('immediate_settlement', { mode: 'boolean' }).default(false),
  usageCount:           integer('usage_count').notNull().default(0),
  lastUsedAt:           text('last_used_at'),
  createdAt:            text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('fav_profile_idx').on(table.profileId),
}));
