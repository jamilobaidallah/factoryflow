"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInventoryHandlers = registerInventoryHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const inventory_queries_1 = require("../queries/inventory.queries");
function registerInventoryHandlers() {
    electron_1.ipcMain.handle('inventory:getAll', (_, profileId) => (0, inventory_queries_1.getInventoryItems)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('inventory:getById', (_, id) => (0, inventory_queries_1.getInventoryItemById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('inventory:create', (_, data) => (0, inventory_queries_1.createInventoryItem)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('inventory:update', (_, id, data) => (0, inventory_queries_1.updateInventoryItem)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('inventory:updateQuantity', (_, id, quantity) => (0, inventory_queries_1.updateInventoryQuantity)((0, active_db_1.getActiveDb)(), id, quantity));
    electron_1.ipcMain.handle('inventory:delete', (_, id) => (0, inventory_queries_1.deleteInventoryItem)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('inventory-movements:getAll', (_, profileId) => (0, inventory_queries_1.getInventoryMovements)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('inventory-movements:getForItem', (_, itemId) => (0, inventory_queries_1.getMovementsForItem)((0, active_db_1.getActiveDb)(), itemId));
    electron_1.ipcMain.handle('inventory-movements:create', (_, data) => (0, inventory_queries_1.createInventoryMovement)((0, active_db_1.getActiveDb)(), data));
}
