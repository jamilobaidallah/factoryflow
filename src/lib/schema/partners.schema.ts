import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const partners = sqliteTable('partners', {
  id:                   text('id').primaryKey(),
  profileId:            text('profile_id').notNull(),
  name:                 text('name').notNull(),
  ownershipPercentage:  real('ownership_percentage').notNull().default(0),
  phone:                text('phone').notNull().default(''),
  email:                text('email').notNull().default(''),
  initialInvestment:    real('initial_investment').notNull().default(0),
  joinDate:             text('join_date').notNull(),         // UTC ISO string
  active:               integer('active', { mode: 'boolean' }).notNull().default(true),

  // Equity accounts (assigned by migration or on partner creation)
  capitalAccountCode:   text('capital_account_code'),
  drawingsAccountCode:  text('drawings_account_code'),

  createdAt:            text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('par_profile_idx').on(table.profileId),
}));
