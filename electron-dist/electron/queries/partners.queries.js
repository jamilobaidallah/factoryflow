"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPartners = getPartners;
exports.getActivePartners = getActivePartners;
exports.getPartnerById = getPartnerById;
exports.getPartnerByName = getPartnerByName;
exports.createPartner = createPartner;
exports.updatePartner = updatePartner;
exports.deletePartner = deletePartner;
const drizzle_orm_1 = require("drizzle-orm");
const partners_schema_1 = require("../../src/lib/schema/partners.schema");
function getPartners(db, profileId) {
    return db.select().from(partners_schema_1.partners)
        .where((0, drizzle_orm_1.eq)(partners_schema_1.partners.profileId, profileId))
        .orderBy((0, drizzle_orm_1.asc)(partners_schema_1.partners.name))
        .all();
}
function getActivePartners(db, profileId) {
    return db.select().from(partners_schema_1.partners)
        .where((0, drizzle_orm_1.eq)(partners_schema_1.partners.profileId, profileId))
        .orderBy((0, drizzle_orm_1.asc)(partners_schema_1.partners.name))
        .all()
        .filter(p => p.active);
}
function getPartnerById(db, id) {
    return db.select().from(partners_schema_1.partners).where((0, drizzle_orm_1.eq)(partners_schema_1.partners.id, id)).get();
}
function getPartnerByName(db, profileId, name) {
    return db.select().from(partners_schema_1.partners)
        .where((0, drizzle_orm_1.eq)(partners_schema_1.partners.profileId, profileId))
        .all()
        .find(p => p.name === name);
}
function createPartner(db, data) {
    return db.insert(partners_schema_1.partners).values(data).returning().get();
}
function updatePartner(db, id, data) {
    return db.update(partners_schema_1.partners).set(data).where((0, drizzle_orm_1.eq)(partners_schema_1.partners.id, id)).returning().get();
}
function deletePartner(db, id) {
    db.delete(partners_schema_1.partners).where((0, drizzle_orm_1.eq)(partners_schema_1.partners.id, id)).run();
}
