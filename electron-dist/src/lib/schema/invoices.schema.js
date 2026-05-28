"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoices = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.invoices = (0, sqlite_core_1.sqliteTable)('invoices', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    invoiceNumber: (0, sqlite_core_1.text)('invoice_number').notNull(),
    manualInvoiceNumber: (0, sqlite_core_1.text)('manual_invoice_number'),
    clientName: (0, sqlite_core_1.text)('client_name').notNull(),
    clientAddress: (0, sqlite_core_1.text)('client_address'),
    clientPhone: (0, sqlite_core_1.text)('client_phone'),
    invoiceDate: (0, sqlite_core_1.text)('invoice_date').notNull(),
    dueDate: (0, sqlite_core_1.text)('due_date').notNull(),
    // Items stored as JSON array
    items: (0, sqlite_core_1.text)('items').notNull(), // JSON: Array<{description,quantity,unitPrice,total,itemType,unit,...}>
    subtotal: (0, sqlite_core_1.real)('subtotal').notNull(),
    taxRate: (0, sqlite_core_1.real)('tax_rate').notNull().default(0),
    taxAmount: (0, sqlite_core_1.real)('tax_amount').notNull().default(0),
    total: (0, sqlite_core_1.real)('total').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull().default('draft'), // 'draft' | 'sent' | 'paid' | 'overdue'
    notes: (0, sqlite_core_1.text)('notes'),
    invoiceImageUrl: (0, sqlite_core_1.text)('invoice_image_url'),
    linkedTransactionId: (0, sqlite_core_1.text)('linked_transaction_id'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
    updatedAt: (0, sqlite_core_1.text)('updated_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('inv_invoice_profile_idx').on(table.profileId),
    statusIdx: (0, sqlite_core_1.index)('inv_invoice_status_idx').on(table.status),
}));
