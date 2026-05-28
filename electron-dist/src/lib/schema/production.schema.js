"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productionOrders = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.productionOrders = (0, sqlite_core_1.sqliteTable)('production_orders', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    orderNumber: (0, sqlite_core_1.text)('order_number').notNull(),
    date: (0, sqlite_core_1.text)('date').notNull(),
    // Input — raw material consumed
    inputItemId: (0, sqlite_core_1.text)('input_item_id').notNull(),
    inputItemName: (0, sqlite_core_1.text)('input_item_name').notNull(),
    inputQuantity: (0, sqlite_core_1.real)('input_quantity').notNull(),
    inputThickness: (0, sqlite_core_1.real)('input_thickness'),
    inputWidth: (0, sqlite_core_1.real)('input_width'),
    inputLength: (0, sqlite_core_1.real)('input_length'),
    // Output — finished product
    outputItemName: (0, sqlite_core_1.text)('output_item_name').notNull(),
    outputQuantity: (0, sqlite_core_1.real)('output_quantity').notNull(),
    outputThickness: (0, sqlite_core_1.real)('output_thickness'),
    outputWidth: (0, sqlite_core_1.real)('output_width'),
    outputLength: (0, sqlite_core_1.real)('output_length'),
    unit: (0, sqlite_core_1.text)('unit').notNull().default(''),
    productionExpenses: (0, sqlite_core_1.real)('production_expenses').notNull().default(0),
    status: (0, sqlite_core_1.text)('status').notNull().default('قيد التنفيذ'),
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
    completedAt: (0, sqlite_core_1.text)('completed_at'),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('po_profile_idx').on(table.profileId),
    statusIdx: (0, sqlite_core_1.index)('po_status_idx').on(table.status),
}));
