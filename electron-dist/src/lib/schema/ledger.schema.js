"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledger = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.ledger = (0, sqlite_core_1.sqliteTable)('ledger', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    transactionId: (0, sqlite_core_1.text)('transaction_id').notNull().unique(),
    description: (0, sqlite_core_1.text)('description').notNull().default(''),
    type: (0, sqlite_core_1.text)('type').notNull(), // "دخل" | "مصروف" | "حركة رأس مال" | "مردود"
    amount: (0, sqlite_core_1.real)('amount').notNull().default(0),
    category: (0, sqlite_core_1.text)('category').notNull().default(''),
    subCategory: (0, sqlite_core_1.text)('sub_category').notNull().default(''),
    associatedParty: (0, sqlite_core_1.text)('associated_party').notNull().default(''),
    ownerName: (0, sqlite_core_1.text)('owner_name'),
    date: (0, sqlite_core_1.text)('date').notNull(), // UTC ISO string
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(), // UTC ISO string
    // AR/AP tracking
    totalPaid: (0, sqlite_core_1.real)('total_paid').default(0),
    remainingBalance: (0, sqlite_core_1.real)('remaining_balance').default(0),
    paymentStatus: (0, sqlite_core_1.text)('payment_status'), // 'paid' | 'unpaid' | 'partial'
    isARAPEntry: (0, sqlite_core_1.integer)('is_arap_entry', { mode: 'boolean' }).default(false),
    // Settlement discount
    totalDiscount: (0, sqlite_core_1.real)('total_discount').default(0),
    // Bad debt write-off
    writeoffAmount: (0, sqlite_core_1.real)('writeoff_amount').default(0),
    writeoffReason: (0, sqlite_core_1.text)('writeoff_reason'),
    writeoffDate: (0, sqlite_core_1.text)('writeoff_date'),
    writeoffBy: (0, sqlite_core_1.text)('writeoff_by'),
    // Immediate cash settlement
    immediateSettlement: (0, sqlite_core_1.integer)('immediate_settlement', { mode: 'boolean' }).default(false),
    // Advance payments — stored as JSON array
    paidFromAdvances: (0, sqlite_core_1.text)('paid_from_advances'), // JSON: Array<{advanceId, amount, date}>
    totalPaidFromAdvances: (0, sqlite_core_1.real)('total_paid_from_advances').default(0),
    // Sales returns
    isReturnEntry: (0, sqlite_core_1.integer)('is_return_entry', { mode: 'boolean' }).default(false),
    returnCostAmount: (0, sqlite_core_1.real)('return_cost_amount').default(0),
    returnInventorySubCode: (0, sqlite_core_1.text)('return_inventory_sub_code'),
    // COGS reversal
    isCOGSReversal: (0, sqlite_core_1.integer)('is_cogs_reversal', { mode: 'boolean' }).default(false),
    // Inventory purchase flag
    isInventoryPurchase: (0, sqlite_core_1.integer)('is_inventory_purchase', { mode: 'boolean' }).default(false),
});
