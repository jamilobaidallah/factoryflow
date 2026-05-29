import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getInvoices, getInvoiceById, createInvoice,
  updateInvoice, markOverdueInvoices, deleteInvoice,
  type NewInvoiceRow,
} from '../queries/invoices.queries';

export function registerInvoicesHandlers(): void {
  ipcMain.handle('invoices:getAll', (_, profileId: string) => {
    const db = getActiveDb();
    markOverdueInvoices(db, profileId); // auto-update overdue on fetch
    return getInvoices(db, profileId);
  });

  ipcMain.handle('invoices:getById', (_, id: string) =>
    getInvoiceById(getActiveDb(), id)
  );

  ipcMain.handle('invoices:create', (_, data: NewInvoiceRow) =>
    createInvoice(getActiveDb(), data)
  );

  ipcMain.handle('invoices:update', (_, id: string, data: Record<string, unknown>) =>
    updateInvoice(getActiveDb(), id, data)
  );

  ipcMain.handle('invoices:delete', (_, id: string) =>
    deleteInvoice(getActiveDb(), id)
  );
}
