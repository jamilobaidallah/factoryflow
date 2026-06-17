import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getClients, searchClients, getClientById,
  createClient, updateClient, deleteClient, updateClientBalance,
  type NewClientRow,
} from '../queries/clients.queries';

export function registerClientsHandlers(): void {
  ipcMain.handle('clients:getAll', (_, profileId: string) =>
    getClients(getActiveDb(), profileId)
  );

  ipcMain.handle('clients:search', (_, profileId: string, term: string) =>
    searchClients(getActiveDb(), profileId, term)
  );

  ipcMain.handle('clients:getById', (_, id: string) =>
    getClientById(getActiveDb(), id)
  );

  ipcMain.handle('clients:create', (_, data: NewClientRow) =>
    createClient(getActiveDb(), data)
  );

  ipcMain.handle('clients:update', (_, id: string, data: Record<string, unknown>) =>
    updateClient(getActiveDb(), id, data)
  );

  ipcMain.handle('clients:updateBalance', (_, id: string, balance: number) =>
    updateClientBalance(getActiveDb(), id, balance)
  );

  ipcMain.handle('clients:delete', (_, id: string) =>
    deleteClient(getActiveDb(), id)
  );
}
