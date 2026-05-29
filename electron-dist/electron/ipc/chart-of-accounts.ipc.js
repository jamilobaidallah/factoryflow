"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerChartOfAccountsHandlers = registerChartOfAccountsHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const chart_of_accounts_queries_1 = require("../queries/chart-of-accounts.queries");
function registerChartOfAccountsHandlers() {
    electron_1.ipcMain.handle('coa:getAll', (_, profileId) => (0, chart_of_accounts_queries_1.getAccounts)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('coa:getActive', (_, profileId) => (0, chart_of_accounts_queries_1.getActiveAccounts)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('coa:getByCode', (_, profileId, code) => (0, chart_of_accounts_queries_1.getAccountByCode)((0, active_db_1.getActiveDb)(), profileId, code));
    electron_1.ipcMain.handle('coa:getById', (_, id) => (0, chart_of_accounts_queries_1.getAccountById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('coa:create', (_, data) => (0, chart_of_accounts_queries_1.createAccount)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('coa:update', (_, id, data) => (0, chart_of_accounts_queries_1.updateAccount)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('coa:deactivate', (_, id) => (0, chart_of_accounts_queries_1.deactivateAccount)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('coa:findNextPartnerEquityCode', (_, profileId) => (0, chart_of_accounts_queries_1.findNextPartnerEquityCode)((0, active_db_1.getActiveDb)(), profileId));
}
