"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProductionOrders = getProductionOrders;
exports.getProductionOrderById = getProductionOrderById;
exports.createProductionOrder = createProductionOrder;
exports.updateProductionOrder = updateProductionOrder;
exports.deleteProductionOrder = deleteProductionOrder;
const drizzle_orm_1 = require("drizzle-orm");
const production_schema_1 = require("../../src/lib/schema/production.schema");
function getProductionOrders(db, profileId) {
    return db.select().from(production_schema_1.productionOrders)
        .where((0, drizzle_orm_1.eq)(production_schema_1.productionOrders.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(production_schema_1.productionOrders.date))
        .all();
}
function getProductionOrderById(db, id) {
    return db.select().from(production_schema_1.productionOrders).where((0, drizzle_orm_1.eq)(production_schema_1.productionOrders.id, id)).get();
}
function createProductionOrder(db, data) {
    return db.insert(production_schema_1.productionOrders).values(data).returning().get();
}
function updateProductionOrder(db, id, data) {
    return db.update(production_schema_1.productionOrders).set(data).where((0, drizzle_orm_1.eq)(production_schema_1.productionOrders.id, id)).returning().get();
}
function deleteProductionOrder(db, id) {
    db.delete(production_schema_1.productionOrders).where((0, drizzle_orm_1.eq)(production_schema_1.productionOrders.id, id)).run();
}
