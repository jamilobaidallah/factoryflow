import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const payments = sqliteTable('payments', {
  id:                 text('id').primaryKey(),
  profileId:          text('profile_id').notNull(),
  clientName:         text('client_name').notNull().default(''),
  amount:             real('amount').notNull().default(0),
  type:               text('type').notNull(),              // "قبض" | "صرف"
  date:               text('date').notNull(),              // UTC ISO string
  notes:              text('notes').notNull().default(''),
  category:           text('category'),
  subCategory:        text('sub_category'),

  // Multi-allocation
  isMultiAllocation:  integer('is_multi_allocation', { mode: 'boolean' }).default(false),
  totalAllocated:     real('total_allocated').default(0),
  allocationMethod:   text('allocation_method'),           // 'fifo' | 'manual'
  allocationCount:    integer('allocation_count').default(0),

  // Cheque linking
  linkedChequeId:     text('linked_cheque_id'),
  isEndorsement:      integer('is_endorsement', { mode: 'boolean' }).default(false),
  noCashMovement:     integer('no_cash_movement', { mode: 'boolean' }).default(false),

  createdAt:          text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('pay_profile_idx').on(table.profileId),
  dateIdx:    index('pay_date_idx').on(table.date),
}));

/**
 * Payment allocations — one row per invoice covered by a payment.
 * Replaces the Firestore payments/{id}/allocations subcollection.
 */
export const paymentAllocations = sqliteTable('payment_allocations', {
  id:               text('id').primaryKey(),
  paymentId:        text('payment_id').notNull().references(() => payments.id),
  profileId:        text('profile_id').notNull(),
  transactionId:    text('transaction_id').notNull(),      // Ledger TXN-... ID
  ledgerDocId:      text('ledger_doc_id').notNull(),       // Ledger row id
  allocatedAmount:  real('allocated_amount').notNull(),
  transactionDate:  text('transaction_date'),
  description:      text('description').default(''),
  createdAt:        text('created_at').notNull(),
}, (table) => ({
  paymentIdx: index('pa_payment_idx').on(table.paymentId),
  txnIdx:     index('pa_txn_idx').on(table.transactionId),
}));
