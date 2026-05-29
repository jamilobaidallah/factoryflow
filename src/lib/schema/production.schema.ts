import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const productionOrders = sqliteTable('production_orders', {
  id:                   text('id').primaryKey(),
  profileId:            text('profile_id').notNull(),
  orderNumber:          text('order_number').notNull(),
  date:                 text('date').notNull(),

  // Input — raw material consumed
  inputItemId:          text('input_item_id').notNull(),
  inputItemName:        text('input_item_name').notNull(),
  inputQuantity:        real('input_quantity').notNull(),
  inputThickness:       real('input_thickness'),
  inputWidth:           real('input_width'),
  inputLength:          real('input_length'),

  // Output — finished product
  outputItemName:       text('output_item_name').notNull(),
  outputQuantity:       real('output_quantity').notNull(),
  outputThickness:      real('output_thickness'),
  outputWidth:          real('output_width'),
  outputLength:         real('output_length'),

  unit:                 text('unit').notNull().default(''),
  productionExpenses:   real('production_expenses').notNull().default(0),
  status:               text('status').notNull().default('قيد التنفيذ'),
  notes:                text('notes').notNull().default(''),
  createdAt:            text('created_at').notNull(),
  completedAt:          text('completed_at'),
}, (table) => ({
  profileIdx: index('po_profile_idx').on(table.profileId),
  statusIdx:  index('po_status_idx').on(table.status),
}));
