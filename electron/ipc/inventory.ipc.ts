import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getInventoryItems, getInventoryItemById, createInventoryItem,
  updateInventoryItem, updateInventoryQuantity, deleteInventoryItem,
  getInventoryMovements, getMovementsForItem, createInventoryMovement,
  type NewInventoryRow, type NewInventoryMovementRow,
} from '../queries/inventory.queries';

export function registerInventoryHandlers(): void {
  ipcMain.handle('inventory:getAll', (_, profileId: string) =>
    getInventoryItems(getActiveDb(), profileId)
  );

  ipcMain.handle('inventory:getById', (_, id: string) =>
    getInventoryItemById(getActiveDb(), id)
  );

  ipcMain.handle('inventory:create', (_, data: NewInventoryRow) =>
    createInventoryItem(getActiveDb(), data)
  );

  ipcMain.handle('inventory:update', (_, id: string, data: Record<string, unknown>) =>
    updateInventoryItem(getActiveDb(), id, data)
  );

  ipcMain.handle('inventory:updateQuantity', (_, id: string, quantity: number) =>
    updateInventoryQuantity(getActiveDb(), id, quantity)
  );

  ipcMain.handle('inventory:delete', (_, id: string) =>
    deleteInventoryItem(getActiveDb(), id)
  );

  ipcMain.handle('inventory-movements:getAll', (_, profileId: string) =>
    getInventoryMovements(getActiveDb(), profileId)
  );

  ipcMain.handle('inventory-movements:getForItem', (_, itemId: string) =>
    getMovementsForItem(getActiveDb(), itemId)
  );

  ipcMain.handle('inventory-movements:create', (_, data: NewInventoryMovementRow) =>
    createInventoryMovement(getActiveDb(), data)
  );
}
