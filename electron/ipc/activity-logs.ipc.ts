import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getActivityLogs, getActivityLogsForModule, createActivityLog,
  type NewActivityLogRow,
} from '../queries/activity-logs.queries';

export function registerActivityLogsHandlers(): void {
  ipcMain.handle('activity:getAll', (_, profileId: string, limit?: number) =>
    getActivityLogs(getActiveDb(), profileId, limit)
  );

  ipcMain.handle('activity:getForModule', (_, profileId: string, module: string) =>
    getActivityLogsForModule(getActiveDb(), profileId, module)
  );

  ipcMain.handle('activity:create', (_, data: NewActivityLogRow) =>
    createActivityLog(getActiveDb(), data)
  );
}
