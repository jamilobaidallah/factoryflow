"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inventoryMovements = exports.inventory = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.inventory = (0, sqlite_core_1.sqliteTable)('inventory', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    itemName: (0, sqlite_core_1.text)('item_name').notNull(),
    category: (0, sqlite_core_1.text)('category').notNull().default(''),
    subCategory: (0, sqlite_core_1.text)('sub_category'),
    quantity: (0, sqlite_core_1.real)('quantity').notNull().default(0),
    unit: (0, sqlite_core_1.text)('unit').notNull().default(''),
    unitPrice: (0, sqlite_core_1.real)('unit_price').notNull().default(0),
    minStock: (0, sqlite_core_1.real)('min_stock').notNull().default(0),
    location: (0, sqlite_core_1.text)('location').notNull().default(''),
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    // Physical dimensions
    thickness: (0, sqlite_core_1.real)('thickness'),
    width: (0, sqlite_core_1.real)('width'),
    length: (0, sqlite_core_1.real)('length'),
    // Weighted average cost
    lastPurchasePrice: (0, sqlite_core_1.real)('last_purchase_price'),
    lastPurchaseDate: (0, sqlite_core_1.text)('last_purchase_date'),
    lastPurchaseAmount: (0, sqlite_core_1.real)('last_purchase_amount'),
    // Sub-inventory account code
    inventoryAccountCode: (0, sqlite_core_1.text)('inventory_account_code').default('1300'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('inv_profile_idx').on(table.profileId),
}));
exports.inventoryMovements = (0, sqlite_core_1.sqliteTable)('inventory_movements', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    itemId: (0, sqlite_core_1.text)('item_id').notNull().references(() => exports.inventory.id),
    itemName: (0, sqlite_core_1.text)('item_name').notNull(), // denormalised
    type: (0, sqlite_core_1.text)('type').notNull(), // "دخول" | "خروج"
    quantity: (0, sqlite_core_1.real)('quantity').notNull(),
    unit: (0, sqlite_core_1.text)('unit'),
    linkedTransactionId: (0, sqlite_core_1.text)('linked_transaction_id'),
    notes: (0, sqlite_core_1.text)('notes'),
    userEmail: (0, sqlite_core_1.text)('user_email'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('im_profile_idx').on(table.profileId),
    itemIdx: (0, sqlite_core_1.index)('im_item_idx').on(table.itemId),
}));
