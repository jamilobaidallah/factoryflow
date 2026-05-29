"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerLedgerHandlers = registerLedgerHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const ledger_queries_1 = require("../queries/ledger.queries");
function registerLedgerHandlers() {
    electron_1.ipcMain.handle('ledger:getAll', (_, profileId, limit) => (0, ledger_queries_1.getLedgerEntries)((0, active_db_1.getActiveDb)(), profileId, limit));
    electron_1.ipcMain.handle('ledger:getById', (_, id) => (0, ledger_queries_1.getLedgerEntryById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('ledger:getByTransactionId', (_, transactionId) => (0, ledger_queries_1.getLedgerEntryByTransactionId)((0, active_db_1.getActiveDb)(), transactionId));
    electron_1.ipcMain.handle('ledger:count', (_, profileId) => (0, ledger_queries_1.getLedgerCount)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('ledger:unpaidARAPCount', (_, profileId) => (0, ledger_queries_1.getUnpaidARAPCount)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('ledger:create', (_, input) => (0, ledger_queries_1.createLedgerEntry)((0, active_db_1.getActiveDb)(), input));
    electron_1.ipcMain.handle('ledger:delete', (_, id) => (0, ledger_queries_1.deleteLedgerEntry)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('ledger:updateMetadata', (_, id, data) => (0, ledger_queries_1.updateLedgerEntryMetadata)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('ledger:updatePaymentStatus', (_, id, totalPaid, totalDiscount, amount) => (0, ledger_queries_1.updateLedgerPaymentStatus)((0, active_db_1.getActiveDb)(), id, totalPaid, totalDiscount, amount));
}
