import { eq, asc, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { inventory, inventoryMovements } from '../../src/lib/schema/inventory.schema';

export type InventoryRow = typeof inventory.$inferSelect;
export type NewInventoryRow = typeof inventory.$inferInsert;
export type InventoryMovementRow = typeof inventoryMovements.$inferSelect;
export type NewInventoryMovementRow = typeof inventoryMovements.$inferInsert;

export function getInventoryItems(db: DrizzleDb, profileId: string): InventoryRow[] {
  return db.select().from(inventory)
    .where(eq(inventory.profileId, profileId))
    .orderBy(asc(inventory.itemName))
    .all();
}

export function getInventoryItemById(db: DrizzleDb, id: string): InventoryRow | undefined {
  return db.select().from(inventory).where(eq(inventory.id, id)).get();
}

export function createInventoryItem(db: DrizzleDb, data: NewInventoryRow): InventoryRow {
  return db.insert(inventory).values(data).returning().get();
}

export function updateInventoryItem(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<InventoryRow, 'id' | 'profileId' | 'createdAt'>>
): InventoryRow | undefined {
  return db.update(inventory).set(data).where(eq(inventory.id, id)).returning().get();
}

export function updateInventoryQuantity(
  db: DrizzleDb,
  id: string,
  newQuantity: number
): void {
  db.update(inventory).set({ quantity: newQuantity }).where(eq(inventory.id, id)).run();
}

export function deleteInventoryItem(db: DrizzleDb, id: string): void {
  // Remove movements first (FK constraint)
  db.delete(inventoryMovements).where(eq(inventoryMovements.itemId, id)).run();
  db.delete(inventory).where(eq(inventory.id, id)).run();
}

export function getInventoryMovements(db: DrizzleDb, profileId: string): InventoryMovementRow[] {
  return db.select().from(inventoryMovements)
    .where(eq(inventoryMovements.profileId, profileId))
    .orderBy(desc(inventoryMovements.createdAt))
    .all();
}

export function getMovementsForItem(db: DrizzleDb, itemId: string): InventoryMovementRow[] {
  return db.select().from(inventoryMovements)
    .where(eq(inventoryMovements.itemId, itemId))
    .orderBy(desc(inventoryMovements.createdAt))
    .all();
}

export function createInventoryMovement(
  db: DrizzleDb,
  data: NewInventoryMovementRow
): InventoryMovementRow {
  return db.insert(inventoryMovements).values(data).returning().get();
}
