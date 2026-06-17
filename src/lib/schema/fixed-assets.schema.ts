import { sqliteTable, text, real, integer, index, unique } from 'drizzle-orm/sqlite-core';

export const fixedAssets = sqliteTable('fixed_assets', {
  id:                       text('id').primaryKey(),
  profileId:                text('profile_id').notNull(),
  assetNumber:              text('asset_number').notNull(),
  assetName:                text('asset_name').notNull(),
  category:                 text('category').notNull().default(''),
  purchaseDate:             text('purchase_date').notNull(),
  purchaseCost:             real('purchase_cost').notNull(),
  salvageValue:             real('salvage_value').notNull().default(0),
  usefulLifeMonths:         integer('useful_life_months').notNull(),
  monthlyDepreciation:      real('monthly_depreciation').notNull(),
  status:                   text('status').notNull().default('active'), // 'active' | 'disposed' | 'sold' | 'written-off'
  accumulatedDepreciation:  real('accumulated_depreciation').notNull().default(0),
  bookValue:                real('book_value').notNull(),
  lastDepreciationDate:     text('last_depreciation_date'),
  location:                 text('location'),
  serialNumber:             text('serial_number'),
  supplier:                 text('supplier'),
  notes:                    text('notes'),
  createdAt:                text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('fa_profile_idx').on(table.profileId),
}));

export const depreciationRecords = sqliteTable('depreciation_records', {
  id:                              text('id').primaryKey(),
  profileId:                       text('profile_id').notNull(),
  assetId:                         text('asset_id').notNull().references(() => fixedAssets.id),
  assetName:                       text('asset_name').notNull(),
  month:                           integer('month').notNull(),    // 1–12
  year:                            integer('year').notNull(),
  period:                          text('period').notNull(),      // "2025-01" — for UNIQUE constraint
  periodLabel:                     text('period_label').notNull(),
  depreciationAmount:              real('depreciation_amount').notNull(),
  accumulatedDepreciationBefore:   real('accumulated_depreciation_before').notNull(),
  accumulatedDepreciationAfter:    real('accumulated_depreciation_after').notNull(),
  bookValueBefore:                 real('book_value_before').notNull(),
  bookValueAfter:                  real('book_value_after').notNull(),
  ledgerEntryId:                   text('ledger_entry_id'),
  recordedDate:                    text('recorded_date').notNull(),
  createdAt:                       text('created_at').notNull(),
}, (table) => ({
  assetIdx:    index('dr_asset_idx').on(table.assetId),
  profileIdx:  index('dr_profile_idx').on(table.profileId),
  // Prevents duplicate depreciation for the same asset in the same period (from the plan)
  uniquePeriod: unique('dr_unique_period').on(table.assetId, table.period),
}));

export const depreciationRuns = sqliteTable('depreciation_runs', {
  id:                 text('id').primaryKey(),
  profileId:          text('profile_id').notNull(),
  period:             text('period').notNull(),              // "2025-01"
  runDate:            text('run_date').notNull(),
  assetsCount:        integer('assets_count').notNull().default(0),
  totalDepreciation:  real('total_depreciation').notNull().default(0),
  ledgerEntryId:      text('ledger_entry_id').notNull(),
  runType:            text('run_type').default('global'),    // 'global' | 'per-asset'
  assetName:          text('asset_name'),
  createdAt:          text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('drun_profile_idx').on(table.profileId),
  periodIdx:  index('drun_period_idx').on(table.period),
}));
