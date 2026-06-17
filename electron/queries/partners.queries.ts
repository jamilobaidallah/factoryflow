import { eq, asc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { partners } from '../../src/lib/schema/partners.schema';

export type PartnerRow = typeof partners.$inferSelect;
export type NewPartnerRow = typeof partners.$inferInsert;

export function getPartners(db: DrizzleDb, profileId: string): PartnerRow[] {
  return db.select().from(partners)
    .where(eq(partners.profileId, profileId))
    .orderBy(asc(partners.name))
    .all();
}

export function getActivePartners(db: DrizzleDb, profileId: string): PartnerRow[] {
  return db.select().from(partners)
    .where(eq(partners.profileId, profileId))
    .orderBy(asc(partners.name))
    .all()
    .filter(p => p.active);
}

export function getPartnerById(db: DrizzleDb, id: string): PartnerRow | undefined {
  return db.select().from(partners).where(eq(partners.id, id)).get();
}

export function getPartnerByName(db: DrizzleDb, profileId: string, name: string): PartnerRow | undefined {
  return db.select().from(partners)
    .where(eq(partners.profileId, profileId))
    .all()
    .find(p => p.name === name);
}

export function createPartner(db: DrizzleDb, data: NewPartnerRow): PartnerRow {
  return db.insert(partners).values(data).returning().get();
}

export function updatePartner(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<PartnerRow, 'id' | 'profileId' | 'createdAt'>>
): PartnerRow | undefined {
  return db.update(partners).set(data).where(eq(partners.id, id)).returning().get();
}

export function deletePartner(db: DrizzleDb, id: string): void {
  db.delete(partners).where(eq(partners.id, id)).run();
}
