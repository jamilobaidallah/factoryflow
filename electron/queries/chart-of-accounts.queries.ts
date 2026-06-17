import { eq, and } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { chartOfAccounts } from '../../src/lib/schema/chart-of-accounts.schema';

export type AccountRow    = typeof chartOfAccounts.$inferSelect;
export type NewAccountRow = typeof chartOfAccounts.$inferInsert;

export function getAccounts(db: DrizzleDb, profileId: string): AccountRow[] {
  return db.select().from(chartOfAccounts)
    .where(eq(chartOfAccounts.profileId, profileId))
    .orderBy(chartOfAccounts.code)
    .all();
}

export function getActiveAccounts(db: DrizzleDb, profileId: string): AccountRow[] {
  return getAccounts(db, profileId).filter(a => a.isActive);
}

export function getAccountByCode(
  db: DrizzleDb,
  profileId: string,
  code: string
): AccountRow | undefined {
  return db.select().from(chartOfAccounts)
    .where(and(eq(chartOfAccounts.profileId, profileId), eq(chartOfAccounts.code, code)))
    .get();
}

export function getAccountById(db: DrizzleDb, id: string): AccountRow | undefined {
  return db.select().from(chartOfAccounts).where(eq(chartOfAccounts.id, id)).get();
}

export function createAccount(db: DrizzleDb, data: NewAccountRow): AccountRow {
  return db.insert(chartOfAccounts).values(data).returning().get();
}

export function updateAccount(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<AccountRow, 'id' | 'profileId' | 'createdAt'>>
): AccountRow | undefined {
  return db.update(chartOfAccounts).set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(chartOfAccounts.id, id))
    .returning().get();
}

export function deactivateAccount(db: DrizzleDb, id: string): void {
  db.update(chartOfAccounts)
    .set({ isActive: false, updatedAt: new Date().toISOString() })
    .where(eq(chartOfAccounts.id, id))
    .run();
}

/**
 * Find next available partner equity account code in range 3100–3179.
 * Per the chart-of-accounts plan: allocates capital at 3100 + n×20.
 * Returns undefined if range is exhausted (4 partners max).
 */
export function findNextPartnerEquityCode(
  db: DrizzleDb,
  profileId: string
): number | undefined {
  const accounts = getAccounts(db, profileId);
  const usedCodes = new Set(accounts.map(a => parseInt(a.code, 10)));
  for (let candidate = 3100; candidate <= 3160; candidate += 20) {
    if (!usedCodes.has(candidate) && !usedCodes.has(candidate + 10)) {
      return candidate;
    }
  }
  return undefined;
}
