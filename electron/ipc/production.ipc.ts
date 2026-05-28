import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getProductionOrders, getProductionOrderById,
  createProductionOrder, updateProductionOrder, deleteProductionOrder,
  type NewProductionOrderRow,
} from '../queries/production.queries';

export function registerProductionHandlers(): void {
  ipcMain.handle('production:getAll', (_, profileId: string) =>
    getProductionOrders(getActiveDb(), profileId)
  );

  ipcMain.handle('production:getById', (_, id: string) =>
    getProductionOrderById(getActiveDb(), id)
  );

  ipcMain.handle('production:create', (_, data: NewProductionOrderRow) =>
    createProductionOrder(getActiveDb(), data)
  );

  ipcMain.handle('production:update', (_, id: string, data: Record<string, unknown>) =>
    updateProductionOrder(getActiveDb(), id, data)
  );

  ipcMain.handle('production:delete', (_, id: string) =>
    deleteProductionOrder(getActiveDb(), id)
  );
}
