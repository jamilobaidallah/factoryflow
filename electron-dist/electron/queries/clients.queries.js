"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getClients = getClients;
exports.searchClients = searchClients;
exports.getClientById = getClientById;
exports.createClient = createClient;
exports.updateClient = updateClient;
exports.deleteClient = deleteClient;
exports.updateClientBalance = updateClientBalance;
const drizzle_orm_1 = require("drizzle-orm");
const clients_schema_1 = require("../../src/lib/schema/clients.schema");
function getClients(db, profileId) {
    return db.select().from(clients_schema_1.clients)
        .where((0, drizzle_orm_1.eq)(clients_schema_1.clients.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(clients_schema_1.clients.createdAt))
        .all();
}
function searchClients(db, profileId, term) {
    return db.select().from(clients_schema_1.clients)
        .where((0, drizzle_orm_1.eq)(clients_schema_1.clients.profileId, profileId))
        .orderBy(clients_schema_1.clients.name)
        .all()
        .filter(c => c.name.toLowerCase().includes(term.toLowerCase()) ||
        c.phone.includes(term));
}
function getClientById(db, id) {
    return db.select().from(clients_schema_1.clients).where((0, drizzle_orm_1.eq)(clients_schema_1.clients.id, id)).get();
}
function createClient(db, data) {
    return db.insert(clients_schema_1.clients).values(data).returning().get();
}
function updateClient(db, id, data) {
    return db.update(clients_schema_1.clients).set(data).where((0, drizzle_orm_1.eq)(clients_schema_1.clients.id, id)).returning().get();
}
function deleteClient(db, id) {
    db.delete(clients_schema_1.clients).where((0, drizzle_orm_1.eq)(clients_schema_1.clients.id, id)).run();
}
function updateClientBalance(db, id, balance) {
    db.update(clients_schema_1.clients).set({ balance }).where((0, drizzle_orm_1.eq)(clients_schema_1.clients.id, id)).run();
}
