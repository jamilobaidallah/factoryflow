import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getPartners, getActivePartners, getPartnerById, getPartnerByName,
  createPartner, updatePartner, deletePartner,
  type NewPartnerRow,
} from '../queries/partners.queries';

export function registerPartnersHandlers(): void {
  ipcMain.handle('partners:getAll', (_, profileId: string) =>
    getPartners(getActiveDb(), profileId)
  );

  ipcMain.handle('partners:getActive', (_, profileId: string) =>
    getActivePartners(getActiveDb(), profileId)
  );

  ipcMain.handle('partners:getById', (_, id: string) =>
    getPartnerById(getActiveDb(), id)
  );

  ipcMain.handle('partners:getByName', (_, profileId: string, name: string) =>
    getPartnerByName(getActiveDb(), profileId, name)
  );

  ipcMain.handle('partners:create', (_, data: NewPartnerRow) =>
    createPartner(getActiveDb(), data)
  );

  ipcMain.handle('partners:update', (_, id: string, data: Record<string, unknown>) =>
    updatePartner(getActiveDb(), id, data)
  );

  ipcMain.handle('partners:delete', (_, id: string) =>
    deletePartner(getActiveDb(), id)
  );
}
