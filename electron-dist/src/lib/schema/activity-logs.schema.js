"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityLogs = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.activityLogs = (0, sqlite_core_1.sqliteTable)('activity_logs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    userId: (0, sqlite_core_1.text)('user_id').notNull().default('local'),
    userEmail: (0, sqlite_core_1.text)('user_email').notNull().default('local'),
    userDisplayName: (0, sqlite_core_1.text)('user_display_name'),
    action: (0, sqlite_core_1.text)('action').notNull(), // 'create' | 'update' | 'delete' | 'approve' | 'reject' | ...
    module: (0, sqlite_core_1.text)('module').notNull(), // 'ledger' | 'clients' | 'payments' | ...
    targetId: (0, sqlite_core_1.text)('target_id'),
    description: (0, sqlite_core_1.text)('description').notNull(),
    metadata: (0, sqlite_core_1.text)('metadata'), // JSON: Record<string, unknown>
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('al_profile_idx').on(table.profileId),
    moduleIdx: (0, sqlite_core_1.index)('al_module_idx').on(table.module),
    dateIdx: (0, sqlite_core_1.index)('al_date_idx').on(table.createdAt),
}));
