"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerFixedAssetsHandlers = registerFixedAssetsHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const fixed_assets_queries_1 = require("../queries/fixed-assets.queries");
function registerFixedAssetsHandlers() {
    // Fixed Assets
    electron_1.ipcMain.handle('fixed-assets:getAll', (_, profileId) => (0, fixed_assets_queries_1.getFixedAssets)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('fixed-assets:getById', (_, id) => (0, fixed_assets_queries_1.getFixedAssetById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('fixed-assets:create', (_, data) => (0, fixed_assets_queries_1.createFixedAsset)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('fixed-assets:update', (_, id, data) => (0, fixed_assets_queries_1.updateFixedAsset)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('fixed-assets:delete', (_, id) => (0, fixed_assets_queries_1.deleteFixedAsset)((0, active_db_1.getActiveDb)(), id));
    // Depreciation Records
    electron_1.ipcMain.handle('depreciation-records:getAll', (_, profileId) => (0, fixed_assets_queries_1.getDepreciationRecords)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('depreciation-records:getForAsset', (_, assetId) => (0, fixed_assets_queries_1.getDepreciationRecordsForAsset)((0, active_db_1.getActiveDb)(), assetId));
    electron_1.ipcMain.handle('depreciation-records:periodAlreadyDone', (_, assetId, period) => (0, fixed_assets_queries_1.periodAlreadyDepreciated)((0, active_db_1.getActiveDb)(), assetId, period));
    electron_1.ipcMain.handle('depreciation-records:create', (_, data) => (0, fixed_assets_queries_1.createDepreciationRecord)((0, active_db_1.getActiveDb)(), data));
    // Depreciation Runs
    electron_1.ipcMain.handle('depreciation-runs:getAll', (_, profileId) => (0, fixed_assets_queries_1.getDepreciationRuns)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('depreciation-runs:create', (_, data) => (0, fixed_assets_queries_1.createDepreciationRun)((0, active_db_1.getActiveDb)(), data));
}
