import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getFavorites, getFavoriteById, createFavorite,
  updateFavorite, incrementUsage, deleteFavorite,
  type NewFavoriteRow,
} from '../queries/favorites.queries';

export function registerFavoritesHandlers(): void {
  ipcMain.handle('favorites:getAll', (_, profileId: string) =>
    getFavorites(getActiveDb(), profileId)
  );

  ipcMain.handle('favorites:getById', (_, id: string) =>
    getFavoriteById(getActiveDb(), id)
  );

  ipcMain.handle('favorites:create', (_, data: NewFavoriteRow) =>
    createFavorite(getActiveDb(), data)
  );

  ipcMain.handle('favorites:update', (_, id: string, data: Record<string, unknown>) =>
    updateFavorite(getActiveDb(), id, data)
  );

  ipcMain.handle('favorites:incrementUsage', (_, id: string) =>
    incrementUsage(getActiveDb(), id)
  );

  ipcMain.handle('favorites:delete', (_, id: string) =>
    deleteFavorite(getActiveDb(), id)
  );
}
