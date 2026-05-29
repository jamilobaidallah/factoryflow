"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChequesHandlers = registerChequesHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const cheques_queries_1 = require("../queries/cheques.queries");
function registerChequesHandlers() {
    electron_1.ipcMain.handle('cheques:getAll', (_, profileId) => (0, cheques_queries_1.getCheques)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('cheques:getByStatus', (_, profileId, status) => (0, cheques_queries_1.getChequesByStatus)((0, active_db_1.getActiveDb)(), profileId, status));
    electron_1.ipcMain.handle('cheques:getForClient', (_, profileId, clientName) => (0, cheques_queries_1.getChequesForClient)((0, active_db_1.getActiveDb)(), profileId, clientName));
    electron_1.ipcMain.handle('cheques:getById', (_, id) => (0, cheques_queries_1.getChequeById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('cheques:getByLinkedTransaction', (_, transactionId) => (0, cheques_queries_1.getChequeByLinkedTransaction)((0, active_db_1.getActiveDb)(), transactionId));
    electron_1.ipcMain.handle('cheques:create', (_, data) => (0, cheques_queries_1.createCheque)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('cheques:update', (_, id, data) => (0, cheques_queries_1.updateCheque)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('cheques:delete', (_, id) => (0, cheques_queries_1.deleteCheque)((0, active_db_1.getActiveDb)(), id));
}
