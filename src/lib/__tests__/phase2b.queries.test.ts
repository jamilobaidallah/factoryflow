/**
 * @jest-environment node
 *
 * Phase 2b — Query function tests for medium-complexity collections.
 *
 * Tests run against in-memory SQLite databases. Each describe block gets
 * a fresh database for full isolation.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { applyMigrations } from '@/lib/database';
import * as schema from '@/lib/schema';

import {
  getCheques, getChequesByStatus, getChequesForClient,
  getChequeById, getChequeByLinkedTransaction,
  createCheque, updateCheque, deleteCheque,
} from '../../../electron/queries/cheques.queries';
import {
  getPayments, getPaymentById,
  createPaymentWithAllocations, updatePayment, deletePayment,
  getAllocationsForPayment, getAllocationsForTransaction,
} from '../../../electron/queries/payments.queries';
import {
  getFixedAssets, getFixedAssetById, createFixedAsset,
  updateFixedAsset, deleteFixedAsset,
  getDepreciationRecords, getDepreciationRecordsForAsset,
  periodAlreadyDepreciated, createDepreciationRecord,
  getDepreciationRuns, createDepreciationRun,
} from '../../../electron/queries/fixed-assets.queries';
import {
  getAccounts, getActiveAccounts, getAccountByCode,
  createAccount, updateAccount, deactivateAccount,
  findNextPartnerEquityCode,
} from '../../../electron/queries/chart-of-accounts.queries';
import {
  getActivityLogs, getActivityLogsForModule, createActivityLog,
} from '../../../electron/queries/activity-logs.queries';
import {
  getFavorites, createFavorite, incrementUsage, deleteFavorite,
} from '../../../electron/queries/favorites.queries';

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

const NOW = new Date().toISOString();
const P = 'test-profile';

// ── Cheques ──────────────────────────────────────────────────────────────────

describe('Phase 2b — Cheques', () => {
  const db = openTestDb();

  test('create cheque → read back', () => {
    createCheque(db, {
      id: 'chq-1', profileId: P,
      chequeNumber: '12345', clientName: 'عميل أ', amount: 1000,
      type: 'incoming', status: 'معلق',
      linkedTransactionId: 'TXN-001',
      issueDate: '2025-01-01', dueDate: '2025-02-01',
      bankName: 'بنك الإسكان', notes: '', createdAt: NOW,
    });
    expect(getCheques(db, P)).toHaveLength(1);
  });

  test('getChequesByStatus filters correctly', () => {
    createCheque(db, {
      id: 'chq-2', profileId: P,
      chequeNumber: '12346', clientName: 'عميل ب', amount: 2000,
      type: 'incoming', status: 'تم الصرف',
      linkedTransactionId: 'TXN-002',
      issueDate: '2025-01-01', dueDate: '2025-02-15',
      bankName: 'بنك الإسكان', notes: '', createdAt: NOW,
    });
    expect(getChequesByStatus(db, P, 'معلق')).toHaveLength(1);
    expect(getChequesByStatus(db, P, 'تم الصرف')).toHaveLength(1);
    expect(getChequesByStatus(db, P, 'مرتجع')).toHaveLength(0);
  });

  test('getChequesForClient filters by client name', () => {
    expect(getChequesForClient(db, P, 'عميل أ')).toHaveLength(1);
    expect(getChequesForClient(db, P, 'عميل غير موجود')).toHaveLength(0);
  });

  test('getChequeByLinkedTransaction finds by TXN id', () => {
    const c = getChequeByLinkedTransaction(db, 'TXN-001');
    expect(c?.id).toBe('chq-1');
    expect(getChequeByLinkedTransaction(db, 'TXN-MISSING')).toBeUndefined();
  });

  test('updateCheque changes status to cashed', () => {
    updateCheque(db, 'chq-1', { status: 'تم الصرف', clearedDate: NOW });
    expect(getChequeById(db, 'chq-1')?.status).toBe('تم الصرف');
  });

  test('deleteCheque removes record', () => {
    deleteCheque(db, 'chq-2');
    expect(getCheques(db, P)).toHaveLength(1);
  });
});

// ── Payments + Allocations ───────────────────────────────────────────────────

describe('Phase 2b — Payments with Allocations', () => {
  const db = openTestDb();

  test('createPaymentWithAllocations is atomic', () => {
    createPaymentWithAllocations(db, {
      payment: {
        id: 'pay-1', profileId: P,
        clientName: 'عميل أ', amount: 5000, type: 'قبض',
        date: NOW, notes: '', isMultiAllocation: true,
        totalAllocated: 5000, allocationMethod: 'fifo',
        allocationCount: 2, createdAt: NOW,
      },
      allocations: [
        { id: 'alloc-1', paymentId: 'pay-1', profileId: P,
          transactionId: 'TXN-A', ledgerDocId: 'led-A',
          allocatedAmount: 3000, createdAt: NOW },
        { id: 'alloc-2', paymentId: 'pay-1', profileId: P,
          transactionId: 'TXN-B', ledgerDocId: 'led-B',
          allocatedAmount: 2000, createdAt: NOW },
      ],
    });
    expect(getPayments(db, P)).toHaveLength(1);
    expect(getAllocationsForPayment(db, 'pay-1')).toHaveLength(2);
  });

  test('failed allocation rolls back the payment too', () => {
    expect(() => {
      createPaymentWithAllocations(db, {
        payment: {
          id: 'pay-rollback', profileId: P,
          clientName: 'X', amount: 100, type: 'قبض',
          date: NOW, notes: '', createdAt: NOW,
        },
        allocations: [
          // Invalid: duplicate primary key id collides with existing alloc-1
          { id: 'alloc-1', paymentId: 'pay-rollback', profileId: P,
            transactionId: 'TXN-X', ledgerDocId: 'led-X',
            allocatedAmount: 100, createdAt: NOW },
        ],
      });
    }).toThrow();
    expect(getPaymentById(db, 'pay-rollback')).toBeUndefined();
  });

  test('getAllocationsForTransaction finds all allocations to a TXN', () => {
    expect(getAllocationsForTransaction(db, 'TXN-A')).toHaveLength(1);
    expect(getAllocationsForTransaction(db, 'TXN-A')[0].allocatedAmount).toBe(3000);
  });

  test('updatePayment changes notes', () => {
    updatePayment(db, 'pay-1', { notes: 'محدّث' });
    expect(getPaymentById(db, 'pay-1')?.notes).toBe('محدّث');
  });

  test('deletePayment cascades to allocations', () => {
    deletePayment(db, 'pay-1');
    expect(getPaymentById(db, 'pay-1')).toBeUndefined();
    expect(getAllocationsForPayment(db, 'pay-1')).toHaveLength(0);
  });
});

// ── Fixed Assets + Depreciation ──────────────────────────────────────────────

describe('Phase 2b — Fixed Assets & Depreciation', () => {
  const db = openTestDb();

  test('create asset → read back', () => {
    createFixedAsset(db, {
      id: 'asset-1', profileId: P,
      assetNumber: 'FA-001', assetName: 'آلة تقطيع',
      category: 'آلات ومعدات',
      purchaseDate: '2024-01-01', purchaseCost: 12000,
      salvageValue: 1200, usefulLifeMonths: 60,
      monthlyDepreciation: 180, status: 'active',
      accumulatedDepreciation: 0, bookValue: 12000,
      createdAt: NOW,
    });
    expect(getFixedAssets(db, P)).toHaveLength(1);
    expect(getFixedAssetById(db, 'asset-1')?.assetName).toBe('آلة تقطيع');
  });

  test('updateFixedAsset adjusts accumulated depreciation', () => {
    updateFixedAsset(db, 'asset-1', { accumulatedDepreciation: 360, bookValue: 11640 });
    const a = getFixedAssetById(db, 'asset-1');
    expect(a?.accumulatedDepreciation).toBe(360);
    expect(a?.bookValue).toBe(11640);
  });

  test('create depreciation record', () => {
    createDepreciationRecord(db, {
      id: 'dep-1', profileId: P, assetId: 'asset-1', assetName: 'آلة تقطيع',
      month: 1, year: 2025, period: '2025-01', periodLabel: 'Jan 2025',
      depreciationAmount: 180,
      accumulatedDepreciationBefore: 0, accumulatedDepreciationAfter: 180,
      bookValueBefore: 12000, bookValueAfter: 11820,
      recordedDate: '2025-01-31', createdAt: NOW,
    });
    expect(getDepreciationRecords(db, P)).toHaveLength(1);
  });

  test('periodAlreadyDepreciated returns true after recording', () => {
    expect(periodAlreadyDepreciated(db, 'asset-1', '2025-01')).toBe(true);
    expect(periodAlreadyDepreciated(db, 'asset-1', '2025-02')).toBe(false);
  });

  test('duplicate (asset_id, period) is rejected by UNIQUE constraint', () => {
    expect(() => {
      createDepreciationRecord(db, {
        id: 'dep-dup', profileId: P, assetId: 'asset-1', assetName: 'آلة تقطيع',
        month: 1, year: 2025, period: '2025-01', periodLabel: 'Jan 2025',
        depreciationAmount: 180,
        accumulatedDepreciationBefore: 180, accumulatedDepreciationAfter: 360,
        bookValueBefore: 11820, bookValueAfter: 11640,
        recordedDate: '2025-01-31', createdAt: NOW,
      });
    }).toThrow();
  });

  test('getDepreciationRecordsForAsset returns only records for that asset', () => {
    expect(getDepreciationRecordsForAsset(db, 'asset-1')).toHaveLength(1);
    expect(getDepreciationRecordsForAsset(db, 'nonexistent')).toHaveLength(0);
  });

  test('create depreciation run', () => {
    createDepreciationRun(db, {
      id: 'run-1', profileId: P, period: '2025-01',
      runDate: '2025-01-31', assetsCount: 1, totalDepreciation: 180,
      ledgerEntryId: 'JE-001', runType: 'global', createdAt: NOW,
    });
    expect(getDepreciationRuns(db, P)).toHaveLength(1);
  });

  test('deleteFixedAsset cascades to depreciation records', () => {
    deleteFixedAsset(db, 'asset-1');
    expect(getFixedAssetById(db, 'asset-1')).toBeUndefined();
    expect(getDepreciationRecordsForAsset(db, 'asset-1')).toHaveLength(0);
  });
});

// ── Chart of Accounts ────────────────────────────────────────────────────────

describe('Phase 2b — Chart of Accounts', () => {
  const db = openTestDb();

  test('create custom account', () => {
    createAccount(db, {
      id: 'acc-1', profileId: P, code: '5999', name: 'Other',
      nameAr: 'مصاريف أخرى', type: 'expense', normalBalance: 'debit',
      isActive: true, createdAt: NOW,
    });
    expect(getAccounts(db, P)).toHaveLength(1);
    expect(getAccountByCode(db, P, '5999')?.nameAr).toBe('مصاريف أخرى');
  });

  test('UNIQUE(profile_id, code) rejects duplicate code in same profile', () => {
    expect(() => {
      createAccount(db, {
        id: 'acc-dup', profileId: P, code: '5999', name: 'X',
        nameAr: 'مكرر', type: 'expense', normalBalance: 'debit',
        isActive: true, createdAt: NOW,
      });
    }).toThrow();
  });

  test('updateAccount sets updatedAt automatically', () => {
    updateAccount(db, 'acc-1', { nameAr: 'محدّث' });
    const a = getAccountByCode(db, P, '5999');
    expect(a?.nameAr).toBe('محدّث');
    expect(a?.updatedAt).toBeTruthy();
  });

  test('deactivateAccount excludes from active list', () => {
    deactivateAccount(db, 'acc-1');
    expect(getActiveAccounts(db, P)).toHaveLength(0);
    expect(getAccounts(db, P)).toHaveLength(1); // still in full list
  });

  test('findNextPartnerEquityCode returns 3100 when none used', () => {
    expect(findNextPartnerEquityCode(db, P)).toBe(3100);
  });

  test('findNextPartnerEquityCode advances when 3100/3110 taken', () => {
    createAccount(db, {
      id: 'p1-cap', profileId: P, code: '3100', name: 'P1 Capital',
      nameAr: 'رأس مال جميل', type: 'equity', normalBalance: 'credit',
      isActive: true, createdAt: NOW,
    });
    createAccount(db, {
      id: 'p1-draw', profileId: P, code: '3110', name: 'P1 Drawings',
      nameAr: 'سحوبات جميل', type: 'equity', normalBalance: 'debit',
      isContraAccount: true, isActive: true, createdAt: NOW,
    });
    expect(findNextPartnerEquityCode(db, P)).toBe(3120);
  });
});

// ── Activity Logs ────────────────────────────────────────────────────────────

describe('Phase 2b — Activity Logs', () => {
  const db = openTestDb();

  test('createActivityLog → read back', () => {
    createActivityLog(db, {
      id: 'log-1', profileId: P,
      action: 'create', module: 'ledger',
      description: 'أنشأ قيدًا',
      createdAt: NOW,
    });
    expect(getActivityLogs(db, P)).toHaveLength(1);
  });

  test('logs are sorted newest first', () => {
    const earlier = new Date(Date.now() - 1000).toISOString();
    const later   = new Date(Date.now() + 1000).toISOString();
    createActivityLog(db, {
      id: 'log-2', profileId: P, action: 'update', module: 'clients',
      description: 'حدّث عميلًا', createdAt: earlier,
    });
    createActivityLog(db, {
      id: 'log-3', profileId: P, action: 'delete', module: 'ledger',
      description: 'حذف قيدًا', createdAt: later,
    });
    const all = getActivityLogs(db, P);
    expect(all[0].id).toBe('log-3');
    expect(all[all.length - 1].id).toBe('log-2');
  });

  test('getActivityLogsForModule filters by module', () => {
    expect(getActivityLogsForModule(db, P, 'ledger')).toHaveLength(2);
    expect(getActivityLogsForModule(db, P, 'clients')).toHaveLength(1);
    expect(getActivityLogsForModule(db, P, 'unknown')).toHaveLength(0);
  });

  test('limit parameter respected', () => {
    expect(getActivityLogs(db, P, 1)).toHaveLength(1);
    expect(getActivityLogs(db, P, 100)).toHaveLength(3);
  });
});

// ── Favorites ────────────────────────────────────────────────────────────────

describe('Phase 2b — Favorites', () => {
  const db = openTestDb();

  test('create favorite → read back', () => {
    createFavorite(db, {
      id: 'fav-1', profileId: P, name: 'إيجار شهري',
      type: 'مصروف', amount: 500, category: 'إيجار',
      subCategory: 'إيجار محل', associatedParty: 'صاحب الملك',
      usageCount: 0, createdAt: NOW,
    });
    expect(getFavorites(db, P)).toHaveLength(1);
  });

  test('incrementUsage updates counter and timestamp', () => {
    incrementUsage(db, 'fav-1');
    incrementUsage(db, 'fav-1');
    incrementUsage(db, 'fav-1');
    const f = getFavorites(db, P)[0];
    expect(f.usageCount).toBe(3);
    expect(f.lastUsedAt).toBeTruthy();
  });

  test('favorites sorted by usageCount descending', () => {
    createFavorite(db, {
      id: 'fav-2', profileId: P, name: 'كهرباء',
      type: 'مصروف', amount: 100, category: 'مرافق',
      subCategory: 'كهرباء', associatedParty: 'شركة الكهرباء',
      usageCount: 10, createdAt: NOW,
    });
    const sorted = getFavorites(db, P);
    expect(sorted[0].id).toBe('fav-2'); // usageCount=10
    expect(sorted[1].id).toBe('fav-1'); // usageCount=3
  });

  test('incrementUsage on missing id is a no-op', () => {
    expect(() => incrementUsage(db, 'nonexistent')).not.toThrow();
  });

  test('delete favorite', () => {
    deleteFavorite(db, 'fav-1');
    expect(getFavorites(db, P)).toHaveLength(1);
  });
});
