import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  insertJournalEntry,
  getJournalEntries, getJournalEntryById, getLinesForJournalEntry,
  getJournalEntriesForTransaction,
  deleteJournalEntry, deleteJournalEntriesForTransaction,
  getTrialBalance, getTrialBalanceSummary,
  getAccountLedger, getBalanceSheet,
  type NewJournalEntryRow, type NewJournalLineRow,
} from '../queries/journal.queries';

export function registerJournalHandlers(): void {
  ipcMain.handle('journal:create',
    (
      _,
      entry: Omit<NewJournalEntryRow, 'sequenceNumber' | 'entryNumber'>,
      lines: Omit<NewJournalLineRow, 'id' | 'journalId' | 'profileId'>[],
    ) => insertJournalEntry(getActiveDb(), entry, lines)
  );

  ipcMain.handle('journal:getAll', (_, profileId: string, limit?: number) =>
    getJournalEntries(getActiveDb(), profileId, limit)
  );

  ipcMain.handle('journal:getById', (_, id: string) =>
    getJournalEntryById(getActiveDb(), id)
  );

  ipcMain.handle('journal:getLines', (_, journalId: string) =>
    getLinesForJournalEntry(getActiveDb(), journalId)
  );

  ipcMain.handle('journal:getForTransaction', (_, transactionId: string) =>
    getJournalEntriesForTransaction(getActiveDb(), transactionId)
  );

  ipcMain.handle('journal:delete', (_, id: string) =>
    deleteJournalEntry(getActiveDb(), id)
  );

  ipcMain.handle('journal:deleteForTransaction', (_, transactionId: string) =>
    deleteJournalEntriesForTransaction(getActiveDb(), transactionId)
  );

  ipcMain.handle('reports:trialBalance', (_, profileId: string) =>
    getTrialBalance(getActiveDb(), profileId)
  );

  ipcMain.handle('reports:trialBalanceSummary', (_, profileId: string) =>
    getTrialBalanceSummary(getActiveDb(), profileId)
  );

  ipcMain.handle('reports:accountLedger', (_, profileId: string, accountCode: string) =>
    getAccountLedger(getActiveDb(), profileId, accountCode)
  );

  ipcMain.handle('reports:balanceSheet', (_, profileId: string) =>
    getBalanceSheet(getActiveDb(), profileId)
  );
}
