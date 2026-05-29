"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFavoritesHandlers = registerFavoritesHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const favorites_queries_1 = require("../queries/favorites.queries");
function registerFavoritesHandlers() {
    electron_1.ipcMain.handle('favorites:getAll', (_, profileId) => (0, favorites_queries_1.getFavorites)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('favorites:getById', (_, id) => (0, favorites_queries_1.getFavoriteById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('favorites:create', (_, data) => (0, favorites_queries_1.createFavorite)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('favorites:update', (_, id, data) => (0, favorites_queries_1.updateFavorite)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('favorites:incrementUsage', (_, id) => (0, favorites_queries_1.incrementUsage)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('favorites:delete', (_, id) => (0, favorites_queries_1.deleteFavorite)((0, active_db_1.getActiveDb)(), id));
}
