import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const invoices = sqliteTable('invoices', {
  id:                    text('id').primaryKey(),
  profileId:             text('profile_id').notNull(),
  invoiceNumber:         text('invoice_number').notNull(),
  manualInvoiceNumber:   text('manual_invoice_number'),
  clientName:            text('client_name').notNull(),
  clientAddress:         text('client_address'),
  clientPhone:           text('client_phone'),
  invoiceDate:           text('invoice_date').notNull(),
  dueDate:               text('due_date').notNull(),

  // Items stored as JSON array
  items:                 text('items').notNull(),  // JSON: Array<{description,quantity,unitPrice,total,itemType,unit,...}>

  subtotal:              real('subtotal').notNull(),
  taxRate:               real('tax_rate').notNull().default(0),
  taxAmount:             real('tax_amount').notNull().default(0),
  total:                 real('total').notNull(),

  status:                text('status').notNull().default('draft'), // 'draft' | 'sent' | 'paid' | 'overdue'
  notes:                 text('notes'),
  invoiceImageUrl:       text('invoice_image_url'),
  linkedTransactionId:   text('linked_transaction_id'),
  createdAt:             text('created_at').notNull(),
  updatedAt:             text('updated_at').notNull(),
}, (table) => ({
  profileIdx: index('inv_invoice_profile_idx').on(table.profileId),
  statusIdx:  index('inv_invoice_status_idx').on(table.status),
}));
