"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chartOfAccounts = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.chartOfAccounts = (0, sqlite_core_1.sqliteTable)('chart_of_accounts', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    code: (0, sqlite_core_1.text)('code').notNull(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    nameAr: (0, sqlite_core_1.text)('name_ar').notNull(),
    type: (0, sqlite_core_1.text)('type').notNull(), // 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
    normalBalance: (0, sqlite_core_1.text)('normal_balance').notNull(), // 'debit' | 'credit'
    isActive: (0, sqlite_core_1.integer)('is_active', { mode: 'boolean' }).notNull().default(true),
    isSystemAccount: (0, sqlite_core_1.integer)('is_system_account', { mode: 'boolean' }).default(false),
    isContraAccount: (0, sqlite_core_1.integer)('is_contra_account', { mode: 'boolean' }).default(false),
    parentCode: (0, sqlite_core_1.text)('parent_code'),
    description: (0, sqlite_core_1.text)('description'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
    updatedAt: (0, sqlite_core_1.text)('updated_at'),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('coa_profile_idx').on(table.profileId),
    // Each account code must be unique within a profile
    uniqueCode: (0, sqlite_core_1.unique)('coa_unique_code').on(table.profileId, table.code),
}));
