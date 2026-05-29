import { eq, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { payments } from '../../src/lib/schema/payments.schema';
import { paymentAllocations } from '../../src/lib/schema/payments.schema';

export type PaymentRow           = typeof payments.$inferSelect;
export type NewPaymentRow        = typeof payments.$inferInsert;
export type AllocationRow        = typeof paymentAllocations.$inferSelect;
export type NewAllocationRow     = typeof paymentAllocations.$inferInsert;

export interface PaymentWithAllocations {
  payment: NewPaymentRow;
  allocations: NewAllocationRow[];
}

// ── Payments ─────────────────────────────────────────────────────────────────

export function getPayments(db: DrizzleDb, profileId: string): PaymentRow[] {
  return db.select().from(payments)
    .where(eq(payments.profileId, profileId))
    .orderBy(desc(payments.date))
    .all();
}

export function getPaymentById(db: DrizzleDb, id: string): PaymentRow | undefined {
  return db.select().from(payments).where(eq(payments.id, id)).get();
}

/**
 * Create a payment and its allocations atomically.
 * If allocations fail, the payment is also rolled back.
 */
export function createPaymentWithAllocations(
  db: DrizzleDb,
  { payment, allocations }: PaymentWithAllocations
): PaymentRow {
  // Drizzle's better-sqlite3 wrapper exposes the underlying transaction via the
  // synchronous transaction() callback. The callback runs inside a SAVEPOINT;
  // any thrown error rolls back the whole unit.
  return db.transaction((tx) => {
    const created = tx.insert(payments).values(payment).returning().get();
    for (const alloc of allocations) {
      tx.insert(paymentAllocations).values(alloc).run();
    }
    return created;
  });
}

export function updatePayment(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<PaymentRow, 'id' | 'profileId' | 'createdAt'>>
): PaymentRow | undefined {
  return db.update(payments).set(data).where(eq(payments.id, id)).returning().get();
}

export function deletePayment(db: DrizzleDb, id: string): void {
  // Cascade: remove allocations first (FK constraint)
  db.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, id)).run();
  db.delete(payments).where(eq(payments.id, id)).run();
}

// ── Allocations ───────────────────────────────────────────────────────────────

export function getAllocationsForPayment(db: DrizzleDb, paymentId: string): AllocationRow[] {
  return db.select().from(paymentAllocations)
    .where(eq(paymentAllocations.paymentId, paymentId))
    .all();
}

export function getAllocationsForTransaction(db: DrizzleDb, transactionId: string): AllocationRow[] {
  return db.select().from(paymentAllocations)
    .where(eq(paymentAllocations.transactionId, transactionId))
    .all();
}

export function createAllocation(db: DrizzleDb, data: NewAllocationRow): AllocationRow {
  return db.insert(paymentAllocations).values(data).returning().get();
}

export function deleteAllocationsForPayment(db: DrizzleDb, paymentId: string): void {
  db.delete(paymentAllocations).where(eq(paymentAllocations.paymentId, paymentId)).run();
}
