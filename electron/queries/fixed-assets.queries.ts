import { eq, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { fixedAssets } from '../../src/lib/schema/fixed-assets.schema';
import { depreciationRecords } from '../../src/lib/schema/fixed-assets.schema';
import { depreciationRuns } from '../../src/lib/schema/fixed-assets.schema';

export type FixedAssetRow         = typeof fixedAssets.$inferSelect;
export type NewFixedAssetRow      = typeof fixedAssets.$inferInsert;
export type DepreciationRecordRow = typeof depreciationRecords.$inferSelect;
export type NewDepreciationRecordRow = typeof depreciationRecords.$inferInsert;
export type DepreciationRunRow    = typeof depreciationRuns.$inferSelect;
export type NewDepreciationRunRow = typeof depreciationRuns.$inferInsert;

// ── Fixed Assets ─────────────────────────────────────────────────────────────

export function getFixedAssets(db: DrizzleDb, profileId: string): FixedAssetRow[] {
  return db.select().from(fixedAssets)
    .where(eq(fixedAssets.profileId, profileId))
    .orderBy(fixedAssets.assetName)
    .all();
}

export function getFixedAssetById(db: DrizzleDb, id: string): FixedAssetRow | undefined {
  return db.select().from(fixedAssets).where(eq(fixedAssets.id, id)).get();
}

export function createFixedAsset(db: DrizzleDb, data: NewFixedAssetRow): FixedAssetRow {
  return db.insert(fixedAssets).values(data).returning().get();
}

export function updateFixedAsset(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<FixedAssetRow, 'id' | 'profileId' | 'createdAt'>>
): FixedAssetRow | undefined {
  return db.update(fixedAssets).set(data).where(eq(fixedAssets.id, id)).returning().get();
}

export function deleteFixedAsset(db: DrizzleDb, id: string): void {
  // Cascade: remove depreciation records first (FK constraint)
  db.delete(depreciationRecords).where(eq(depreciationRecords.assetId, id)).run();
  db.delete(fixedAssets).where(eq(fixedAssets.id, id)).run();
}

// ── Depreciation Records ──────────────────────────────────────────────────────

export function getDepreciationRecords(
  db: DrizzleDb,
  profileId: string
): DepreciationRecordRow[] {
  return db.select().from(depreciationRecords)
    .where(eq(depreciationRecords.profileId, profileId))
    .orderBy(desc(depreciationRecords.period))
    .all();
}

export function getDepreciationRecordsForAsset(
  db: DrizzleDb,
  assetId: string
): DepreciationRecordRow[] {
  return db.select().from(depreciationRecords)
    .where(eq(depreciationRecords.assetId, assetId))
    .orderBy(desc(depreciationRecords.period))
    .all();
}

export function periodAlreadyDepreciated(
  db: DrizzleDb,
  assetId: string,
  period: string
): boolean {
  const existing = db.select().from(depreciationRecords)
    .all()
    .find(r => r.assetId === assetId && r.period === period);
  return !!existing;
}

export function createDepreciationRecord(
  db: DrizzleDb,
  data: NewDepreciationRecordRow
): DepreciationRecordRow {
  return db.insert(depreciationRecords).values(data).returning().get();
}

// ── Depreciation Runs ─────────────────────────────────────────────────────────

export function getDepreciationRuns(db: DrizzleDb, profileId: string): DepreciationRunRow[] {
  return db.select().from(depreciationRuns)
    .where(eq(depreciationRuns.profileId, profileId))
    .orderBy(desc(depreciationRuns.period))
    .all();
}

export function createDepreciationRun(
  db: DrizzleDb,
  data: NewDepreciationRunRow
): DepreciationRunRow {
  return db.insert(depreciationRuns).values(data).returning().get();
}
