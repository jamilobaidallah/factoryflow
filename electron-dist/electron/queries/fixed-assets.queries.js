"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFixedAssets = getFixedAssets;
exports.getFixedAssetById = getFixedAssetById;
exports.createFixedAsset = createFixedAsset;
exports.updateFixedAsset = updateFixedAsset;
exports.deleteFixedAsset = deleteFixedAsset;
exports.getDepreciationRecords = getDepreciationRecords;
exports.getDepreciationRecordsForAsset = getDepreciationRecordsForAsset;
exports.periodAlreadyDepreciated = periodAlreadyDepreciated;
exports.createDepreciationRecord = createDepreciationRecord;
exports.getDepreciationRuns = getDepreciationRuns;
exports.createDepreciationRun = createDepreciationRun;
const drizzle_orm_1 = require("drizzle-orm");
const fixed_assets_schema_1 = require("../../src/lib/schema/fixed-assets.schema");
const fixed_assets_schema_2 = require("../../src/lib/schema/fixed-assets.schema");
const fixed_assets_schema_3 = require("../../src/lib/schema/fixed-assets.schema");
// ── Fixed Assets ─────────────────────────────────────────────────────────────
function getFixedAssets(db, profileId) {
    return db.select().from(fixed_assets_schema_1.fixedAssets)
        .where((0, drizzle_orm_1.eq)(fixed_assets_schema_1.fixedAssets.profileId, profileId))
        .orderBy(fixed_assets_schema_1.fixedAssets.assetName)
        .all();
}
function getFixedAssetById(db, id) {
    return db.select().from(fixed_assets_schema_1.fixedAssets).where((0, drizzle_orm_1.eq)(fixed_assets_schema_1.fixedAssets.id, id)).get();
}
function createFixedAsset(db, data) {
    return db.insert(fixed_assets_schema_1.fixedAssets).values(data).returning().get();
}
function updateFixedAsset(db, id, data) {
    return db.update(fixed_assets_schema_1.fixedAssets).set(data).where((0, drizzle_orm_1.eq)(fixed_assets_schema_1.fixedAssets.id, id)).returning().get();
}
function deleteFixedAsset(db, id) {
    // Cascade: remove depreciation records first (FK constraint)
    db.delete(fixed_assets_schema_2.depreciationRecords).where((0, drizzle_orm_1.eq)(fixed_assets_schema_2.depreciationRecords.assetId, id)).run();
    db.delete(fixed_assets_schema_1.fixedAssets).where((0, drizzle_orm_1.eq)(fixed_assets_schema_1.fixedAssets.id, id)).run();
}
// ── Depreciation Records ──────────────────────────────────────────────────────
function getDepreciationRecords(db, profileId) {
    return db.select().from(fixed_assets_schema_2.depreciationRecords)
        .where((0, drizzle_orm_1.eq)(fixed_assets_schema_2.depreciationRecords.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(fixed_assets_schema_2.depreciationRecords.period))
        .all();
}
function getDepreciationRecordsForAsset(db, assetId) {
    return db.select().from(fixed_assets_schema_2.depreciationRecords)
        .where((0, drizzle_orm_1.eq)(fixed_assets_schema_2.depreciationRecords.assetId, assetId))
        .orderBy((0, drizzle_orm_1.desc)(fixed_assets_schema_2.depreciationRecords.period))
        .all();
}
function periodAlreadyDepreciated(db, assetId, period) {
    const existing = db.select().from(fixed_assets_schema_2.depreciationRecords)
        .all()
        .find(r => r.assetId === assetId && r.period === period);
    return !!existing;
}
function createDepreciationRecord(db, data) {
    return db.insert(fixed_assets_schema_2.depreciationRecords).values(data).returning().get();
}
// ── Depreciation Runs ─────────────────────────────────────────────────────────
function getDepreciationRuns(db, profileId) {
    return db.select().from(fixed_assets_schema_3.depreciationRuns)
        .where((0, drizzle_orm_1.eq)(fixed_assets_schema_3.depreciationRuns.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(fixed_assets_schema_3.depreciationRuns.period))
        .all();
}
function createDepreciationRun(db, data) {
    return db.insert(fixed_assets_schema_3.depreciationRuns).values(data).returning().get();
}
