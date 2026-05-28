"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.journalLines = exports.journalEntries = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.journalEntries = (0, sqlite_core_1.sqliteTable)('journal_entries', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    sequenceNumber: (0, sqlite_core_1.integer)('sequence_number').notNull(),
    entryNumber: (0, sqlite_core_1.text)('entry_number').notNull(), // "JE-000001"
    date: (0, sqlite_core_1.text)('date').notNull(), // UTC ISO string
    description: (0, sqlite_core_1.text)('description').notNull().default(''),
    status: (0, sqlite_core_1.text)('status').notNull().default('posted'), // 'posted' | 'reversed'
    // Status columns (from plan — supports Void & Replace workflows per IFRS)
    entryStatus: (0, sqlite_core_1.text)('entry_status').notNull().default('active'), // 'active' | 'voided'
    supersededBy: (0, sqlite_core_1.text)('superseded_by'), // ID of correcting entry
    // Source document linking
    sourceType: (0, sqlite_core_1.text)('source_type'), // 'ledger' | 'payment' | 'cheque_cash' | 'endorsement' | 'inventory' | 'depreciation' | 'manual' | ...
    sourceDocumentId: (0, sqlite_core_1.text)('source_document_id'),
    sourceTransactionId: (0, sqlite_core_1.text)('source_transaction_id'),
    sourceChequeId: (0, sqlite_core_1.text)('source_cheque_id'),
    // Reversal metadata
    isReversal: (0, sqlite_core_1.integer)('is_reversal', { mode: 'boolean' }).default(false),
    reversesEntryId: (0, sqlite_core_1.text)('reverses_entry_id'),
    reversedByEntryId: (0, sqlite_core_1.text)('reversed_by_entry_id'),
    reversedAt: (0, sqlite_core_1.text)('reversed_at'),
    reversalReason: (0, sqlite_core_1.text)('reversal_reason'),
    reversalType: (0, sqlite_core_1.text)('reversal_type'), // 'void' | 'correction'
    // Legacy linking fields (kept for backward compatibility with migrated data)
    linkedTransactionId: (0, sqlite_core_1.text)('linked_transaction_id'),
    linkedPaymentId: (0, sqlite_core_1.text)('linked_payment_id'),
    linkedDocumentType: (0, sqlite_core_1.text)('linked_document_type'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
    createdBy: (0, sqlite_core_1.text)('created_by'),
    updatedAt: (0, sqlite_core_1.text)('updated_at'),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('je_profile_idx').on(table.profileId),
    dateIdx: (0, sqlite_core_1.index)('je_date_idx').on(table.date),
    txnIdx: (0, sqlite_core_1.index)('je_txn_idx').on(table.linkedTransactionId),
}));
/**
 * Individual debit/credit lines.
 * Normalised from the Firestore lines[] array into a separate table.
 * This enables efficient trial balance queries without loading full entry documents.
 */
exports.journalLines = (0, sqlite_core_1.sqliteTable)('journal_lines', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    journalId: (0, sqlite_core_1.text)('journal_id').notNull().references(() => exports.journalEntries.id),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(), // denormalised for fast queries
    accountCode: (0, sqlite_core_1.text)('account_code').notNull(),
    accountName: (0, sqlite_core_1.text)('account_name').notNull().default(''),
    accountNameAr: (0, sqlite_core_1.text)('account_name_ar').notNull().default(''),
    debit: (0, sqlite_core_1.real)('debit').notNull().default(0),
    credit: (0, sqlite_core_1.real)('credit').notNull().default(0),
    description: (0, sqlite_core_1.text)('description'),
}, (table) => ({
    journalIdx: (0, sqlite_core_1.index)('jl_journal_idx').on(table.journalId),
    accountIdx: (0, sqlite_core_1.index)('jl_account_idx').on(table.accountCode),
    profileIdx: (0, sqlite_core_1.index)('jl_profile_idx').on(table.profileId),
}));
