"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerFavorites = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.ledgerFavorites = (0, sqlite_core_1.sqliteTable)('ledger_favorites', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    type: (0, sqlite_core_1.text)('type').notNull(),
    amount: (0, sqlite_core_1.real)('amount').notNull().default(0),
    category: (0, sqlite_core_1.text)('category').notNull().default(''),
    subCategory: (0, sqlite_core_1.text)('sub_category').notNull().default(''),
    associatedParty: (0, sqlite_core_1.text)('associated_party').notNull().default(''),
    ownerName: (0, sqlite_core_1.text)('owner_name'),
    description: (0, sqlite_core_1.text)('description'),
    immediateSettlement: (0, sqlite_core_1.integer)('immediate_settlement', { mode: 'boolean' }).default(false),
    usageCount: (0, sqlite_core_1.integer)('usage_count').notNull().default(0),
    lastUsedAt: (0, sqlite_core_1.text)('last_used_at'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('fav_profile_idx').on(table.profileId),
}));
