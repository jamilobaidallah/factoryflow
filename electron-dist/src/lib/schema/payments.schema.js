"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentAllocations = exports.payments = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.payments = (0, sqlite_core_1.sqliteTable)('payments', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    clientName: (0, sqlite_core_1.text)('client_name').notNull().default(''),
    amount: (0, sqlite_core_1.real)('amount').notNull().default(0),
    type: (0, sqlite_core_1.text)('type').notNull(), // "قبض" | "صرف"
    date: (0, sqlite_core_1.text)('date').notNull(), // UTC ISO string
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    category: (0, sqlite_core_1.text)('category'),
    subCategory: (0, sqlite_core_1.text)('sub_category'),
    // Multi-allocation
    isMultiAllocation: (0, sqlite_core_1.integer)('is_multi_allocation', { mode: 'boolean' }).default(false),
    totalAllocated: (0, sqlite_core_1.real)('total_allocated').default(0),
    allocationMethod: (0, sqlite_core_1.text)('allocation_method'), // 'fifo' | 'manual'
    allocationCount: (0, sqlite_core_1.integer)('allocation_count').default(0),
    // Cheque linking
    linkedChequeId: (0, sqlite_core_1.text)('linked_cheque_id'),
    isEndorsement: (0, sqlite_core_1.integer)('is_endorsement', { mode: 'boolean' }).default(false),
    noCashMovement: (0, sqlite_core_1.integer)('no_cash_movement', { mode: 'boolean' }).default(false),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('pay_profile_idx').on(table.profileId),
    dateIdx: (0, sqlite_core_1.index)('pay_date_idx').on(table.date),
}));
/**
 * Payment allocations — one row per invoice covered by a payment.
 * Replaces the Firestore payments/{id}/allocations subcollection.
 */
exports.paymentAllocations = (0, sqlite_core_1.sqliteTable)('payment_allocations', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    paymentId: (0, sqlite_core_1.text)('payment_id').notNull().references(() => exports.payments.id),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    transactionId: (0, sqlite_core_1.text)('transaction_id').notNull(), // Ledger TXN-... ID
    ledgerDocId: (0, sqlite_core_1.text)('ledger_doc_id').notNull(), // Ledger row id
    allocatedAmount: (0, sqlite_core_1.real)('allocated_amount').notNull(),
    transactionDate: (0, sqlite_core_1.text)('transaction_date'),
    description: (0, sqlite_core_1.text)('description').default(''),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    paymentIdx: (0, sqlite_core_1.index)('pa_payment_idx').on(table.paymentId),
    txnIdx: (0, sqlite_core_1.index)('pa_txn_idx').on(table.transactionId),
}));
