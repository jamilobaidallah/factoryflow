import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getLedgerEntries, getLedgerEntryById, getLedgerEntryByTransactionId,
  getLedgerCount, getUnpaidARAPCount,
  createLedgerEntry, deleteLedgerEntry,
  updateLedgerEntryMetadata, updateLedgerPaymentStatus,
  type LedgerFormInput,
} from '../queries/ledger.queries';

export function registerLedgerHandlers(): void {
  ipcMain.handle('ledger:getAll', (_, profileId: string, limit?: number) =>
    getLedgerEntries(getActiveDb(), profileId, limit)
  );

  ipcMain.handle('ledger:getById', (_, id: string) =>
    getLedgerEntryById(getActiveDb(), id)
  );

  ipcMain.handle('ledger:getByTransactionId', (_, transactionId: string) =>
    getLedgerEntryByTransactionId(getActiveDb(), transactionId)
  );

  ipcMain.handle('ledger:count', (_, profileId: string) =>
    getLedgerCount(getActiveDb(), profileId)
  );

  ipcMain.handle('ledger:unpaidARAPCount', (_, profileId: string) =>
    getUnpaidARAPCount(getActiveDb(), profileId)
  );

  ipcMain.handle('ledger:create', (_, input: LedgerFormInput) =>
    createLedgerEntry(getActiveDb(), input)
  );

  ipcMain.handle('ledger:delete', (_, id: string) =>
    deleteLedgerEntry(getActiveDb(), id)
  );

  ipcMain.handle('ledger:updateMetadata',
    (_, id: string, data: Record<string, unknown>) =>
      updateLedgerEntryMetadata(getActiveDb(), id, data)
  );

  ipcMain.handle('ledger:updatePaymentStatus',
    (_, id: string, totalPaid: number, totalDiscount: number, amount: number) =>
      updateLedgerPaymentStatus(getActiveDb(), id, totalPaid, totalDiscount, amount)
  );
}
