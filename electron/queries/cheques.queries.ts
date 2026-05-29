import { eq, desc, and } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { cheques } from '../../src/lib/schema/cheques.schema';

export type ChequeRow    = typeof cheques.$inferSelect;
export type NewChequeRow = typeof cheques.$inferInsert;

export function getCheques(db: DrizzleDb, profileId: string): ChequeRow[] {
  return db.select().from(cheques)
    .where(eq(cheques.profileId, profileId))
    .orderBy(desc(cheques.dueDate))
    .all();
}

export function getChequesByStatus(db: DrizzleDb, profileId: string, status: string): ChequeRow[] {
  return db.select().from(cheques)
    .where(and(eq(cheques.profileId, profileId), eq(cheques.status, status)))
    .orderBy(desc(cheques.dueDate))
    .all();
}

export function getChequesForClient(db: DrizzleDb, profileId: string, clientName: string): ChequeRow[] {
  return db.select().from(cheques)
    .where(eq(cheques.profileId, profileId))
    .all()
    .filter(c => c.clientName === clientName);
}

export function getChequeById(db: DrizzleDb, id: string): ChequeRow | undefined {
  return db.select().from(cheques).where(eq(cheques.id, id)).get();
}

export function getChequeByLinkedTransaction(
  db: DrizzleDb,
  transactionId: string
): ChequeRow | undefined {
  return db.select().from(cheques)
    .all()
    .find(c => c.linkedTransactionId === transactionId);
}

export function createCheque(db: DrizzleDb, data: NewChequeRow): ChequeRow {
  return db.insert(cheques).values(data).returning().get();
}

export function updateCheque(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<ChequeRow, 'id' | 'profileId' | 'createdAt'>>
): ChequeRow | undefined {
  return db.update(cheques).set(data).where(eq(cheques.id, id)).returning().get();
}

export function deleteCheque(db: DrizzleDb, id: string): void {
  db.delete(cheques).where(eq(cheques.id, id)).run();
}
