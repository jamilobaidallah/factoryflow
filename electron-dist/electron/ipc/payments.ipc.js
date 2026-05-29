"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerPaymentsHandlers = registerPaymentsHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const payments_queries_1 = require("../queries/payments.queries");
function registerPaymentsHandlers() {
    electron_1.ipcMain.handle('payments:getAll', (_, profileId) => (0, payments_queries_1.getPayments)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('payments:getById', (_, id) => (0, payments_queries_1.getPaymentById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('payments:createWithAllocations', (_, data) => (0, payments_queries_1.createPaymentWithAllocations)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('payments:update', (_, id, data) => (0, payments_queries_1.updatePayment)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('payments:delete', (_, id) => (0, payments_queries_1.deletePayment)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('allocations:getForPayment', (_, paymentId) => (0, payments_queries_1.getAllocationsForPayment)((0, active_db_1.getActiveDb)(), paymentId));
    electron_1.ipcMain.handle('allocations:getForTransaction', (_, transactionId) => (0, payments_queries_1.getAllocationsForTransaction)((0, active_db_1.getActiveDb)(), transactionId));
    electron_1.ipcMain.handle('allocations:create', (_, data) => (0, payments_queries_1.createAllocation)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('allocations:deleteForPayment', (_, paymentId) => (0, payments_queries_1.deleteAllocationsForPayment)((0, active_db_1.getActiveDb)(), paymentId));
}
