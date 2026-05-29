"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPayments = getPayments;
exports.getPaymentById = getPaymentById;
exports.createPaymentWithAllocations = createPaymentWithAllocations;
exports.updatePayment = updatePayment;
exports.deletePayment = deletePayment;
exports.getAllocationsForPayment = getAllocationsForPayment;
exports.getAllocationsForTransaction = getAllocationsForTransaction;
exports.createAllocation = createAllocation;
exports.deleteAllocationsForPayment = deleteAllocationsForPayment;
const drizzle_orm_1 = require("drizzle-orm");
const payments_schema_1 = require("../../src/lib/schema/payments.schema");
const payments_schema_2 = require("../../src/lib/schema/payments.schema");
// ── Payments ─────────────────────────────────────────────────────────────────
function getPayments(db, profileId) {
    return db.select().from(payments_schema_1.payments)
        .where((0, drizzle_orm_1.eq)(payments_schema_1.payments.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(payments_schema_1.payments.date))
        .all();
}
function getPaymentById(db, id) {
    return db.select().from(payments_schema_1.payments).where((0, drizzle_orm_1.eq)(payments_schema_1.payments.id, id)).get();
}
/**
 * Create a payment and its allocations atomically.
 * If allocations fail, the payment is also rolled back.
 */
function createPaymentWithAllocations(db, { payment, allocations }) {
    // Drizzle's better-sqlite3 wrapper exposes the underlying transaction via the
    // synchronous transaction() callback. The callback runs inside a SAVEPOINT;
    // any thrown error rolls back the whole unit.
    return db.transaction((tx) => {
        const created = tx.insert(payments_schema_1.payments).values(payment).returning().get();
        for (const alloc of allocations) {
            tx.insert(payments_schema_2.paymentAllocations).values(alloc).run();
        }
        return created;
    });
}
function updatePayment(db, id, data) {
    return db.update(payments_schema_1.payments).set(data).where((0, drizzle_orm_1.eq)(payments_schema_1.payments.id, id)).returning().get();
}
function deletePayment(db, id) {
    // Cascade: remove allocations first (FK constraint)
    db.delete(payments_schema_2.paymentAllocations).where((0, drizzle_orm_1.eq)(payments_schema_2.paymentAllocations.paymentId, id)).run();
    db.delete(payments_schema_1.payments).where((0, drizzle_orm_1.eq)(payments_schema_1.payments.id, id)).run();
}
// ── Allocations ───────────────────────────────────────────────────────────────
function getAllocationsForPayment(db, paymentId) {
    return db.select().from(payments_schema_2.paymentAllocations)
        .where((0, drizzle_orm_1.eq)(payments_schema_2.paymentAllocations.paymentId, paymentId))
        .all();
}
function getAllocationsForTransaction(db, transactionId) {
    return db.select().from(payments_schema_2.paymentAllocations)
        .where((0, drizzle_orm_1.eq)(payments_schema_2.paymentAllocations.transactionId, transactionId))
        .all();
}
function createAllocation(db, data) {
    return db.insert(payments_schema_2.paymentAllocations).values(data).returning().get();
}
function deleteAllocationsForPayment(db, paymentId) {
    db.delete(payments_schema_2.paymentAllocations).where((0, drizzle_orm_1.eq)(payments_schema_2.paymentAllocations.paymentId, paymentId)).run();
}
