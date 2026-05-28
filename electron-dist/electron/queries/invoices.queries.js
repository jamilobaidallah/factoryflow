"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInvoices = getInvoices;
exports.getInvoiceById = getInvoiceById;
exports.createInvoice = createInvoice;
exports.updateInvoice = updateInvoice;
exports.markOverdueInvoices = markOverdueInvoices;
exports.deleteInvoice = deleteInvoice;
const drizzle_orm_1 = require("drizzle-orm");
const invoices_schema_1 = require("../../src/lib/schema/invoices.schema");
function getInvoices(db, profileId) {
    return db.select().from(invoices_schema_1.invoices)
        .where((0, drizzle_orm_1.eq)(invoices_schema_1.invoices.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(invoices_schema_1.invoices.invoiceDate))
        .all()
        .filter(i => i.status !== 'voided');
}
function getInvoiceById(db, id) {
    return db.select().from(invoices_schema_1.invoices).where((0, drizzle_orm_1.eq)(invoices_schema_1.invoices.id, id)).get();
}
function createInvoice(db, data) {
    return db.insert(invoices_schema_1.invoices).values(data).returning().get();
}
function updateInvoice(db, id, data) {
    return db.update(invoices_schema_1.invoices).set(data).where((0, drizzle_orm_1.eq)(invoices_schema_1.invoices.id, id)).returning().get();
}
function markOverdueInvoices(db, profileId) {
    const now = new Date().toISOString();
    const sentInvoices = db.select().from(invoices_schema_1.invoices)
        .where((0, drizzle_orm_1.eq)(invoices_schema_1.invoices.profileId, profileId))
        .all()
        .filter(i => i.status === 'sent' && i.dueDate < now);
    for (const inv of sentInvoices) {
        db.update(invoices_schema_1.invoices)
            .set({ status: 'overdue', updatedAt: now })
            .where((0, drizzle_orm_1.eq)(invoices_schema_1.invoices.id, inv.id))
            .run();
    }
}
function deleteInvoice(db, id) {
    db.delete(invoices_schema_1.invoices).where((0, drizzle_orm_1.eq)(invoices_schema_1.invoices.id, id)).run();
}
