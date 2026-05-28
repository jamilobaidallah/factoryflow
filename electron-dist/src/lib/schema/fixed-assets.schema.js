"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.depreciationRuns = exports.depreciationRecords = exports.fixedAssets = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.fixedAssets = (0, sqlite_core_1.sqliteTable)('fixed_assets', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    assetNumber: (0, sqlite_core_1.text)('asset_number').notNull(),
    assetName: (0, sqlite_core_1.text)('asset_name').notNull(),
    category: (0, sqlite_core_1.text)('category').notNull().default(''),
    purchaseDate: (0, sqlite_core_1.text)('purchase_date').notNull(),
    purchaseCost: (0, sqlite_core_1.real)('purchase_cost').notNull(),
    salvageValue: (0, sqlite_core_1.real)('salvage_value').notNull().default(0),
    usefulLifeMonths: (0, sqlite_core_1.integer)('useful_life_months').notNull(),
    monthlyDepreciation: (0, sqlite_core_1.real)('monthly_depreciation').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull().default('active'), // 'active' | 'disposed' | 'sold' | 'written-off'
    accumulatedDepreciation: (0, sqlite_core_1.real)('accumulated_depreciation').notNull().default(0),
    bookValue: (0, sqlite_core_1.real)('book_value').notNull(),
    lastDepreciationDate: (0, sqlite_core_1.text)('last_depreciation_date'),
    location: (0, sqlite_core_1.text)('location'),
    serialNumber: (0, sqlite_core_1.text)('serial_number'),
    supplier: (0, sqlite_core_1.text)('supplier'),
    notes: (0, sqlite_core_1.text)('notes'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('fa_profile_idx').on(table.profileId),
}));
exports.depreciationRecords = (0, sqlite_core_1.sqliteTable)('depreciation_records', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    assetId: (0, sqlite_core_1.text)('asset_id').notNull().references(() => exports.fixedAssets.id),
    assetName: (0, sqlite_core_1.text)('asset_name').notNull(),
    month: (0, sqlite_core_1.integer)('month').notNull(), // 1–12
    year: (0, sqlite_core_1.integer)('year').notNull(),
    period: (0, sqlite_core_1.text)('period').notNull(), // "2025-01" — for UNIQUE constraint
    periodLabel: (0, sqlite_core_1.text)('period_label').notNull(),
    depreciationAmount: (0, sqlite_core_1.real)('depreciation_amount').notNull(),
    accumulatedDepreciationBefore: (0, sqlite_core_1.real)('accumulated_depreciation_before').notNull(),
    accumulatedDepreciationAfter: (0, sqlite_core_1.real)('accumulated_depreciation_after').notNull(),
    bookValueBefore: (0, sqlite_core_1.real)('book_value_before').notNull(),
    bookValueAfter: (0, sqlite_core_1.real)('book_value_after').notNull(),
    ledgerEntryId: (0, sqlite_core_1.text)('ledger_entry_id'),
    recordedDate: (0, sqlite_core_1.text)('recorded_date').notNull(),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    assetIdx: (0, sqlite_core_1.index)('dr_asset_idx').on(table.assetId),
    profileIdx: (0, sqlite_core_1.index)('dr_profile_idx').on(table.profileId),
    // Prevents duplicate depreciation for the same asset in the same period (from the plan)
    uniquePeriod: (0, sqlite_core_1.unique)('dr_unique_period').on(table.assetId, table.period),
}));
exports.depreciationRuns = (0, sqlite_core_1.sqliteTable)('depreciation_runs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    period: (0, sqlite_core_1.text)('period').notNull(), // "2025-01"
    runDate: (0, sqlite_core_1.text)('run_date').notNull(),
    assetsCount: (0, sqlite_core_1.integer)('assets_count').notNull().default(0),
    totalDepreciation: (0, sqlite_core_1.real)('total_depreciation').notNull().default(0),
    ledgerEntryId: (0, sqlite_core_1.text)('ledger_entry_id').notNull(),
    runType: (0, sqlite_core_1.text)('run_type').default('global'), // 'global' | 'per-asset'
    assetName: (0, sqlite_core_1.text)('asset_name'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('drun_profile_idx').on(table.profileId),
    periodIdx: (0, sqlite_core_1.index)('drun_period_idx').on(table.period),
}));
