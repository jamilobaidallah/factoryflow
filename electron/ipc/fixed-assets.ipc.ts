import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getFixedAssets, getFixedAssetById, createFixedAsset,
  updateFixedAsset, deleteFixedAsset,
  getDepreciationRecords, getDepreciationRecordsForAsset,
  periodAlreadyDepreciated, createDepreciationRecord,
  getDepreciationRuns, createDepreciationRun,
  type NewFixedAssetRow, type NewDepreciationRecordRow, type NewDepreciationRunRow,
} from '../queries/fixed-assets.queries';

export function registerFixedAssetsHandlers(): void {
  // Fixed Assets
  ipcMain.handle('fixed-assets:getAll', (_, profileId: string) =>
    getFixedAssets(getActiveDb(), profileId)
  );
  ipcMain.handle('fixed-assets:getById', (_, id: string) =>
    getFixedAssetById(getActiveDb(), id)
  );
  ipcMain.handle('fixed-assets:create', (_, data: NewFixedAssetRow) =>
    createFixedAsset(getActiveDb(), data)
  );
  ipcMain.handle('fixed-assets:update', (_, id: string, data: Record<string, unknown>) =>
    updateFixedAsset(getActiveDb(), id, data)
  );
  ipcMain.handle('fixed-assets:delete', (_, id: string) =>
    deleteFixedAsset(getActiveDb(), id)
  );

  // Depreciation Records
  ipcMain.handle('depreciation-records:getAll', (_, profileId: string) =>
    getDepreciationRecords(getActiveDb(), profileId)
  );
  ipcMain.handle('depreciation-records:getForAsset', (_, assetId: string) =>
    getDepreciationRecordsForAsset(getActiveDb(), assetId)
  );
  ipcMain.handle('depreciation-records:periodAlreadyDone',
    (_, assetId: string, period: string) =>
      periodAlreadyDepreciated(getActiveDb(), assetId, period)
  );
  ipcMain.handle('depreciation-records:create', (_, data: NewDepreciationRecordRow) =>
    createDepreciationRecord(getActiveDb(), data)
  );

  // Depreciation Runs
  ipcMain.handle('depreciation-runs:getAll', (_, profileId: string) =>
    getDepreciationRuns(getActiveDb(), profileId)
  );
  ipcMain.handle('depreciation-runs:create', (_, data: NewDepreciationRunRow) =>
    createDepreciationRun(getActiveDb(), data)
  );
}
