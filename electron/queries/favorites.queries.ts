import { eq, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { ledgerFavorites } from '../../src/lib/schema/favorites.schema';

export type FavoriteRow    = typeof ledgerFavorites.$inferSelect;
export type NewFavoriteRow = typeof ledgerFavorites.$inferInsert;

export function getFavorites(db: DrizzleDb, profileId: string): FavoriteRow[] {
  return db.select().from(ledgerFavorites)
    .where(eq(ledgerFavorites.profileId, profileId))
    .orderBy(desc(ledgerFavorites.usageCount))
    .all();
}

export function getFavoriteById(db: DrizzleDb, id: string): FavoriteRow | undefined {
  return db.select().from(ledgerFavorites).where(eq(ledgerFavorites.id, id)).get();
}

export function createFavorite(db: DrizzleDb, data: NewFavoriteRow): FavoriteRow {
  return db.insert(ledgerFavorites).values(data).returning().get();
}

export function updateFavorite(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<FavoriteRow, 'id' | 'profileId' | 'createdAt'>>
): FavoriteRow | undefined {
  return db.update(ledgerFavorites).set(data).where(eq(ledgerFavorites.id, id)).returning().get();
}

export function incrementUsage(db: DrizzleDb, id: string): void {
  const fav = getFavoriteById(db, id);
  if (!fav) { return; }
  db.update(ledgerFavorites)
    .set({ usageCount: fav.usageCount + 1, lastUsedAt: new Date().toISOString() })
    .where(eq(ledgerFavorites.id, id))
    .run();
}

export function deleteFavorite(db: DrizzleDb, id: string): void {
  db.delete(ledgerFavorites).where(eq(ledgerFavorites.id, id)).run();
}
