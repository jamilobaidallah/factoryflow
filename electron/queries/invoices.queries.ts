import { eq, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { invoices } from '../../src/lib/schema/invoices.schema';

export type InvoiceRow    = typeof invoices.$inferSelect;
export type NewInvoiceRow = typeof invoices.$inferInsert;

export function getInvoices(db: DrizzleDb, profileId: string): InvoiceRow[] {
  return db.select().from(invoices)
    .where(eq(invoices.profileId, profileId))
    .orderBy(desc(invoices.invoiceDate))
    .all()
    .filter(i => i.status !== 'voided');
}

export function getInvoiceById(db: DrizzleDb, id: string): InvoiceRow | undefined {
  return db.select().from(invoices).where(eq(invoices.id, id)).get();
}

export function createInvoice(db: DrizzleDb, data: NewInvoiceRow): InvoiceRow {
  return db.insert(invoices).values(data).returning().get();
}

export function updateInvoice(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<InvoiceRow, 'id' | 'profileId' | 'createdAt'>>
): InvoiceRow | undefined {
  return db.update(invoices).set(data).where(eq(invoices.id, id)).returning().get();
}

export function markOverdueInvoices(db: DrizzleDb, profileId: string): void {
  const now = new Date().toISOString();
  const sentInvoices = db.select().from(invoices)
    .where(eq(invoices.profileId, profileId))
    .all()
    .filter(i => i.status === 'sent' && i.dueDate < now);

  for (const inv of sentInvoices) {
    db.update(invoices)
      .set({ status: 'overdue', updatedAt: now })
      .where(eq(invoices.id, inv.id))
      .run();
  }
}

export function deleteInvoice(db: DrizzleDb, id: string): void {
  db.delete(invoices).where(eq(invoices.id, id)).run();
}
