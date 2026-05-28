"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setActiveDb = setActiveDb;
exports.getActiveDb = getActiveDb;
exports.getActiveProfileId = getActiveProfileId;
exports.clearActiveDb = clearActiveDb;
let _db = null;
let _profileId = null;
function setActiveDb(db, profileId) {
    _db = db;
    _profileId = profileId;
}
function getActiveDb() {
    if (!_db) {
        throw new Error('No active database. Open a profile first.');
    }
    return _db;
}
function getActiveProfileId() {
    if (!_profileId) {
        throw new Error('No active profile. Open a profile first.');
    }
    return _profileId;
}
function clearActiveDb() {
    _db = null;
    _profileId = null;
}
