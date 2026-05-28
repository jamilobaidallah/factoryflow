"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProductionHandlers = registerProductionHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const production_queries_1 = require("../queries/production.queries");
function registerProductionHandlers() {
    electron_1.ipcMain.handle('production:getAll', (_, profileId) => (0, production_queries_1.getProductionOrders)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('production:getById', (_, id) => (0, production_queries_1.getProductionOrderById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('production:create', (_, data) => (0, production_queries_1.createProductionOrder)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('production:update', (_, id, data) => (0, production_queries_1.updateProductionOrder)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('production:delete', (_, id) => (0, production_queries_1.deleteProductionOrder)((0, active_db_1.getActiveDb)(), id));
}
