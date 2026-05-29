import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const ledger = sqliteTable('ledger', {
  id:                    text('id').primaryKey(),
  profileId:             text('profile_id').notNull(),
  transactionId:         text('transaction_id').notNull().unique(),
  description:           text('description').notNull().default(''),
  type:                  text('type').notNull(),           // "دخل" | "مصروف" | "حركة رأس مال" | "مردود"
  amount:                real('amount').notNull().default(0),
  category:              text('category').notNull().default(''),
  subCategory:           text('sub_category').notNull().default(''),
  associatedParty:       text('associated_party').notNull().default(''),
  ownerName:             text('owner_name'),
  date:                  text('date').notNull(),           // UTC ISO string
  createdAt:             text('created_at').notNull(),     // UTC ISO string

  // AR/AP tracking
  totalPaid:             real('total_paid').default(0),
  remainingBalance:      real('remaining_balance').default(0),
  paymentStatus:         text('payment_status'),           // 'paid' | 'unpaid' | 'partial'
  isARAPEntry:           integer('is_arap_entry', { mode: 'boolean' }).default(false),

  // Settlement discount
  totalDiscount:         real('total_discount').default(0),

  // Bad debt write-off
  writeoffAmount:        real('writeoff_amount').default(0),
  writeoffReason:        text('writeoff_reason'),
  writeoffDate:          text('writeoff_date'),
  writeoffBy:            text('writeoff_by'),

  // Immediate cash settlement
  immediateSettlement:   integer('immediate_settlement', { mode: 'boolean' }).default(false),

  // Advance payments — stored as JSON array
  paidFromAdvances:      text('paid_from_advances'),       // JSON: Array<{advanceId, amount, date}>
  totalPaidFromAdvances: real('total_paid_from_advances').default(0),

  // Sales returns
  isReturnEntry:         integer('is_return_entry', { mode: 'boolean' }).default(false),
  returnCostAmount:      real('return_cost_amount').default(0),
  returnInventorySubCode: text('return_inventory_sub_code'),

  // COGS reversal
  isCOGSReversal:        integer('is_cogs_reversal', { mode: 'boolean' }).default(false),

  // Inventory purchase flag
  isInventoryPurchase:   integer('is_inventory_purchase', { mode: 'boolean' }).default(false),
});
