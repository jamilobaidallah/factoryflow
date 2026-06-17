import { sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const activityLogs = sqliteTable('activity_logs', {
  id:              text('id').primaryKey(),
  profileId:       text('profile_id').notNull(),
  userId:          text('user_id').notNull().default('local'),
  userEmail:       text('user_email').notNull().default('local'),
  userDisplayName: text('user_display_name'),
  action:          text('action').notNull(),   // 'create' | 'update' | 'delete' | 'approve' | 'reject' | ...
  module:          text('module').notNull(),   // 'ledger' | 'clients' | 'payments' | ...
  targetId:        text('target_id'),
  description:     text('description').notNull(),
  metadata:        text('metadata'),           // JSON: Record<string, unknown>
  createdAt:       text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('al_profile_idx').on(table.profileId),
  moduleIdx:  index('al_module_idx').on(table.module),
  dateIdx:    index('al_date_idx').on(table.createdAt),
}));
