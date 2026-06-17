import { eq, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { productionOrders } from '../../src/lib/schema/production.schema';

export type ProductionOrderRow    = typeof productionOrders.$inferSelect;
export type NewProductionOrderRow = typeof productionOrders.$inferInsert;

export function getProductionOrders(db: DrizzleDb, profileId: string): ProductionOrderRow[] {
  return db.select().from(productionOrders)
    .where(eq(productionOrders.profileId, profileId))
    .orderBy(desc(productionOrders.date))
    .all();
}

export function getProductionOrderById(db: DrizzleDb, id: string): ProductionOrderRow | undefined {
  return db.select().from(productionOrders).where(eq(productionOrders.id, id)).get();
}

export function createProductionOrder(db: DrizzleDb, data: NewProductionOrderRow): ProductionOrderRow {
  return db.insert(productionOrders).values(data).returning().get();
}

export function updateProductionOrder(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<ProductionOrderRow, 'id' | 'profileId' | 'createdAt'>>
): ProductionOrderRow | undefined {
  return db.update(productionOrders).set(data).where(eq(productionOrders.id, id)).returning().get();
}

export function deleteProductionOrder(db: DrizzleDb, id: string): void {
  db.delete(productionOrders).where(eq(productionOrders.id, id)).run();
}
