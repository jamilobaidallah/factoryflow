"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerClientsHandlers = registerClientsHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const clients_queries_1 = require("../queries/clients.queries");
function registerClientsHandlers() {
    electron_1.ipcMain.handle('clients:getAll', (_, profileId) => (0, clients_queries_1.getClients)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('clients:search', (_, profileId, term) => (0, clients_queries_1.searchClients)((0, active_db_1.getActiveDb)(), profileId, term));
    electron_1.ipcMain.handle('clients:getById', (_, id) => (0, clients_queries_1.getClientById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('clients:create', (_, data) => (0, clients_queries_1.createClient)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('clients:update', (_, id, data) => (0, clients_queries_1.updateClient)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('clients:updateBalance', (_, id, balance) => (0, clients_queries_1.updateClientBalance)((0, active_db_1.getActiveDb)(), id, balance));
    electron_1.ipcMain.handle('clients:delete', (_, id) => (0, clients_queries_1.deleteClient)((0, active_db_1.getActiveDb)(), id));
}
