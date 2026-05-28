import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const journalEntries = sqliteTable('journal_entries', {
  id:               text('id').primaryKey(),
  profileId:        text('profile_id').notNull(),
  sequenceNumber:   integer('sequence_number').notNull(),
  entryNumber:      text('entry_number').notNull(),        // "JE-000001"
  date:             text('date').notNull(),                // UTC ISO string
  description:      text('description').notNull().default(''),
  status:           text('status').notNull().default('posted'), // 'posted' | 'reversed'

  // Status columns (from plan — supports Void & Replace workflows per IFRS)
  entryStatus:      text('entry_status').notNull().default('active'), // 'active' | 'voided'
  supersededBy:     text('superseded_by'),                // ID of correcting entry

  // Source document linking
  sourceType:       text('source_type'),  // 'ledger' | 'payment' | 'cheque_cash' | 'endorsement' | 'inventory' | 'depreciation' | 'manual' | ...
  sourceDocumentId: text('source_document_id'),
  sourceTransactionId: text('source_transaction_id'),
  sourceChequeId:   text('source_cheque_id'),

  // Reversal metadata
  isReversal:       integer('is_reversal', { mode: 'boolean' }).default(false),
  reversesEntryId:  text('reverses_entry_id'),
  reversedByEntryId: text('reversed_by_entry_id'),
  reversedAt:       text('reversed_at'),
  reversalReason:   text('reversal_reason'),
  reversalType:     text('reversal_type'),               // 'void' | 'correction'

  // Legacy linking fields (kept for backward compatibility with migrated data)
  linkedTransactionId:  text('linked_transaction_id'),
  linkedPaymentId:      text('linked_payment_id'),
  linkedDocumentType:   text('linked_document_type'),

  createdAt:        text('created_at').notNull(),
  createdBy:        text('created_by'),
  updatedAt:        text('updated_at'),
}, (table) => ({
  profileIdx: index('je_profile_idx').on(table.profileId),
  dateIdx:    index('je_date_idx').on(table.date),
  txnIdx:     index('je_txn_idx').on(table.linkedTransactionId),
}));

/**
 * Individual debit/credit lines.
 * Normalised from the Firestore lines[] array into a separate table.
 * This enables efficient trial balance queries without loading full entry documents.
 */
export const journalLines = sqliteTable('journal_lines', {
  id:             text('id').primaryKey(),
  journalId:      text('journal_id').notNull().references(() => journalEntries.id),
  profileId:      text('profile_id').notNull(),           // denormalised for fast queries
  accountCode:    text('account_code').notNull(),
  accountName:    text('account_name').notNull().default(''),
  accountNameAr:  text('account_name_ar').notNull().default(''),
  debit:          real('debit').notNull().default(0),
  credit:         real('credit').notNull().default(0),
  description:    text('description'),
}, (table) => ({
  journalIdx: index('jl_journal_idx').on(table.journalId),
  accountIdx: index('jl_account_idx').on(table.accountCode),
  profileIdx: index('jl_profile_idx').on(table.profileId),
}));
