"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInvoicesHandlers = registerInvoicesHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const invoices_queries_1 = require("../queries/invoices.queries");
function registerInvoicesHandlers() {
    electron_1.ipcMain.handle('invoices:getAll', (_, profileId) => {
        const db = (0, active_db_1.getActiveDb)();
        (0, invoices_queries_1.markOverdueInvoices)(db, profileId); // auto-update overdue on fetch
        return (0, invoices_queries_1.getInvoices)(db, profileId);
    });
    electron_1.ipcMain.handle('invoices:getById', (_, id) => (0, invoices_queries_1.getInvoiceById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('invoices:create', (_, data) => (0, invoices_queries_1.createInvoice)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('invoices:update', (_, id, data) => (0, invoices_queries_1.updateInvoice)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('invoices:delete', (_, id) => (0, invoices_queries_1.deleteInvoice)((0, active_db_1.getActiveDb)(), id));
}
