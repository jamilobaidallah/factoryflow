"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.partners = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.partners = (0, sqlite_core_1.sqliteTable)('partners', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    ownershipPercentage: (0, sqlite_core_1.real)('ownership_percentage').notNull().default(0),
    phone: (0, sqlite_core_1.text)('phone').notNull().default(''),
    email: (0, sqlite_core_1.text)('email').notNull().default(''),
    initialInvestment: (0, sqlite_core_1.real)('initial_investment').notNull().default(0),
    joinDate: (0, sqlite_core_1.text)('join_date').notNull(), // UTC ISO string
    active: (0, sqlite_core_1.integer)('active', { mode: 'boolean' }).notNull().default(true),
    // Equity accounts (assigned by migration or on partner creation)
    capitalAccountCode: (0, sqlite_core_1.text)('capital_account_code'),
    drawingsAccountCode: (0, sqlite_core_1.text)('drawings_account_code'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('par_profile_idx').on(table.profileId),
}));
