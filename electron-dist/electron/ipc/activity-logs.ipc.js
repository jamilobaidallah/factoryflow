"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerActivityLogsHandlers = registerActivityLogsHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const activity_logs_queries_1 = require("../queries/activity-logs.queries");
function registerActivityLogsHandlers() {
    electron_1.ipcMain.handle('activity:getAll', (_, profileId, limit) => (0, activity_logs_queries_1.getActivityLogs)((0, active_db_1.getActiveDb)(), profileId, limit));
    electron_1.ipcMain.handle('activity:getForModule', (_, profileId, module) => (0, activity_logs_queries_1.getActivityLogsForModule)((0, active_db_1.getActiveDb)(), profileId, module));
    electron_1.ipcMain.handle('activity:create', (_, data) => (0, activity_logs_queries_1.createActivityLog)((0, active_db_1.getActiveDb)(), data));
}
