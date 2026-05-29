import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getCheques, getChequesByStatus, getChequesForClient,
  getChequeById, getChequeByLinkedTransaction,
  createCheque, updateCheque, deleteCheque,
  type NewChequeRow,
} from '../queries/cheques.queries';

export function registerChequesHandlers(): void {
  ipcMain.handle('cheques:getAll', (_, profileId: string) =>
    getCheques(getActiveDb(), profileId)
  );

  ipcMain.handle('cheques:getByStatus', (_, profileId: string, status: string) =>
    getChequesByStatus(getActiveDb(), profileId, status)
  );

  ipcMain.handle('cheques:getForClient', (_, profileId: string, clientName: string) =>
    getChequesForClient(getActiveDb(), profileId, clientName)
  );

  ipcMain.handle('cheques:getById', (_, id: string) =>
    getChequeById(getActiveDb(), id)
  );

  ipcMain.handle('cheques:getByLinkedTransaction', (_, transactionId: string) =>
    getChequeByLinkedTransaction(getActiveDb(), transactionId)
  );

  ipcMain.handle('cheques:create', (_, data: NewChequeRow) =>
    createCheque(getActiveDb(), data)
  );

  ipcMain.handle('cheques:update', (_, id: string, data: Record<string, unknown>) =>
    updateCheque(getActiveDb(), id, data)
  );

  ipcMain.handle('cheques:delete', (_, id: string) =>
    deleteCheque(getActiveDb(), id)
  );
}
