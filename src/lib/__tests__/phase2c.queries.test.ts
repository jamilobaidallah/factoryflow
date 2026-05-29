/**
 * @jest-environment node
 *
 * Phase 2c — Ledger & Journal Entries (CRITICAL)
 *
 * This is the most important test file in the project.
 * Includes the 1,000-entry HARD GATE test that must pass before Phase 3.
 *
 * Tests run against in-memory SQLite databases.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { applyMigrations } from '@/lib/database';
import * as schema from '@/lib/schema';

import {
  insertJournalEntry, getJournalEntries, getJournalEntryById,
  getLinesForJournalEntry, getJournalEntriesForTransaction,
  deleteJournalEntry, deleteJournalEntriesForTransaction,
  getTrialBalance, getTrialBalanceSummary,
  getAccountLedger, getBalanceSheet,
  getNextSequenceNumber,
} from '../../../electron/queries/journal.queries';

import {
  createLedgerEntry, getLedgerEntries, getLedgerEntryById,
  getLedgerEntryByTransactionId, getLedgerCount, getUnpaidARAPCount,
  deleteLedgerEntry, updateLedgerEntryMetadata, updateLedgerPaymentStatus,
  generateTransactionId,
} from '../../../electron/queries/ledger.queries';

import {
  resolveAccountMapping, ACCOUNTS,
} from '../../../electron/queries/account-mapping';

import { seedChartOfAccounts } from '@/lib/seed-coa';

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

const P = 'test-profile';
const NOW = '2025-06-15T10:00:00.000Z';

// ═════════════════════════════════════════════════════════════════════════════
// Section 1 — Journal entry primitives
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — insertJournalEntry: balance enforcement', () => {
  test('balanced entry (DR 500 = CR 500) is accepted', () => {
    const db = openTestDb();
    const result = insertJournalEntry(db,
      {
        profileId: P, date: NOW, description: 'Test',
        sourceType: 'ledger', createdAt: NOW,
      },
      [
        { accountCode: '1100', accountName: 'Cash', accountNameAr: 'النقدية', debit: 500, credit: 0 },
        { accountCode: '4010', accountName: 'Sales', accountNameAr: 'مبيعات', debit: 0,   credit: 500 },
      ]
    );
    expect(result.entry.id).toBeTruthy();
    expect(result.entry.entryNumber).toBe('JE-000001');
    expect(result.entry.sequenceNumber).toBe(1);
    expect(result.lines).toHaveLength(2);
  });

  test('unbalanced entry (DR 500 ≠ CR 300) is rejected and rolled back', () => {
    const db = openTestDb();
    expect(() => {
      insertJournalEntry(db,
        { profileId: P, date: NOW, description: 'Bad', sourceType: 'ledger', createdAt: NOW },
        [
          { accountCode: '1100', accountName: 'X', accountNameAr: 'X', debit: 500, credit: 0 },
          { accountCode: '4010', accountName: 'Y', accountNameAr: 'Y', debit: 0,   credit: 300 },
        ]
      );
    }).toThrow(/Unbalanced/);

    // Verify nothing persisted
    expect(getJournalEntries(db, P)).toHaveLength(0);
  });

  test('empty lines array is rejected', () => {
    const db = openTestDb();
    expect(() => {
      insertJournalEntry(db,
        { profileId: P, date: NOW, description: 'Empty', sourceType: 'ledger', createdAt: NOW },
        []
      );
    }).toThrow(/at least one line/);
  });

  test('zero amount entry is rejected', () => {
    const db = openTestDb();
    expect(() => {
      insertJournalEntry(db,
        { profileId: P, date: NOW, description: 'Zero', sourceType: 'ledger', createdAt: NOW },
        [
          { accountCode: '1100', accountName: 'X', accountNameAr: 'X', debit: 0, credit: 0 },
          { accountCode: '4010', accountName: 'Y', accountNameAr: 'Y', debit: 0, credit: 0 },
        ]
      );
    }).toThrow(/non-zero/);
  });

  test('compound entry (3 lines) balances correctly', () => {
    const db = openTestDb();
    const result = insertJournalEntry(db,
      { profileId: P, date: NOW, description: 'Compound', sourceType: 'manual', createdAt: NOW },
      [
        { accountCode: '5200', accountName: 'Salary',   accountNameAr: 'رواتب',        debit: 1000, credit: 0 },
        { accountCode: '1100', accountName: 'Cash',     accountNameAr: 'النقدية',      debit: 0,    credit: 800 },
        { accountCode: '2300', accountName: 'Accrued',  accountNameAr: 'مستحقات',     debit: 0,    credit: 200 },
      ]
    );
    expect(result.lines).toHaveLength(3);
    const tb = getTrialBalanceSummary(db, P);
    expect(tb.isBalanced).toBe(true);
  });

  test('floating-point fuzz within tolerance is accepted', () => {
    const db = openTestDb();
    // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
    expect(() => {
      insertJournalEntry(db,
        { profileId: P, date: NOW, description: 'Fuzz', sourceType: 'ledger', createdAt: NOW },
        [
          { accountCode: '1100', accountName: 'X', accountNameAr: 'X', debit: 0.1 + 0.2, credit: 0 },
          { accountCode: '4010', accountName: 'Y', accountNameAr: 'Y', debit: 0, credit: 0.3 },
        ]
      );
    }).not.toThrow();
  });

  test('sequence numbers are gapless and start at 1', () => {
    const db = openTestDb();
    const e1 = insertJournalEntry(db,
      { profileId: P, date: NOW, description: 'E1', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '1100', accountName: 'X', accountNameAr: 'X', debit: 100, credit: 0 },
        { accountCode: '4010', accountName: 'Y', accountNameAr: 'Y', debit: 0, credit: 100 },
      ]
    );
    const e2 = insertJournalEntry(db,
      { profileId: P, date: NOW, description: 'E2', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '1100', accountName: 'X', accountNameAr: 'X', debit: 200, credit: 0 },
        { accountCode: '4010', accountName: 'Y', accountNameAr: 'Y', debit: 0, credit: 200 },
      ]
    );
    expect(e1.entry.sequenceNumber).toBe(1);
    expect(e1.entry.entryNumber).toBe('JE-000001');
    expect(e2.entry.sequenceNumber).toBe(2);
    expect(e2.entry.entryNumber).toBe('JE-000002');
  });

  test('sequence numbers are isolated per profile', () => {
    const db = openTestDb();
    insertJournalEntry(db,
      { profileId: 'profile-A', date: NOW, description: 'A1', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '1100', accountName: 'X', accountNameAr: 'X', debit: 100, credit: 0 },
        { accountCode: '4010', accountName: 'Y', accountNameAr: 'Y', debit: 0, credit: 100 },
      ]
    );
    expect(getNextSequenceNumber(db, 'profile-A')).toBe(2);
    expect(getNextSequenceNumber(db, 'profile-B')).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 2 — Trial balance & reporting
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — Trial balance', () => {
  function seedThreeEntries(db: ReturnType<typeof openTestDb>) {
    insertJournalEntry(db,
      { profileId: P, date: NOW, description: 'Sale 1', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '1100', accountName: 'Cash',  accountNameAr: 'نقدية',  debit: 1000, credit: 0 },
        { accountCode: '4010', accountName: 'Sales', accountNameAr: 'مبيعات', debit: 0,    credit: 1000 },
      ]
    );
    insertJournalEntry(db,
      { profileId: P, date: NOW, description: 'Sale 2', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '1100', accountName: 'Cash',  accountNameAr: 'نقدية',  debit: 500, credit: 0 },
        { accountCode: '4010', accountName: 'Sales', accountNameAr: 'مبيعات', debit: 0,   credit: 500 },
      ]
    );
    insertJournalEntry(db,
      { profileId: P, date: NOW, description: 'Rent', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '5300', accountName: 'Rent', accountNameAr: 'إيجار', debit: 400, credit: 0 },
        { accountCode: '1100', accountName: 'Cash', accountNameAr: 'نقدية', debit: 0,   credit: 400 },
      ]
    );
  }

  test('aggregates debit/credit per account', () => {
    const db = openTestDb();
    seedThreeEntries(db);
    const tb = getTrialBalance(db, P);

    const cash = tb.find(r => r.accountCode === '1100')!;
    expect(cash.totalDebit).toBe(1500);  // 1000 + 500
    expect(cash.totalCredit).toBe(400);
    expect(cash.balance).toBe(1100);     // net DR

    const sales = tb.find(r => r.accountCode === '4010')!;
    expect(sales.totalCredit).toBe(1500);
    expect(sales.balance).toBe(-1500);   // net CR
  });

  test('summary reports balanced books', () => {
    const db = openTestDb();
    seedThreeEntries(db);
    const summary = getTrialBalanceSummary(db, P);
    expect(summary.totalDebits).toBe(1900);
    expect(summary.totalCredits).toBe(1900);
    expect(summary.isBalanced).toBe(true);
    expect(summary.difference).toBeLessThanOrEqual(0.001);
  });

  test('empty profile has zero balance', () => {
    const db = openTestDb();
    const summary = getTrialBalanceSummary(db, P);
    expect(summary.totalDebits).toBe(0);
    expect(summary.totalCredits).toBe(0);
    expect(summary.isBalanced).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 3 — Account ledger (running balance)
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — Account ledger running balance', () => {
  test('running balance is correct for cash account', () => {
    const db = openTestDb();
    insertJournalEntry(db,
      { profileId: P, date: '2025-01-01', description: 'Sale 1', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '1100', accountName: 'Cash',  accountNameAr: 'نقدية',  debit: 1000, credit: 0 },
        { accountCode: '4010', accountName: 'Sales', accountNameAr: 'مبيعات', debit: 0,    credit: 1000 },
      ]
    );
    insertJournalEntry(db,
      { profileId: P, date: '2025-01-02', description: 'Rent', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '5300', accountName: 'Rent', accountNameAr: 'إيجار', debit: 400, credit: 0 },
        { accountCode: '1100', accountName: 'Cash', accountNameAr: 'نقدية', debit: 0,   credit: 400 },
      ]
    );
    const cashLedger = getAccountLedger(db, P, '1100');
    expect(cashLedger).toHaveLength(2);
    expect(cashLedger[0].runningBalance).toBe(1000);
    expect(cashLedger[1].runningBalance).toBe(600);  // 1000 - 400
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 4 — Balance sheet
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — Balance sheet', () => {
  test('classifies accounts by type from chart of accounts', () => {
    const db = openTestDb();
    seedChartOfAccounts(db, P);

    // Owner contributes 10,000 cash
    insertJournalEntry(db,
      { profileId: P, date: NOW, description: 'Capital', sourceType: 'ledger', createdAt: NOW },
      [
        { accountCode: '1100', accountName: 'Cash',           accountNameAr: 'النقدية',     debit: 10000, credit: 0 },
        { accountCode: '3000', accountName: "Partners' Equity", accountNameAr: 'حقوق الشركاء', debit: 0,     credit: 10000 },
      ]
    );

    const bs = getBalanceSheet(db, P);
    expect(bs.assets.length).toBeGreaterThan(0);
    expect(bs.equity.length).toBeGreaterThan(0);
    expect(bs.totalAssets).toBe(10000);
    expect(bs.totalEquity).toBe(10000);
    // Accounting equation: Assets = Liabilities + Equity
    expect(bs.totalAssets).toBeCloseTo(bs.totalLiabilities + bs.totalEquity, 2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 5 — Account mapping logic
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — Account mapping', () => {
  test('cash sale: DR Cash, CR matching revenue account', () => {
    const m = resolveAccountMapping({
      type: 'دخل', category: 'مبيعات حجر مقطوع',
      isInstant: true, isInventoryPurchase: false, isReturnEntry: false, isCOGSReversal: false,
    });
    expect(m.debitAccount.code).toBe(ACCOUNTS.CASH.code);
    expect(m.creditAccount.code).toBe(ACCOUNTS.CUT_STONE_SALES.code);
  });

  test('credit sale: DR AR, CR revenue', () => {
    const m = resolveAccountMapping({
      type: 'دخل', category: 'مبيعات حجر مقطوع',
      isInstant: false, isInventoryPurchase: false, isReturnEntry: false, isCOGSReversal: false,
    });
    expect(m.debitAccount.code).toBe(ACCOUNTS.AR.code);
    expect(m.creditAccount.code).toBe(ACCOUNTS.CUT_STONE_SALES.code);
  });

  test('cash expense: DR expense, CR cash', () => {
    const m = resolveAccountMapping({
      type: 'مصروف', subCategory: 'إيجار محل',
      isInstant: true, isInventoryPurchase: false, isReturnEntry: false, isCOGSReversal: false,
    });
    expect(m.debitAccount.code).toBe(ACCOUNTS.RENT.code);
    expect(m.creditAccount.code).toBe(ACCOUNTS.CASH.code);
  });

  test('credit expense: DR expense, CR AP', () => {
    const m = resolveAccountMapping({
      type: 'مصروف', subCategory: 'إيجار محل',
      isInstant: false, isInventoryPurchase: false, isReturnEntry: false, isCOGSReversal: false,
    });
    expect(m.creditAccount.code).toBe(ACCOUNTS.AP.code);
  });

  test('inventory purchase: DR Inventory account, CR cash/AP', () => {
    const m = resolveAccountMapping({
      type: 'مصروف', subCategory: 'شراء حجر خام مستورد',
      isInstant: false, isInventoryPurchase: true, isReturnEntry: false, isCOGSReversal: false,
    });
    expect(m.debitAccount.code).toBe(ACCOUNTS.RAW_STONE.code);
    expect(m.creditAccount.code).toBe(ACCOUNTS.AP.code);
  });

  test('sales return (instant cash refund): DR Sales Returns, CR Cash', () => {
    const m = resolveAccountMapping({
      type: 'مردود', category: 'مردودات المبيعات',
      isInstant: true, isInventoryPurchase: false, isReturnEntry: true, isCOGSReversal: false,
    });
    expect(m.debitAccount.code).toBe(ACCOUNTS.SALES_RETURNS.code);
    expect(m.creditAccount.code).toBe(ACCOUNTS.CASH.code);
  });

  test('sales return (credit, refund pending): DR Sales Returns, CR AR', () => {
    const m = resolveAccountMapping({
      type: 'مردود', category: 'مردودات المبيعات',
      isInstant: false, isInventoryPurchase: false, isReturnEntry: true, isCOGSReversal: false,
    });
    expect(m.creditAccount.code).toBe(ACCOUNTS.AR.code);
  });

  test('capital contribution: DR Cash, CR Equity', () => {
    const m = resolveAccountMapping({
      type: 'حركة رأس مال', subCategory: 'رأس مال',
      isInstant: true, isInventoryPurchase: false, isReturnEntry: false, isCOGSReversal: false,
    });
    expect(m.debitAccount.code).toBe(ACCOUNTS.CASH.code);
    expect(m.creditAccount.code).toBe(ACCOUNTS.PARTNERS_EQUITY.code);
  });

  test('owner drawing: DR Equity, CR Cash', () => {
    const m = resolveAccountMapping({
      type: 'حركة رأس مال', subCategory: 'سحوبات',
      isInstant: true, isInventoryPurchase: false, isReturnEntry: false, isCOGSReversal: false,
    });
    expect(m.debitAccount.code).toBe(ACCOUNTS.PARTNERS_EQUITY.code);
    expect(m.creditAccount.code).toBe(ACCOUNTS.CASH.code);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 6 — createLedgerEntry end-to-end
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — createLedgerEntry creates ledger + journal atomically', () => {
  test('cash sale: ledger row, journal entry, lines all correct', () => {
    const db = openTestDb();
    const { ledger, journalId } = createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 5000,
      category: 'مبيعات حجر مقطوع', subCategory: '',
      associatedParty: 'عميل أ',
      date: NOW, description: 'بيع حجر',
      immediateSettlement: true,
    });

    expect(ledger.amount).toBe(5000);
    expect(ledger.paymentStatus).toBe('paid');
    expect(ledger.totalPaid).toBe(5000);
    expect(ledger.remainingBalance).toBe(0);

    const journal = getJournalEntryById(db, journalId)!;
    expect(journal.linkedTransactionId).toBe(ledger.transactionId);

    const lines = getLinesForJournalEntry(db, journalId);
    expect(lines).toHaveLength(2);
    const debitLine = lines.find(l => l.debit > 0)!;
    const creditLine = lines.find(l => l.credit > 0)!;
    expect(debitLine.accountCode).toBe('1100');   // Cash
    expect(debitLine.debit).toBe(5000);
    expect(creditLine.accountCode).toBe('4010');  // Cut Stone Sales
    expect(creditLine.credit).toBe(5000);
  });

  test('credit sale: paymentStatus=unpaid, remainingBalance=amount', () => {
    const db = openTestDb();
    const { ledger } = createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 3000,
      category: 'مبيعات حجر مقطوع',
      associatedParty: 'عميل ب', date: NOW,
      immediateSettlement: false,
    });
    expect(ledger.paymentStatus).toBe('unpaid');
    expect(ledger.remainingBalance).toBe(3000);
    expect(ledger.totalPaid).toBe(0);
    expect(ledger.isARAPEntry).toBe(true);
  });

  test('balance check still applies via createLedgerEntry', () => {
    const db = openTestDb();
    // Trick: we can't easily force imbalance via the public API,
    // so just verify books balance after creating multiple entries.
    createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 1000,
      category: 'مبيعات حجر مقطوع', date: NOW, immediateSettlement: true,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'مصروف', amount: 400,
      category: 'مصاريف تشغيلية', subCategory: 'إيجار محل', date: NOW, immediateSettlement: true,
    });
    expect(getTrialBalanceSummary(db, P).isBalanced).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 7 — deleteLedgerEntry cleans up journal entries
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — deleteLedgerEntry removes linked journals', () => {
  test('deleting ledger entry removes its journal entry and lines', () => {
    const db = openTestDb();
    const { ledger, journalId } = createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 800,
      category: 'مبيعات حجر مقطوع', date: NOW, immediateSettlement: true,
    });

    expect(getJournalEntryById(db, journalId)).toBeTruthy();
    expect(getLinesForJournalEntry(db, journalId)).toHaveLength(2);

    deleteLedgerEntry(db, ledger.id);

    expect(getLedgerEntryById(db, ledger.id)).toBeUndefined();
    expect(getJournalEntryById(db, journalId)).toBeUndefined();
    expect(getLinesForJournalEntry(db, journalId)).toHaveLength(0);
  });

  test('books remain balanced after deletion', () => {
    const db = openTestDb();
    const e1 = createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 1000, category: 'مبيعات حجر مقطوع',
      date: NOW, immediateSettlement: true,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'مصروف', amount: 200, category: 'مصاريف تشغيلية',
      subCategory: 'إيجار محل', date: NOW, immediateSettlement: true,
    });
    deleteLedgerEntry(db, e1.ledger.id);
    expect(getTrialBalanceSummary(db, P).isBalanced).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 8 — Payment status updates
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — Payment status updates', () => {
  test('updateLedgerPaymentStatus: partial → paid', () => {
    const db = openTestDb();
    const { ledger } = createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 1000, category: 'مبيعات حجر مقطوع',
      date: NOW, immediateSettlement: false,
    });
    // Partial
    let updated = updateLedgerPaymentStatus(db, ledger.id, 600, 0, 1000)!;
    expect(updated.paymentStatus).toBe('partial');
    expect(updated.remainingBalance).toBe(400);

    // Fully paid
    updated = updateLedgerPaymentStatus(db, ledger.id, 1000, 0, 1000)!;
    expect(updated.paymentStatus).toBe('paid');
    expect(updated.remainingBalance).toBe(0);
  });

  test('discount counts toward marking entry as paid', () => {
    const db = openTestDb();
    const { ledger } = createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 1000, category: 'مبيعات حجر مقطوع',
      date: NOW, immediateSettlement: false,
    });
    const updated = updateLedgerPaymentStatus(db, ledger.id, 950, 50, 1000)!;
    expect(updated.paymentStatus).toBe('paid');
    expect(updated.remainingBalance).toBe(0);
  });

  test('unpaid count tracks correctly', () => {
    const db = openTestDb();
    createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 1000, category: 'مبيعات حجر مقطوع',
      date: NOW, immediateSettlement: false,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 500, category: 'مبيعات حجر مقطوع',
      date: NOW, immediateSettlement: true,
    });
    expect(getUnpaidARAPCount(db, P)).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 9 — Profile isolation
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — Profile isolation', () => {
  test('two profiles share a database but have isolated entries', () => {
    const db = openTestDb();
    createLedgerEntry(db, {
      profileId: 'profile-1', type: 'دخل', amount: 1000,
      category: 'مبيعات حجر مقطوع', date: NOW, immediateSettlement: true,
    });
    createLedgerEntry(db, {
      profileId: 'profile-2', type: 'دخل', amount: 2000,
      category: 'مبيعات حجر مقطوع', date: NOW, immediateSettlement: true,
    });
    expect(getLedgerCount(db, 'profile-1')).toBe(1);
    expect(getLedgerCount(db, 'profile-2')).toBe(1);
    expect(getJournalEntries(db, 'profile-1')).toHaveLength(1);
    expect(getJournalEntries(db, 'profile-2')).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// Section 10 — HARD GATE: 1,000-entry trial balance test
// ═════════════════════════════════════════════════════════════════════════════

describe('Phase 2c — HARD GATE: 1,000-entry stress test', () => {
  const ACCOUNT_CODES = ['1100', '1200', '1300', '2100', '3000', '4010', '4020', '5100', '5200', '5300'];

  function randomAccount(): string {
    return ACCOUNT_CODES[Math.floor(Math.random() * ACCOUNT_CODES.length)]!;
  }

  function randomTwoDistinct(): [string, string] {
    const a = randomAccount();
    let b = randomAccount();
    while (b === a) { b = randomAccount(); }
    return [a, b];
  }

  test('1,000 random balanced entries: trial balance = 0', () => {
    const db = openTestDb();

    // Seed accounts so balance sheet can classify them
    seedChartOfAccounts(db, P);

    for (let i = 0; i < 1000; i++) {
      const amount = parseFloat((Math.random() * 10000 + 1).toFixed(2));
      const [accA, accB] = randomTwoDistinct();
      insertJournalEntry(db,
        {
          profileId: P,
          date: `2025-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-15`,
          description: `Random entry ${i}`,
          sourceType: 'ledger',
          createdAt: NOW,
        },
        [
          { accountCode: accA, accountName: `Acc ${accA}`, accountNameAr: `${accA}`, debit: amount, credit: 0 },
          { accountCode: accB, accountName: `Acc ${accB}`, accountNameAr: `${accB}`, debit: 0,      credit: amount },
        ]
      );
    }

    const summary = getTrialBalanceSummary(db, P);
    expect(summary.totalDebits).toBeCloseTo(summary.totalCredits, 2);
    expect(summary.difference).toBeLessThanOrEqual(0.01);
    expect(summary.isBalanced).toBe(true);
    expect(getJournalEntries(db, P, 5000)).toHaveLength(1000);
  });

  test('1,000 entries: every individual entry has DR = CR', () => {
    const db = openTestDb();

    for (let i = 0; i < 1000; i++) {
      const amount = parseFloat((Math.random() * 10000 + 1).toFixed(2));
      const [accA, accB] = ['1100', '4010'];
      insertJournalEntry(db,
        { profileId: P, date: NOW, description: `Entry ${i}`, sourceType: 'ledger', createdAt: NOW },
        [
          { accountCode: accA, accountName: 'X', accountNameAr: 'X', debit: amount, credit: 0 },
          { accountCode: accB, accountName: 'Y', accountNameAr: 'Y', debit: 0, credit: amount },
        ]
      );
    }

    const allEntries = getJournalEntries(db, P, 5000);
    for (const e of allEntries) {
      const lines = getLinesForJournalEntry(db, e.id);
      const totalDr = lines.reduce((s, l) => s + l.debit, 0);
      const totalCr = lines.reduce((s, l) => s + l.credit, 0);
      expect(Math.abs(totalDr - totalCr)).toBeLessThanOrEqual(0.001);
    }
  });

  test('mixed via createLedgerEntry: trial balance still zero', () => {
    const db = openTestDb();
    seedChartOfAccounts(db, P);

    // 500 income, 500 expense — exercises the full account-mapping path
    for (let i = 0; i < 500; i++) {
      createLedgerEntry(db, {
        profileId: P, type: 'دخل', amount: 100 + Math.random() * 1000,
        category: 'مبيعات حجر مقطوع', date: NOW, immediateSettlement: Math.random() > 0.5,
      });
    }
    for (let i = 0; i < 500; i++) {
      createLedgerEntry(db, {
        profileId: P, type: 'مصروف', amount: 50 + Math.random() * 500,
        category: 'مصاريف تشغيلية', subCategory: 'إيجار محل',
        date: NOW, immediateSettlement: Math.random() > 0.5,
      });
    }

    const summary = getTrialBalanceSummary(db, P);
    expect(summary.isBalanced).toBe(true);
    expect(getLedgerCount(db, P)).toBe(1000);
    expect(getJournalEntries(db, P, 5000)).toHaveLength(1000);
  });
});
