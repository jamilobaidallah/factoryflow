import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';

export const chartOfAccounts = sqliteTable('chart_of_accounts', {
  id:               text('id').primaryKey(),
  profileId:        text('profile_id').notNull(),
  code:             text('code').notNull(),
  name:             text('name').notNull(),
  nameAr:           text('name_ar').notNull(),
  type:             text('type').notNull(),   // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
  normalBalance:    text('normal_balance').notNull(), // 'debit' | 'credit'
  isActive:         integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isSystemAccount:  integer('is_system_account', { mode: 'boolean' }).default(false),
  isContraAccount:  integer('is_contra_account', { mode: 'boolean' }).default(false),
  parentCode:       text('parent_code'),
  description:      text('description'),
  createdAt:        text('created_at').notNull(),
  updatedAt:        text('updated_at'),
}, (table) => ({
  profileIdx:  index('coa_profile_idx').on(table.profileId),
  // Each account code must be unique within a profile
  uniqueCode:  unique('coa_unique_code').on(table.profileId, table.code),
}));
