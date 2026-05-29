import { eq, desc, like, or } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { clients } from '../../src/lib/schema/clients.schema';

export type ClientRow = typeof clients.$inferSelect;
export type NewClientRow = typeof clients.$inferInsert;

export function getClients(db: DrizzleDb, profileId: string): ClientRow[] {
  return db.select().from(clients)
    .where(eq(clients.profileId, profileId))
    .orderBy(desc(clients.createdAt))
    .all();
}

export function searchClients(db: DrizzleDb, profileId: string, term: string): ClientRow[] {
  return db.select().from(clients)
    .where(eq(clients.profileId, profileId))
    .orderBy(clients.name)
    .all()
    .filter(c =>
      c.name.toLowerCase().includes(term.toLowerCase()) ||
      c.phone.includes(term)
    );
}

export function getClientById(db: DrizzleDb, id: string): ClientRow | undefined {
  return db.select().from(clients).where(eq(clients.id, id)).get();
}

export function createClient(db: DrizzleDb, data: NewClientRow): ClientRow {
  return db.insert(clients).values(data).returning().get();
}

export function updateClient(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<ClientRow, 'id' | 'profileId' | 'createdAt'>>
): ClientRow | undefined {
  return db.update(clients).set(data).where(eq(clients.id, id)).returning().get();
}

export function deleteClient(db: DrizzleDb, id: string): void {
  db.delete(clients).where(eq(clients.id, id)).run();
}

export function updateClientBalance(db: DrizzleDb, id: string, balance: number): void {
  db.update(clients).set({ balance }).where(eq(clients.id, id)).run();
}
