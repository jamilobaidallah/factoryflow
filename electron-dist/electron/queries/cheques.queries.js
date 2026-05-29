"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCheques = getCheques;
exports.getChequesByStatus = getChequesByStatus;
exports.getChequesForClient = getChequesForClient;
exports.getChequeById = getChequeById;
exports.getChequeByLinkedTransaction = getChequeByLinkedTransaction;
exports.createCheque = createCheque;
exports.updateCheque = updateCheque;
exports.deleteCheque = deleteCheque;
const drizzle_orm_1 = require("drizzle-orm");
const cheques_schema_1 = require("../../src/lib/schema/cheques.schema");
function getCheques(db, profileId) {
    return db.select().from(cheques_schema_1.cheques)
        .where((0, drizzle_orm_1.eq)(cheques_schema_1.cheques.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(cheques_schema_1.cheques.dueDate))
        .all();
}
function getChequesByStatus(db, profileId, status) {
    return db.select().from(cheques_schema_1.cheques)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(cheques_schema_1.cheques.profileId, profileId), (0, drizzle_orm_1.eq)(cheques_schema_1.cheques.status, status)))
        .orderBy((0, drizzle_orm_1.desc)(cheques_schema_1.cheques.dueDate))
        .all();
}
function getChequesForClient(db, profileId, clientName) {
    return db.select().from(cheques_schema_1.cheques)
        .where((0, drizzle_orm_1.eq)(cheques_schema_1.cheques.profileId, profileId))
        .all()
        .filter(c => c.clientName === clientName);
}
function getChequeById(db, id) {
    return db.select().from(cheques_schema_1.cheques).where((0, drizzle_orm_1.eq)(cheques_schema_1.cheques.id, id)).get();
}
function getChequeByLinkedTransaction(db, transactionId) {
    return db.select().from(cheques_schema_1.cheques)
        .all()
        .find(c => c.linkedTransactionId === transactionId);
}
function createCheque(db, data) {
    return db.insert(cheques_schema_1.cheques).values(data).returning().get();
}
function updateCheque(db, id, data) {
    return db.update(cheques_schema_1.cheques).set(data).where((0, drizzle_orm_1.eq)(cheques_schema_1.cheques.id, id)).returning().get();
}
function deleteCheque(db, id) {
    db.delete(cheques_schema_1.cheques).where((0, drizzle_orm_1.eq)(cheques_schema_1.cheques.id, id)).run();
}
