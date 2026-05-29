"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerJournalHandlers = registerJournalHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const journal_queries_1 = require("../queries/journal.queries");
function registerJournalHandlers() {
    electron_1.ipcMain.handle('journal:create', (_, entry, lines) => (0, journal_queries_1.insertJournalEntry)((0, active_db_1.getActiveDb)(), entry, lines));
    electron_1.ipcMain.handle('journal:getAll', (_, profileId, limit) => (0, journal_queries_1.getJournalEntries)((0, active_db_1.getActiveDb)(), profileId, limit));
    electron_1.ipcMain.handle('journal:getById', (_, id) => (0, journal_queries_1.getJournalEntryById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('journal:getLines', (_, journalId) => (0, journal_queries_1.getLinesForJournalEntry)((0, active_db_1.getActiveDb)(), journalId));
    electron_1.ipcMain.handle('journal:getForTransaction', (_, transactionId) => (0, journal_queries_1.getJournalEntriesForTransaction)((0, active_db_1.getActiveDb)(), transactionId));
    electron_1.ipcMain.handle('journal:delete', (_, id) => (0, journal_queries_1.deleteJournalEntry)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('journal:deleteForTransaction', (_, transactionId) => (0, journal_queries_1.deleteJournalEntriesForTransaction)((0, active_db_1.getActiveDb)(), transactionId));
    electron_1.ipcMain.handle('reports:trialBalance', (_, profileId) => (0, journal_queries_1.getTrialBalance)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('reports:trialBalanceSummary', (_, profileId) => (0, journal_queries_1.getTrialBalanceSummary)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('reports:accountLedger', (_, profileId, accountCode) => (0, journal_queries_1.getAccountLedger)((0, active_db_1.getActiveDb)(), profileId, accountCode));
    electron_1.ipcMain.handle('reports:balanceSheet', (_, profileId) => (0, journal_queries_1.getBalanceSheet)((0, active_db_1.getActiveDb)(), profileId));
}
