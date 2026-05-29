"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFavorites = getFavorites;
exports.getFavoriteById = getFavoriteById;
exports.createFavorite = createFavorite;
exports.updateFavorite = updateFavorite;
exports.incrementUsage = incrementUsage;
exports.deleteFavorite = deleteFavorite;
const drizzle_orm_1 = require("drizzle-orm");
const favorites_schema_1 = require("../../src/lib/schema/favorites.schema");
function getFavorites(db, profileId) {
    return db.select().from(favorites_schema_1.ledgerFavorites)
        .where((0, drizzle_orm_1.eq)(favorites_schema_1.ledgerFavorites.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(favorites_schema_1.ledgerFavorites.usageCount))
        .all();
}
function getFavoriteById(db, id) {
    return db.select().from(favorites_schema_1.ledgerFavorites).where((0, drizzle_orm_1.eq)(favorites_schema_1.ledgerFavorites.id, id)).get();
}
function createFavorite(db, data) {
    return db.insert(favorites_schema_1.ledgerFavorites).values(data).returning().get();
}
function updateFavorite(db, id, data) {
    return db.update(favorites_schema_1.ledgerFavorites).set(data).where((0, drizzle_orm_1.eq)(favorites_schema_1.ledgerFavorites.id, id)).returning().get();
}
function incrementUsage(db, id) {
    const fav = getFavoriteById(db, id);
    if (!fav) {
        return;
    }
    db.update(favorites_schema_1.ledgerFavorites)
        .set({ usageCount: fav.usageCount + 1, lastUsedAt: new Date().toISOString() })
        .where((0, drizzle_orm_1.eq)(favorites_schema_1.ledgerFavorites.id, id))
        .run();
}
function deleteFavorite(db, id) {
    db.delete(favorites_schema_1.ledgerFavorites).where((0, drizzle_orm_1.eq)(favorites_schema_1.ledgerFavorites.id, id)).run();
}
