import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getAccounts, getActiveAccounts, getAccountByCode, getAccountById,
  createAccount, updateAccount, deactivateAccount,
  findNextPartnerEquityCode,
  type NewAccountRow,
} from '../queries/chart-of-accounts.queries';

export function registerChartOfAccountsHandlers(): void {
  ipcMain.handle('coa:getAll', (_, profileId: string) =>
    getAccounts(getActiveDb(), profileId)
  );

  ipcMain.handle('coa:getActive', (_, profileId: string) =>
    getActiveAccounts(getActiveDb(), profileId)
  );

  ipcMain.handle('coa:getByCode', (_, profileId: string, code: string) =>
    getAccountByCode(getActiveDb(), profileId, code)
  );

  ipcMain.handle('coa:getById', (_, id: string) =>
    getAccountById(getActiveDb(), id)
  );

  ipcMain.handle('coa:create', (_, data: NewAccountRow) =>
    createAccount(getActiveDb(), data)
  );

  ipcMain.handle('coa:update', (_, id: string, data: Record<string, unknown>) =>
    updateAccount(getActiveDb(), id, data)
  );

  ipcMain.handle('coa:deactivate', (_, id: string) =>
    deactivateAccount(getActiveDb(), id)
  );

  ipcMain.handle('coa:findNextPartnerEquityCode', (_, profileId: string) =>
    findNextPartnerEquityCode(getActiveDb(), profileId)
  );
}
