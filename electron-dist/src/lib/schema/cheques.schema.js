"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cheques = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.cheques = (0, sqlite_core_1.sqliteTable)('cheques', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    chequeNumber: (0, sqlite_core_1.text)('cheque_number').notNull(),
    clientName: (0, sqlite_core_1.text)('client_name').notNull(),
    amount: (0, sqlite_core_1.real)('amount').notNull(),
    type: (0, sqlite_core_1.text)('type').notNull(), // from CHEQUE_TYPES
    chequeType: (0, sqlite_core_1.text)('cheque_type'), // e.g. "عادي"
    status: (0, sqlite_core_1.text)('status').notNull(),
    chequeImageUrl: (0, sqlite_core_1.text)('cheque_image_url'), // local file path in local version
    // Endorsement fields
    endorsedTo: (0, sqlite_core_1.text)('endorsed_to'),
    endorsedDate: (0, sqlite_core_1.text)('endorsed_date'),
    endorsedToOutgoingId: (0, sqlite_core_1.text)('endorsed_to_outgoing_id'),
    endorsedSupplierTransactionId: (0, sqlite_core_1.text)('endorsed_supplier_transaction_id'),
    isEndorsedCheque: (0, sqlite_core_1.integer)('is_endorsed_cheque', { mode: 'boolean' }).default(false),
    endorsedFromId: (0, sqlite_core_1.text)('endorsed_from_id'),
    // Document linking
    linkedTransactionId: (0, sqlite_core_1.text)('linked_transaction_id'),
    linkedPaymentId: (0, sqlite_core_1.text)('linked_payment_id'),
    paidTransactionIds: (0, sqlite_core_1.text)('paid_transaction_ids'), // JSON: string[]
    // Dates
    issueDate: (0, sqlite_core_1.text)('issue_date').notNull(),
    dueDate: (0, sqlite_core_1.text)('due_date').notNull(),
    clearedDate: (0, sqlite_core_1.text)('cleared_date'),
    bouncedDate: (0, sqlite_core_1.text)('bounced_date'),
    bankName: (0, sqlite_core_1.text)('bank_name').notNull().default(''),
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    clientPhone: (0, sqlite_core_1.text)('client_phone'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('chq_profile_idx').on(table.profileId),
    dueDateIdx: (0, sqlite_core_1.index)('chq_due_date_idx').on(table.dueDate),
    statusIdx: (0, sqlite_core_1.index)('chq_status_idx').on(table.status),
}));
