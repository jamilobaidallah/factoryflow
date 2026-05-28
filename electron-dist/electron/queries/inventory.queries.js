"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInventoryItems = getInventoryItems;
exports.getInventoryItemById = getInventoryItemById;
exports.createInventoryItem = createInventoryItem;
exports.updateInventoryItem = updateInventoryItem;
exports.updateInventoryQuantity = updateInventoryQuantity;
exports.deleteInventoryItem = deleteInventoryItem;
exports.getInventoryMovements = getInventoryMovements;
exports.getMovementsForItem = getMovementsForItem;
exports.createInventoryMovement = createInventoryMovement;
const drizzle_orm_1 = require("drizzle-orm");
const inventory_schema_1 = require("../../src/lib/schema/inventory.schema");
function getInventoryItems(db, profileId) {
    return db.select().from(inventory_schema_1.inventory)
        .where((0, drizzle_orm_1.eq)(inventory_schema_1.inventory.profileId, profileId))
        .orderBy((0, drizzle_orm_1.asc)(inventory_schema_1.inventory.itemName))
        .all();
}
function getInventoryItemById(db, id) {
    return db.select().from(inventory_schema_1.inventory).where((0, drizzle_orm_1.eq)(inventory_schema_1.inventory.id, id)).get();
}
function createInventoryItem(db, data) {
    return db.insert(inventory_schema_1.inventory).values(data).returning().get();
}
function updateInventoryItem(db, id, data) {
    return db.update(inventory_schema_1.inventory).set(data).where((0, drizzle_orm_1.eq)(inventory_schema_1.inventory.id, id)).returning().get();
}
function updateInventoryQuantity(db, id, newQuantity) {
    db.update(inventory_schema_1.inventory).set({ quantity: newQuantity }).where((0, drizzle_orm_1.eq)(inventory_schema_1.inventory.id, id)).run();
}
function deleteInventoryItem(db, id) {
    // Remove movements first (FK constraint)
    db.delete(inventory_schema_1.inventoryMovements).where((0, drizzle_orm_1.eq)(inventory_schema_1.inventoryMovements.itemId, id)).run();
    db.delete(inventory_schema_1.inventory).where((0, drizzle_orm_1.eq)(inventory_schema_1.inventory.id, id)).run();
}
function getInventoryMovements(db, profileId) {
    return db.select().from(inventory_schema_1.inventoryMovements)
        .where((0, drizzle_orm_1.eq)(inventory_schema_1.inventoryMovements.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(inventory_schema_1.inventoryMovements.createdAt))
        .all();
}
function getMovementsForItem(db, itemId) {
    return db.select().from(inventory_schema_1.inventoryMovements)
        .where((0, drizzle_orm_1.eq)(inventory_schema_1.inventoryMovements.itemId, itemId))
        .orderBy((0, drizzle_orm_1.desc)(inventory_schema_1.inventoryMovements.createdAt))
        .all();
}
function createInventoryMovement(db, data) {
    return db.insert(inventory_schema_1.inventoryMovements).values(data).returning().get();
}
