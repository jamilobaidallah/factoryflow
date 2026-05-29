import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const inventory = sqliteTable('inventory', {
  id:                    text('id').primaryKey(),
  profileId:             text('profile_id').notNull(),
  itemName:              text('item_name').notNull(),
  category:              text('category').notNull().default(''),
  subCategory:           text('sub_category'),
  quantity:              real('quantity').notNull().default(0),
  unit:                  text('unit').notNull().default(''),
  unitPrice:             real('unit_price').notNull().default(0),
  minStock:              real('min_stock').notNull().default(0),
  location:              text('location').notNull().default(''),
  notes:                 text('notes').notNull().default(''),

  // Physical dimensions
  thickness:             real('thickness'),
  width:                 real('width'),
  length:                real('length'),

  // Weighted average cost
  lastPurchasePrice:     real('last_purchase_price'),
  lastPurchaseDate:      text('last_purchase_date'),
  lastPurchaseAmount:    real('last_purchase_amount'),

  // Sub-inventory account code
  inventoryAccountCode:  text('inventory_account_code').default('1300'),

  createdAt:             text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('inv_profile_idx').on(table.profileId),
}));

export const inventoryMovements = sqliteTable('inventory_movements', {
  id:                    text('id').primaryKey(),
  profileId:             text('profile_id').notNull(),
  itemId:                text('item_id').notNull().references(() => inventory.id),
  itemName:              text('item_name').notNull(),      // denormalised
  type:                  text('type').notNull(),            // "دخول" | "خروج"
  quantity:              real('quantity').notNull(),
  unit:                  text('unit'),
  linkedTransactionId:   text('linked_transaction_id'),
  notes:                 text('notes'),
  userEmail:             text('user_email'),
  createdAt:             text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('im_profile_idx').on(table.profileId),
  itemIdx:    index('im_item_idx').on(table.itemId),
}));
