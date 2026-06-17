import { sqliteTable, text, real, index } from 'drizzle-orm/sqlite-core';

export const clients = sqliteTable('clients', {
  id:        text('id').primaryKey(),
  profileId: text('profile_id').notNull(),
  name:      text('name').notNull(),
  phone:     text('phone').notNull().default(''),
  email:     text('email').notNull().default(''),
  address:   text('address').notNull().default(''),
  balance:   real('balance').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('cli_profile_idx').on(table.profileId),
  nameIdx:    index('cli_name_idx').on(table.name),
}));
