/**
 * @jest-environment node
 *
 * Phase 6 — End-to-end migration runner tests.
 *
 * The runner is the integration point: every mapper, the journal split, the
 * payment allocation flatten, and the verification helpers all run together
 * here. The tests prove three things:
 *
 *   1. The happy path migrates a multi-collection export into SQLite and the
 *      verification checklist passes (trial balance = 0, counts match).
 *   2. Foreign-key ordering is correct (allocations land after payments, etc.)
 *   3. ANY failure aborts the whole migration — unbalanced journal entries
 *      and malformed JSON both leave the database empty.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { applyMigrations } from '@/lib/database';
import * as schema from '@/lib/schema';

import {
  runMigrationFromExports,
  runMigrationFromDirectory,
  loadExportsFromDirectory,
  type MigrationExports,
} from '../runner';

const PROFILE = 'factory1';
const FALLBACK = '2026-01-01T00:00:00.000Z';

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

// ── Fixture builder ────────────────────────────────────────────────────────────

/** A small but cross-linked fixture covering every collection the runner handles. */
function buildFixture(): MigrationExports {
  return {
    clients: [
      { id: 'cli-1', name: 'شركة الحجر الأردني', phone: '0791111111', balance: 0 },
      { id: 'cli-2', name: 'مؤسسة البناء',       phone: '0792222222', balance: 0 },
    ],
    partners: [
      {
        id: 'par-1', name: 'جميل', ownershipPercentage: 50,
        capitalAccountCode: '3100', drawingsAccountCode: '3110',
        joinDate: '2022-01-01T00:00:00Z',
      },
      {
        id: 'par-2', name: 'شكري', ownershipPercentage: 50,
        capitalAccountCode: '3120', drawingsAccountCode: '3130',
        joinDate: '2022-01-01T00:00:00Z',
      },
    ],
    employees: [
      { id: 'emp-1', name: 'أحمد', currentSalary: 600, hireDate: '2024-01-01T00:00:00Z' },
    ],
    inventory: [
      { id: 'inv-1', itemName: 'حجر خام', quantity: 100, unitPrice: 25, unit: 'متر' },
    ],
    ledger: [
      { id: 'led-1', transactionId: 'TXN-001', type: 'دخل', amount: 5000,
        category: 'مبيعات حجر مقطوع', associatedParty: 'شركة الحجر الأردني',
        date: '2025-04-01T00:00:00Z', paymentStatus: 'unpaid',
        remainingBalance: 5000, isARAPEntry: true },
      { id: 'led-2', transactionId: 'TXN-002', type: 'مصروف', amount: 500,
        category: 'مصاريف تشغيلية', subCategory: 'إيجار محل',
        date: '2025-04-02T00:00:00Z', paymentStatus: 'paid' },
    ],
    payments: [
      {
        id: 'pay-1', clientName: 'شركة الحجر الأردني',
        amount: 3000, type: 'قبض', date: '2025-04-10T00:00:00Z',
        isMultiAllocation: true, totalAllocated: 3000,
        allocationMethod: 'fifo', allocationCount: 1,
        allocations: [
          { id: 'alloc-1', transactionId: 'TXN-001',
            ledgerDocId: 'led-1', allocatedAmount: 3000,
            transactionDate: '2025-04-01T00:00:00Z' },
        ],
      },
    ],
    cheques: [
      { id: 'chq-1', chequeNumber: '12345', clientName: 'شركة الحجر الأردني',
        amount: 2000, type: 'incoming', status: 'معلق',
        linkedTransactionId: 'TXN-001', bankName: 'بنك الإسكان',
        issueDate: '2025-04-01T00:00:00Z', dueDate: '2025-06-01T00:00:00Z' },
    ],
    invoices: [
      { id: 'inv-101', invoiceNumber: 'INV-001', clientName: 'شركة الحجر الأردني',
        invoiceDate: '2025-04-01T00:00:00Z', dueDate: '2025-05-01T00:00:00Z',
        items: [{ description: 'حجر مقطوع', quantity: 10, unitPrice: 100, total: 1000 }],
        subtotal: 1000, taxRate: 0, taxAmount: 0, total: 1000 },
    ],
    journal_entries: [
      {
        id: 'je-1', entryNumber: 'JE-000001', date: '2025-04-01T00:00:00Z',
        description: 'بيع آجل', linkedTransactionId: 'TXN-001',
        lines: [
          { accountCode: '1200', accountName: 'AR', accountNameAr: 'الذمم المدينة',
            debit: 5000, credit: 0 },
          { accountCode: '4010', accountName: 'Sales', accountNameAr: 'مبيعات',
            debit: 0, credit: 5000 },
        ],
      },
      {
        id: 'je-2', entryNumber: 'JE-000002', date: '2025-04-02T00:00:00Z',
        description: 'إيجار', linkedTransactionId: 'TXN-002',
        lines: [
          { accountCode: '5300', accountName: 'Rent', accountNameAr: 'إيجار',
            debit: 500, credit: 0 },
          { accountCode: '1100', accountName: 'Cash', accountNameAr: 'النقدية',
            debit: 0, credit: 500 },
        ],
      },
      // Payment receipt: DR Cash 3000, CR AR 3000
      {
        id: 'je-3', entryNumber: 'JE-000003', date: '2025-04-10T00:00:00Z',
        description: 'تحصيل قبض', linkedPaymentId: 'pay-1',
        lines: [
          { accountCode: '1100', accountName: 'Cash', accountNameAr: 'النقدية',
            debit: 3000, credit: 0 },
          { accountCode: '1200', accountName: 'AR', accountNameAr: 'الذمم المدينة',
            debit: 0, credit: 3000 },
        ],
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Happy path: full migration from in-memory exports
// ─────────────────────────────────────────────────────────────────────────────

describe('runMigrationFromExports — happy path', () => {
  const db = openTestDb();
  const fixture = buildFixture();
  const result = runMigrationFromExports(db, fixture, { profileId: PROFILE, fallbackIso: FALLBACK });

  it('reports the exact insert counts per collection', () => {
    expect(result.inserted.clients).toBe(2);
    expect(result.inserted.partners).toBe(2);
    expect(result.inserted.employees).toBe(1);
    expect(result.inserted.inventory).toBe(1);
    expect(result.inserted.ledger).toBe(2);
    expect(result.inserted.payments).toBe(1);
    expect(result.inserted.payment_allocations).toBe(1);
    expect(result.inserted.cheques).toBe(1);
    expect(result.inserted.invoices).toBe(1);
    expect(result.inserted.journal_entries).toBe(3);
    expect(result.journal.linesInserted).toBe(6);
  });

  it('passes the verification checklist (counts + trial balance)', () => {
    expect(result.counts.every((c) => c.ok)).toBe(true);
    expect(result.trialBalance.isBalanced).toBe(true);
    expect(result.trialBalance.difference).toBeLessThanOrEqual(0.001);
  });

  it('preserves Firestore IDs as primary keys', () => {
    const cli = db.select().from(schema.clients).where(eq(schema.clients.id, 'cli-1')).get();
    expect(cli?.name).toBe('شركة الحجر الأردني');

    const led = db.select().from(schema.ledger).where(eq(schema.ledger.id, 'led-1')).get();
    expect(led?.transactionId).toBe('TXN-001');

    const je = db.select().from(schema.journalEntries).where(eq(schema.journalEntries.id, 'je-1')).get();
    expect(je?.entryNumber).toBe('JE-000001');
  });

  it('flattens payment allocations into the join table with the parent payment_id', () => {
    const allocs = db.select().from(schema.paymentAllocations)
      .where(eq(schema.paymentAllocations.paymentId, 'pay-1'))
      .all();
    expect(allocs).toHaveLength(1);
    expect(allocs[0].transactionId).toBe('TXN-001');
    expect(allocs[0].allocatedAmount).toBe(3000);
  });

  it('splits journal lines into separate rows linked to the parent entry', () => {
    const lines = db.select().from(schema.journalLines)
      .where(eq(schema.journalLines.journalId, 'je-1'))
      .all();
    expect(lines).toHaveLength(2);
    expect(lines.reduce((s, l) => s + l.debit, 0)).toBe(5000);
    expect(lines.reduce((s, l) => s + l.credit, 0)).toBe(5000);
  });

  it('produces a printable checklist string', () => {
    expect(result.checklist).toContain('Migration verification');
    expect(result.checklist).toContain('Trial balance');
    expect(result.checklist).toContain('✓');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Atomicity: unbalanced journal entry aborts the whole migration
// ─────────────────────────────────────────────────────────────────────────────

describe('runMigrationFromExports — atomicity guarantee', () => {
  it('aborts and leaves the database empty when a journal entry is unbalanced', () => {
    const db = openTestDb();
    const fixture = buildFixture();
    // Corrupt one entry: drop the credit side so DR ≠ CR.
    fixture.journal_entries![1].lines = [
      { accountCode: '5300', accountName: 'Rent', accountNameAr: 'إيجار',
        debit: 500, credit: 0 },
      { accountCode: '1100', accountName: 'Cash', accountNameAr: 'النقدية',
        debit: 0, credit: 300 },  // ← bad
    ];

    expect(() =>
      runMigrationFromExports(db, fixture, { profileId: PROFILE, fallbackIso: FALLBACK })
    ).toThrow(/unbalanced/);

    // Nothing committed: every table is empty.
    expect(db.select().from(schema.clients).all()).toHaveLength(0);
    expect(db.select().from(schema.ledger).all()).toHaveLength(0);
    expect(db.select().from(schema.payments).all()).toHaveLength(0);
    expect(db.select().from(schema.journalEntries).all()).toHaveLength(0);
    expect(db.select().from(schema.journalLines).all()).toHaveLength(0);
  });

  it('handles an empty export — writes nothing, reports zero counts', () => {
    const db = openTestDb();
    const result = runMigrationFromExports(db, {}, { profileId: PROFILE, fallbackIso: FALLBACK });

    expect(result.inserted.clients).toBe(0);
    expect(result.inserted.journal_entries).toBe(0);
    expect(result.trialBalance.isBalanced).toBe(true);
    expect(result.counts).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Directory loader: filesystem input
// ─────────────────────────────────────────────────────────────────────────────

describe('runMigrationFromDirectory', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ff-migration-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads JSON files from a directory and runs the migration', () => {
    const fixture = buildFixture();
    for (const [name, docs] of Object.entries(fixture)) {
      fs.writeFileSync(path.join(tmpDir, `${name}.json`), JSON.stringify(docs));
    }

    const db = openTestDb();
    const result = runMigrationFromDirectory(db, tmpDir, { profileId: PROFILE, fallbackIso: FALLBACK });

    expect(result.trialBalance.isBalanced).toBe(true);
    expect(result.inserted.clients).toBe(2);
    expect(result.inserted.journal_entries).toBe(3);
  });

  it('silently skips missing collection files', () => {
    // Only provide clients.json; everything else is missing.
    fs.writeFileSync(
      path.join(tmpDir, 'clients.json'),
      JSON.stringify([{ id: 'cli-only', name: 'Solo' }]),
    );
    const exports = loadExportsFromDirectory(tmpDir);

    expect(exports.clients).toHaveLength(1);
    expect(exports.partners).toBeUndefined();
    expect(exports.ledger).toBeUndefined();

    const db = openTestDb();
    const result = runMigrationFromExports(db, exports, { profileId: PROFILE, fallbackIso: FALLBACK });
    expect(result.inserted.clients).toBe(1);
    expect(result.inserted.partners).toBe(0);
  });

  it('throws a clear error on malformed JSON', () => {
    fs.writeFileSync(path.join(tmpDir, 'clients.json'), '{ not valid json');
    expect(() => loadExportsFromDirectory(tmpDir)).toThrow(/not valid JSON/);
  });

  it('throws when the JSON is not a top-level array', () => {
    fs.writeFileSync(path.join(tmpDir, 'clients.json'), JSON.stringify({ id: 'cli-1' }));
    expect(() => loadExportsFromDirectory(tmpDir)).toThrow(/top-level array/);
  });
});
