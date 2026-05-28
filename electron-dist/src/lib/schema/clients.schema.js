"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clients = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.clients = (0, sqlite_core_1.sqliteTable)('clients', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    phone: (0, sqlite_core_1.text)('phone').notNull().default(''),
    email: (0, sqlite_core_1.text)('email').notNull().default(''),
    address: (0, sqlite_core_1.text)('address').notNull().default(''),
    balance: (0, sqlite_core_1.real)('balance').notNull().default(0),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('cli_profile_idx').on(table.profileId),
    nameIdx: (0, sqlite_core_1.index)('cli_name_idx').on(table.name),
}));
