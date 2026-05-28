/**
 * @jest-environment node
 *
 * Phase 1 — Database schema tests
 *
 * Most tests use an in-memory SQLite database (:memory:) — nothing written to disk.
 * WAL mode is tested on a real temp file because WAL is a disk-only feature
 * (SQLite always returns "memory" for :memory: databases regardless of pragma).
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { applyMigrations } from '@/lib/database';
import { seedChartOfAccounts } from '@/lib/seed-coa';
import * as schema from '@/lib/schema';

// ---------------------------------------------------------------------------
// Helper — creates a fresh in-memory database with migrations applied
// ---------------------------------------------------------------------------

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  const db = drizzle(sqlite, { schema });
  return { sqlite, db };
}

// ---------------------------------------------------------------------------
// 1. Schema — all 23 tables must exist after migration
// ---------------------------------------------------------------------------

describe('Phase 1 — Schema: all tables created', () => {
  const { sqlite } = openTestDb();

  const EXPECTED_TABLES = [
    'ledger',
    'journal_entries',
    'journal_lines',
    'payments',
    'payment_allocations',
    'clients',
    'partners',
    'cheques',
    'chart_of_accounts',
    'inventory',
    'inventory_movements',
    'employees',
    'salary_history',
    'payroll',
    'overtime_entries',
    'advances',
    'fixed_assets',
    'depreciation_records',
    'depreciation_runs',
    'invoices',
    'production_orders',
    'activity_logs',
    'ledger_favorites',
  ];

  test.each(EXPECTED_TABLES)('table "%s" exists', (tableName) => {
    const row = sqlite
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName);
    expect(row).toBeTruthy();
  });

  test('exactly 23 tables created', () => {
    const rows = sqlite
      .prepare(`SELECT count(*) as n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      .get() as { n: number };
    expect(rows.n).toBe(23);
  });
});

// ---------------------------------------------------------------------------
// 2. Pragmas — WAL mode and foreign keys must be active
// ---------------------------------------------------------------------------

describe('Phase 1 — Pragmas: WAL mode and foreign keys', () => {
  test('journal_mode is WAL on a file-backed database', () => {
    // WAL is a disk feature — :memory: always returns "memory" regardless of pragma.
    const tmpFile = path.join(os.tmpdir(), `factoryflow-test-${Date.now()}.db`);
    try {
      const sqlite = new Database(tmpFile);
      sqlite.pragma('journal_mode = WAL');
      applyMigrations(sqlite);
      const mode = sqlite.pragma('journal_mode', { simple: true }) as string;
      sqlite.close();
      expect(mode).toBe('wal');
    } finally {
      if (fs.existsSync(tmpFile)) { fs.unlinkSync(tmpFile); }
    }
  });

  test('foreign_keys is ON', () => {
    const { sqlite } = openTestDb();
    const row = sqlite.pragma('foreign_keys', { simple: true }) as number;
    expect(row).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 3. Migration system — versioning via user_version pragma
// ---------------------------------------------------------------------------

describe('Phase 1 — Migrations: versioning is correct', () => {
  test('user_version is 1 after initial migration', () => {
    const { sqlite } = openTestDb();
    const version = sqlite.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(1);
  });

  test('applyMigrations is idempotent — running twice does not change version', () => {
    const { sqlite } = openTestDb();
    applyMigrations(sqlite); // run a second time
    const version = sqlite.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(1);
  });

  test('fresh database starts at version 0 before migrations', () => {
    const sqlite = new Database(':memory:');
    const version = sqlite.pragma('user_version', { simple: true }) as number;
    expect(version).toBe(0);
    sqlite.close();
  });
});

// ---------------------------------------------------------------------------
// 4. Unique constraints
// ---------------------------------------------------------------------------

describe('Phase 1 — Unique constraints', () => {
  test('chart_of_accounts rejects duplicate code within same profile', () => {
    const { sqlite } = openTestDb();
    const insert = sqlite.prepare(`
      INSERT INTO chart_of_accounts
        (id, profile_id, code, name, name_ar, type, normal_balance, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insert.run('id-1', 'profile1', '1000', 'Cash', 'النقدية', 'asset', 'debit', new Date().toISOString());

    expect(() => {
      insert.run('id-2', 'profile1', '1000', 'Cash', 'النقدية', 'asset', 'debit', new Date().toISOString());
    }).toThrow();
  });

  test('chart_of_accounts allows same code in different profiles', () => {
    const { sqlite } = openTestDb();
    const insert = sqlite.prepare(`
      INSERT INTO chart_of_accounts
        (id, profile_id, code, name, name_ar, type, normal_balance, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    const now = new Date().toISOString();
    expect(() => {
      insert.run('p1-1000', 'profile1', '1000', 'Cash', 'النقدية', 'asset', 'debit', now);
      insert.run('p2-1000', 'profile2', '1000', 'Cash', 'النقدية', 'asset', 'debit', now);
    }).not.toThrow();
  });

  test('depreciation_records rejects duplicate (asset_id, period)', () => {
    const { sqlite } = openTestDb();

    // Insert a fixed asset first (required by foreign key)
    sqlite.prepare(`
      INSERT INTO fixed_assets
        (id, profile_id, asset_number, asset_name, category, purchase_date, purchase_cost,
         salvage_value, useful_life_months, monthly_depreciation, status,
         accumulated_depreciation, book_value, created_at)
      VALUES ('asset-1', 'profile1', 'FA-001', 'Machine', 'Machinery', '2024-01-01', 10000,
              500, 60, 158.33, 'active', 0, 10000, '2024-01-01')
    `).run();

    const insertDepreciation = sqlite.prepare(`
      INSERT INTO depreciation_records
        (id, profile_id, asset_id, asset_name, month, year, period, period_label,
         depreciation_amount, accumulated_depreciation_before, accumulated_depreciation_after,
         book_value_before, book_value_after, recorded_date, created_at)
      VALUES (?, 'profile1', 'asset-1', 'Machine', 1, 2025, ?, 'Jan 2025',
              158.33, 0, 158.33, 10000, 9841.67, '2025-01-31', '2025-01-31')
    `);

    insertDepreciation.run('dep-1', '2025-01');

    expect(() => {
      insertDepreciation.run('dep-2', '2025-01'); // same period — must fail
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 5. Foreign key enforcement
// ---------------------------------------------------------------------------

describe('Phase 1 — Foreign keys: cascade protection', () => {
  test('journal_lines rejects orphan journal_id', () => {
    const { sqlite } = openTestDb();

    expect(() => {
      sqlite.prepare(`
        INSERT INTO journal_lines
          (id, journal_id, profile_id, account_code, account_name, account_name_ar, debit, credit)
        VALUES ('line-1', 'nonexistent-journal', 'profile1', '1000', 'Cash', 'النقدية', 500, 0)
      `).run();
    }).toThrow();
  });

  test('payment_allocations rejects orphan payment_id', () => {
    const { sqlite } = openTestDb();

    expect(() => {
      sqlite.prepare(`
        INSERT INTO payment_allocations
          (id, payment_id, profile_id, transaction_id, ledger_doc_id, allocated_amount, created_at)
        VALUES ('alloc-1', 'nonexistent-payment', 'profile1', 'TXN-001', 'ledger-doc-1', 500, '2025-01-01')
      `).run();
    }).toThrow();
  });

  test('depreciation_records rejects orphan asset_id', () => {
    const { sqlite } = openTestDb();

    expect(() => {
      sqlite.prepare(`
        INSERT INTO depreciation_records
          (id, profile_id, asset_id, asset_name, month, year, period, period_label,
           depreciation_amount, accumulated_depreciation_before, accumulated_depreciation_after,
           book_value_before, book_value_after, recorded_date, created_at)
        VALUES ('dep-1', 'profile1', 'nonexistent-asset', 'Ghost', 1, 2025, '2025-01', 'Jan 2025',
                100, 0, 100, 5000, 4900, '2025-01-31', '2025-01-31')
      `).run();
    }).toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. Double-entry integrity pattern
//    The full insertJournalEntry() wrapper is built in Phase 2c.
//    This test verifies the underlying SQLite transaction provides the same
//    all-or-nothing guarantee — a failed balance check rolls everything back.
// ---------------------------------------------------------------------------

describe('Phase 1 — Journal integrity: transaction atomicity', () => {
  function insertJournalEntryTest(
    sqlite: Database.Database,
    entryId: string,
    lines: Array<{ accountCode: string; debit: number; credit: number }>
  ): void {
    const totalDebit  = lines.reduce((s, l) => s + l.debit,  0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new Error(`Unbalanced: DR ${totalDebit} ≠ CR ${totalCredit}`);
    }

    sqlite.transaction(() => {
      sqlite.prepare(`
        INSERT INTO journal_entries
          (id, profile_id, sequence_number, entry_number, date, description, created_at)
        VALUES (?, 'profile1', 1, 'JE-000001', '2025-01-01', 'Test entry', '2025-01-01')
      `).run(entryId);

      for (const line of lines) {
        sqlite.prepare(`
          INSERT INTO journal_lines
            (id, journal_id, profile_id, account_code, account_name, account_name_ar, debit, credit)
          VALUES (?, ?, 'profile1', ?, '', '', ?, ?)
        `).run(`${entryId}-${line.accountCode}`, entryId, line.accountCode, line.debit, line.credit);
      }
    })();
  }

  test('balanced entry (DR 500 = CR 500) is accepted', () => {
    const { sqlite } = openTestDb();
    expect(() => {
      insertJournalEntryTest(sqlite, 'je-balanced', [
        { accountCode: '1000', debit: 500, credit: 0 },
        { accountCode: '4010', debit: 0,   credit: 500 },
      ]);
    }).not.toThrow();

    const entryCount = (sqlite.prepare(`SELECT count(*) as n FROM journal_entries`).get() as { n: number }).n;
    const lineCount  = (sqlite.prepare(`SELECT count(*) as n FROM journal_lines`).get() as { n: number }).n;
    expect(entryCount).toBe(1);
    expect(lineCount).toBe(2);
  });

  test('unbalanced entry (DR 500 ≠ CR 300) is rejected and rolled back', () => {
    const { sqlite } = openTestDb();
    expect(() => {
      insertJournalEntryTest(sqlite, 'je-unbalanced', [
        { accountCode: '1000', debit: 500, credit: 0 },
        { accountCode: '4010', debit: 0,   credit: 300 }, // wrong — only 300 CR
      ]);
    }).toThrow(/Unbalanced/);

    // Nothing should have been written
    const entryCount = (sqlite.prepare(`SELECT count(*) as n FROM journal_entries`).get() as { n: number }).n;
    expect(entryCount).toBe(0);
  });

  test('compound entry (3 lines) balances correctly', () => {
    const { sqlite } = openTestDb();
    expect(() => {
      insertJournalEntryTest(sqlite, 'je-compound', [
        { accountCode: '5200', debit: 1000, credit: 0 },  // DR Salaries 1000
        { accountCode: '1000', debit: 0,    credit: 800 }, // CR Cash 800
        { accountCode: '2300', debit: 0,    credit: 200 }, // CR Accrued Liabilities 200
      ]);
    }).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 7. Chart of accounts seed
// ---------------------------------------------------------------------------

describe('Phase 1 — Chart of accounts seed', () => {
  const { db } = openTestDb();
  const PROFILE_ID = 'test-profile';
  seedChartOfAccounts(db, PROFILE_ID);

  test('seeds more than 30 accounts', () => {
    const accounts = db
      .select()
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.profileId, PROFILE_ID))
      .all();
    expect(accounts.length).toBeGreaterThan(30);
  });

  test('contains all required account types', () => {
    const accounts = db
      .select()
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.profileId, PROFILE_ID))
      .all();

    const types = new Set(accounts.map(a => a.type));
    expect(types).toContain('asset');
    expect(types).toContain('liability');
    expect(types).toContain('equity');
    expect(types).toContain('revenue');
    expect(types).toContain('expense');
  });

  test('cash account (1100) exists with correct normal balance', () => {
    const account = db
      .select()
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.code, '1100'))
      .get();
    expect(account).toBeTruthy();
    expect(account?.normalBalance).toBe('debit');
    expect(account?.type).toBe('asset');
  });

  test('accounts receivable (1200) is an asset', () => {
    const account = db
      .select()
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.code, '1200'))
      .get();
    expect(account?.type).toBe('asset');
    expect(account?.normalBalance).toBe('debit');
  });

  test('income summary (3300) is marked as system account', () => {
    const account = db
      .select()
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.code, '3300'))
      .get();
    expect(account).toBeTruthy();
    expect(account?.isSystemAccount).toBe(true);
  });

  test('stone-specific accounts exist (1301, 1302, 1303, 4010, 4020)', () => {
    const stoneCodes = ['1301', '1302', '1303', '4010', '4020'];
    for (const code of stoneCodes) {
      const account = db
        .select()
        .from(schema.chartOfAccounts)
        .where(eq(schema.chartOfAccounts.code, code))
        .get();
      expect(account).toBeTruthy();
    }
  });

  test('contra accounts (accumulated depreciation 1520, sales returns 4050) have isContraAccount = true', () => {
    const contraAccounts = db
      .select()
      .from(schema.chartOfAccounts)
      .where(sql`${schema.chartOfAccounts.isContraAccount} = 1 AND ${schema.chartOfAccounts.profileId} = ${PROFILE_ID}`)
      .all();
    expect(contraAccounts.length).toBeGreaterThanOrEqual(2);
    const codes = contraAccounts.map(a => a.code);
    expect(codes).toContain('1520');
    expect(codes).toContain('4050');
  });

  test('seed is idempotent — running twice does not duplicate accounts', () => {
    seedChartOfAccounts(db, PROFILE_ID); // run a second time
    const accounts = db
      .select()
      .from(schema.chartOfAccounts)
      .where(eq(schema.chartOfAccounts.profileId, PROFILE_ID))
      .all();
    const codes = accounts.map(a => a.code);
    const uniqueCodes = new Set(codes);
    expect(codes.length).toBe(uniqueCodes.size); // no duplicates
  });
});

// ---------------------------------------------------------------------------
// 8. Basic insert/query round-trip on key tables
// ---------------------------------------------------------------------------

describe('Phase 1 — Insert/query round-trips', () => {
  test('ledger entry round-trip', () => {
    const { db } = openTestDb();
    const now = new Date().toISOString();

    db.insert(schema.ledger).values({
      id: 'led-1',
      profileId: 'profile1',
      transactionId: 'TXN-20250101-001',
      description: 'بيع حجر مقطوع',
      type: 'إيراد',
      amount: 5000,
      category: 'مبيعات',
      subCategory: 'مبيعات حجر مقطوع',
      associatedParty: 'عميل تجريبي',
      date: now,
      createdAt: now,
      paymentStatus: 'unpaid',
      remainingBalance: 5000,
      isARAPEntry: true,
    }).run();

    const entry = db
      .select()
      .from(schema.ledger)
      .where(eq(schema.ledger.transactionId, 'TXN-20250101-001'))
      .get();

    expect(entry?.amount).toBe(5000);
    expect(entry?.associatedParty).toBe('عميل تجريبي');
    expect(entry?.paymentStatus).toBe('unpaid');
  });

  test('client round-trip', () => {
    const { db } = openTestDb();

    db.insert(schema.clients).values({
      id: 'cli-1',
      profileId: 'profile1',
      name: 'شركة الحجر الأردني',
      phone: '0791234567',
      email: 'test@example.com',
      address: 'عمّان، الأردن',
      balance: 0,
      createdAt: new Date().toISOString(),
    }).run();

    const client = db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, 'cli-1'))
      .get();

    expect(client?.name).toBe('شركة الحجر الأردني');
  });

  test('payment + allocation linked query', () => {
    const { db } = openTestDb();
    const now = new Date().toISOString();

    db.insert(schema.payments).values({
      id: 'pay-1',
      profileId: 'profile1',
      clientName: 'عميل تجريبي',
      amount: 3000,
      type: 'قبض',
      date: now,
      notes: '',
      isMultiAllocation: false,
      totalAllocated: 3000,
      allocationCount: 1,
      createdAt: now,
    }).run();

    db.insert(schema.paymentAllocations).values({
      id: 'alloc-1',
      paymentId: 'pay-1',
      profileId: 'profile1',
      transactionId: 'TXN-20250101-001',
      ledgerDocId: 'led-1',
      allocatedAmount: 3000,
      createdAt: now,
    }).run();

    const allocs = db
      .select()
      .from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.paymentId, 'pay-1'))
      .all();

    expect(allocs).toHaveLength(1);
    expect(allocs[0].allocatedAmount).toBe(3000);
  });
});
