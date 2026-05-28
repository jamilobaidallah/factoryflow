"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPartnersHandlers = registerPartnersHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const partners_queries_1 = require("../queries/partners.queries");
function registerPartnersHandlers() {
    electron_1.ipcMain.handle('partners:getAll', (_, profileId) => (0, partners_queries_1.getPartners)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('partners:getActive', (_, profileId) => (0, partners_queries_1.getActivePartners)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('partners:getById', (_, id) => (0, partners_queries_1.getPartnerById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('partners:getByName', (_, profileId, name) => (0, partners_queries_1.getPartnerByName)((0, active_db_1.getActiveDb)(), profileId, name));
    electron_1.ipcMain.handle('partners:create', (_, data) => (0, partners_queries_1.createPartner)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('partners:update', (_, id, data) => (0, partners_queries_1.updatePartner)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('partners:delete', (_, id) => (0, partners_queries_1.deletePartner)((0, active_db_1.getActiveDb)(), id));
}
