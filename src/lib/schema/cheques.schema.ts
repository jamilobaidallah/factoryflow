import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const cheques = sqliteTable('cheques', {
  id:                          text('id').primaryKey(),
  profileId:                   text('profile_id').notNull(),
  chequeNumber:                text('cheque_number').notNull(),
  clientName:                  text('client_name').notNull(),
  amount:                      real('amount').notNull(),
  type:                        text('type').notNull(),      // from CHEQUE_TYPES
  chequeType:                  text('cheque_type'),         // e.g. "عادي"
  status:                      text('status').notNull(),
  chequeImageUrl:              text('cheque_image_url'),    // local file path in local version

  // Endorsement fields
  endorsedTo:                  text('endorsed_to'),
  endorsedDate:                text('endorsed_date'),
  endorsedToOutgoingId:        text('endorsed_to_outgoing_id'),
  endorsedSupplierTransactionId: text('endorsed_supplier_transaction_id'),
  isEndorsedCheque:            integer('is_endorsed_cheque', { mode: 'boolean' }).default(false),
  endorsedFromId:              text('endorsed_from_id'),

  // Document linking
  linkedTransactionId:         text('linked_transaction_id'),
  linkedPaymentId:             text('linked_payment_id'),
  paidTransactionIds:          text('paid_transaction_ids'), // JSON: string[]

  // Dates
  issueDate:                   text('issue_date').notNull(),
  dueDate:                     text('due_date').notNull(),
  clearedDate:                 text('cleared_date'),
  bouncedDate:                 text('bounced_date'),

  bankName:                    text('bank_name').notNull().default(''),
  notes:                       text('notes').notNull().default(''),
  clientPhone:                 text('client_phone'),
  createdAt:                   text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('chq_profile_idx').on(table.profileId),
  dueDateIdx: index('chq_due_date_idx').on(table.dueDate),
  statusIdx:  index('chq_status_idx').on(table.status),
}));
