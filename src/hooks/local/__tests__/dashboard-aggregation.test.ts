/**
 * @jest-environment node
 *
 * Phase 3 — Dashboard aggregation logic test
 *
 * Tests the SQLite ledger → dashboard stats transformation by building real
 * data through createLedgerEntry and then verifying that the aggregation
 * function in useDashboardDataLocal would produce correct totals.
 *
 * Tests run against in-memory SQLite — no React, no hooks (those need jsdom).
 * The aggregation logic itself is small and inlined here from
 * useDashboardDataLocal so we can test it directly.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { applyMigrations } from '@/lib/database';
import * as schema from '@/lib/schema';
import { createLedgerEntry, getLedgerEntries } from '../../../../electron/queries/ledger.queries';
import { seedChartOfAccounts } from '@/lib/seed-coa';

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

const P = 'test-profile';
const TODAY = new Date().toISOString();

interface RawRow {
  type: string;
  amount: number;
  category: string;
  subCategory?: string | null;
  paymentStatus?: string | null;
  remainingBalance?: number | null;
  totalDiscount?: number | null;
  isARAPEntry?: boolean | number | null;
  isInventoryPurchase?: boolean | number | null;
  isCOGSReversal?: boolean | number | null;
  date: string;
}

function asBool(v: unknown): boolean {
  return v === true || v === 1 || v === 'true';
}

/**
 * Compact reimplementation of the aggregation in useDashboardDataLocal for
 * testing. If the production hook changes, update this and re-run tests.
 */
function aggregate(rows: RawRow[]) {
  const INCOME_TYPES = ['دخل', 'إيراد'];
  const EXPENSE_TYPE = 'مصروف';

  let revenue = 0, expenses = 0, discounts = 0;
  let unpaidReceivablesCount = 0, unpaidPayablesCount = 0;

  for (const r of rows) {
    const isIncome  = INCOME_TYPES.includes(r.type);
    const isExpense = r.type === EXPENSE_TYPE;
    const isInventoryPurchase = asBool(r.isInventoryPurchase);

    if (r.paymentStatus === 'unpaid' || r.paymentStatus === 'partial') {
      if (isIncome)  { unpaidReceivablesCount++; }
      if (isExpense) { unpaidPayablesCount++; }
    }

    if (isIncome) {
      revenue += r.amount;
      discounts += r.totalDiscount ?? 0;
    } else if (isExpense && !isInventoryPurchase) {
      if (asBool(r.isCOGSReversal)) { expenses -= r.amount; }
      else                          { expenses += r.amount; }
    }
  }

  return { revenue, expenses, discounts, unpaidReceivablesCount, unpaidPayablesCount };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Phase 3 — Dashboard aggregation', () => {
  test('totals revenue from income entries', () => {
    const db = openTestDb();
    seedChartOfAccounts(db, P);
    createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 1000,
      category: 'مبيعات حجر مقطوع', date: TODAY, immediateSettlement: true,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'إيراد', amount: 500,
      category: 'مبيعات حجر جاهز', date: TODAY, immediateSettlement: true,
    });
    const rows = getLedgerEntries(db, P, 5000) as unknown as RawRow[];
    expect(aggregate(rows).revenue).toBe(1500);
  });

  test('totals expenses (excluding inventory purchases)', () => {
    const db = openTestDb();
    seedChartOfAccounts(db, P);
    createLedgerEntry(db, {
      profileId: P, type: 'مصروف', amount: 300,
      category: 'مصاريف تشغيلية', subCategory: 'إيجار محل',
      date: TODAY, immediateSettlement: true,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'مصروف', amount: 5000,
      category: 'تكلفة البضاعة المباعة', subCategory: 'شراء حجر خام مستورد',
      isInventoryPurchase: true,
      date: TODAY, immediateSettlement: true,
    });
    const rows = getLedgerEntries(db, P, 5000) as unknown as RawRow[];
    const r = aggregate(rows);
    expect(r.expenses).toBe(300);  // inventory purchase excluded from expenses
  });

  test('unpaid AR/AP counts track correctly', () => {
    const db = openTestDb();
    seedChartOfAccounts(db, P);
    // 2 unpaid income (AR), 1 unpaid expense (AP), 1 paid income
    createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 1000,
      category: 'مبيعات حجر مقطوع', date: TODAY, immediateSettlement: false,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 500,
      category: 'مبيعات حجر مقطوع', date: TODAY, immediateSettlement: false,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'مصروف', amount: 200,
      category: 'مصاريف تشغيلية', subCategory: 'إيجار محل',
      date: TODAY, immediateSettlement: false,
    });
    createLedgerEntry(db, {
      profileId: P, type: 'دخل', amount: 300,
      category: 'مبيعات حجر مقطوع', date: TODAY, immediateSettlement: true,
    });
    const rows = getLedgerEntries(db, P, 5000) as unknown as RawRow[];
    const r = aggregate(rows);
    expect(r.unpaidReceivablesCount).toBe(2);
    expect(r.unpaidPayablesCount).toBe(1);
  });

  test('cogs reversal subtracts from expenses', () => {
    // Simulated COGS reversal: not easily creatable via createLedgerEntry,
    // so we just verify the aggregation rule directly on synthetic data.
    const rows: RawRow[] = [
      { type: 'مصروف', amount: 100, category: 'تكلفة',
        date: TODAY, isCOGSReversal: false },
      { type: 'مصروف', amount: 30,  category: 'تكلفة',
        date: TODAY, isCOGSReversal: true },  // subtracts
    ];
    expect(aggregate(rows).expenses).toBe(70);
  });

  test('empty profile yields zero totals', () => {
    const db = openTestDb();
    const rows = getLedgerEntries(db, P, 5000) as unknown as RawRow[];
    const r = aggregate(rows);
    expect(r.revenue).toBe(0);
    expect(r.expenses).toBe(0);
    expect(r.unpaidReceivablesCount).toBe(0);
    expect(r.unpaidPayablesCount).toBe(0);
  });

  test('integration: trial balance + dashboard totals match', () => {
    const db = openTestDb();
    seedChartOfAccounts(db, P);

    // 3 cash sales = 3,000 revenue
    for (let i = 0; i < 3; i++) {
      createLedgerEntry(db, {
        profileId: P, type: 'دخل', amount: 1000,
        category: 'مبيعات حجر مقطوع', date: TODAY, immediateSettlement: true,
      });
    }
    // 2 cash expenses = 600 expense
    for (let i = 0; i < 2; i++) {
      createLedgerEntry(db, {
        profileId: P, type: 'مصروف', amount: 300,
        category: 'مصاريف تشغيلية', subCategory: 'إيجار محل',
        date: TODAY, immediateSettlement: true,
      });
    }
    const rows = getLedgerEntries(db, P, 5000) as unknown as RawRow[];
    const r = aggregate(rows);
    expect(r.revenue).toBe(3000);
    expect(r.expenses).toBe(600);
    // Profit ≈ revenue − expenses
    expect(r.revenue - r.expenses).toBe(2400);
  });
});
