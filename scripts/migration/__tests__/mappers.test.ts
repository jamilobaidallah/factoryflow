/**
 * @jest-environment node
 *
 * Phase 6 — Per-collection mapper tests.
 *
 * Two layers of test, mirroring the import.ts approach:
 *
 *  1. Pure unit tests for each mapper — verifying field-by-field that a
 *     Firestore-shaped document becomes the expected SQLite insert row,
 *     including the tricky conversions (dates → UTC ISO, booleans coerced from
 *     truthy values, JSON-encoded array columns, the optional-default columns
 *     left undefined so Drizzle uses the schema default).
 *
 *  2. An integration round-trip per collection — insert a mapped row into a
 *     real in-memory SQLite database and read it back, proving the mapper
 *     produces shapes the schema actually accepts.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { applyMigrations } from '@/lib/database';
import * as schema from '@/lib/schema';

import {
  mapClient,
  mapPartner,
  mapCheque,
  mapPayment,
  mapLedger,
  mapInventoryItem,
  mapEmployee,
  mapInvoice,
  mapMany,
} from '../mappers';

const PROFILE = 'factory1';
const FALLBACK = '2026-01-01T00:00:00.000Z';
const OPTS = { profileId: PROFILE, fallbackIso: FALLBACK };

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

// ── Clients ────────────────────────────────────────────────────────────────────

describe('mapClient', () => {
  it('maps a complete client document', () => {
    const row = mapClient(
      {
        id: 'cli-1',
        name: 'شركة الحجر الأردني',
        phone: '0791234567',
        email: 'info@stone.jo',
        address: 'عمّان',
        balance: 1500.5,
        createdAt: { seconds: 1779062400 },
      },
      OPTS,
    );

    expect(row.id).toBe('cli-1');
    expect(row.profileId).toBe(PROFILE);
    expect(row.name).toBe('شركة الحجر الأردني');
    expect(row.phone).toBe('0791234567');
    expect(row.balance).toBe(1500.5);
    expect(row.createdAt).toBe(new Date(1779062400_000).toISOString());
  });

  it('falls back gracefully for missing fields', () => {
    const row = mapClient({ id: 'cli-2' }, OPTS);
    expect(row.name).toBe('(no name)');
    expect(row.phone).toBe('');
    expect(row.email).toBe('');
    expect(row.balance).toBe(0);
    expect(row.createdAt).toBe(FALLBACK);
  });

  it('round-trips through a real SQLite insert/select', () => {
    const db = openTestDb();
    const row = mapClient({ id: 'cli-3', name: 'Test' }, OPTS);
    db.insert(schema.clients).values(row).run();
    const read = db.select().from(schema.clients).where(eq(schema.clients.id, 'cli-3')).get();
    expect(read?.name).toBe('Test');
    expect(read?.profileId).toBe(PROFILE);
  });
});

// ── Partners ───────────────────────────────────────────────────────────────────

describe('mapPartner', () => {
  it('maps equity account codes and active flag', () => {
    const row = mapPartner(
      {
        id: 'par-1',
        name: 'جميل',
        ownershipPercentage: 50,
        initialInvestment: 52566,
        joinDate: '2022-01-01T00:00:00Z',
        active: true,
        capitalAccountCode: '3100',
        drawingsAccountCode: '3110',
      },
      OPTS,
    );

    expect(row.ownershipPercentage).toBe(50);
    expect(row.active).toBe(true);
    expect(row.capitalAccountCode).toBe('3100');
    expect(row.drawingsAccountCode).toBe('3110');
    expect(row.joinDate).toBe('2022-01-01T00:00:00.000Z');
  });

  it('treats explicit active=false as inactive', () => {
    const row = mapPartner({ id: 'par-2', name: 'X', active: false }, OPTS);
    expect(row.active).toBe(false);
  });

  it('round-trips through SQLite', () => {
    const db = openTestDb();
    const row = mapPartner({ id: 'par-3', name: 'P' }, OPTS);
    db.insert(schema.partners).values(row).run();
    const read = db.select().from(schema.partners).where(eq(schema.partners.id, 'par-3')).get();
    expect(read?.active).toBe(true);
  });
});

// ── Cheques ────────────────────────────────────────────────────────────────────

describe('mapCheque', () => {
  it('preserves all linkage IDs and serializes paidTransactionIds', () => {
    const row = mapCheque(
      {
        id: 'chq-1',
        chequeNumber: '12345',
        clientName: 'عميل أ',
        amount: 1000,
        type: 'incoming',
        status: 'تم الصرف',
        linkedTransactionId: 'TXN-001',
        linkedPaymentId: 'pay-1',
        paidTransactionIds: ['TXN-A', 'TXN-B'],
        issueDate: '2025-01-01T00:00:00Z',
        dueDate: '2025-02-01T00:00:00Z',
        bankName: 'بنك الإسكان',
      },
      OPTS,
    );

    expect(row.linkedTransactionId).toBe('TXN-001');
    expect(row.linkedPaymentId).toBe('pay-1');
    expect(row.paidTransactionIds).toBe('["TXN-A","TXN-B"]');
    expect(row.bankName).toBe('بنك الإسكان');
  });

  it('coerces boolean isEndorsedCheque from a 1 left in the document', () => {
    const row = mapCheque({ id: 'chq-2', isEndorsedCheque: 1 as unknown as boolean }, OPTS);
    expect(row.isEndorsedCheque).toBe(true);
  });

  it('round-trips through SQLite', () => {
    const db = openTestDb();
    const row = mapCheque({ id: 'chq-3', chequeNumber: '999', clientName: 'X' }, OPTS);
    db.insert(schema.cheques).values(row).run();
    const read = db.select().from(schema.cheques).where(eq(schema.cheques.id, 'chq-3')).get();
    expect(read?.chequeNumber).toBe('999');
    expect(read?.status).toBe('معلق');
  });
});

// ── Payments ───────────────────────────────────────────────────────────────────

describe('mapPayment', () => {
  it('preserves multi-allocation metadata', () => {
    const row = mapPayment(
      {
        id: 'pay-1',
        clientName: 'عميل أ',
        amount: 5000,
        type: 'قبض',
        date: '2025-03-15T00:00:00Z',
        isMultiAllocation: true,
        totalAllocated: 5000,
        allocationMethod: 'fifo',
        allocationCount: 2,
      },
      OPTS,
    );

    expect(row.isMultiAllocation).toBe(true);
    expect(row.allocationMethod).toBe('fifo');
    expect(row.allocationCount).toBe(2);
    expect(row.date).toBe('2025-03-15T00:00:00.000Z');
  });

  it('rejects unknown allocationMethod values by storing null', () => {
    const row = mapPayment(
      { id: 'pay-2', allocationMethod: 'random' as unknown as string },
      OPTS,
    );
    expect(row.allocationMethod).toBeNull();
  });

  it('round-trips through SQLite', () => {
    const db = openTestDb();
    const row = mapPayment({ id: 'pay-3', amount: 100, type: 'قبض' }, OPTS);
    db.insert(schema.payments).values(row).run();
    const read = db.select().from(schema.payments).where(eq(schema.payments.id, 'pay-3')).get();
    expect(read?.amount).toBe(100);
    expect(read?.allocationCount).toBe(0);
  });
});

// ── Ledger ─────────────────────────────────────────────────────────────────────

describe('mapLedger', () => {
  it('maps an AR sale with discount and partial payment', () => {
    const row = mapLedger(
      {
        id: 'led-1',
        transactionId: 'TXN-001',
        type: 'دخل',
        amount: 5000,
        category: 'مبيعات حجر مقطوع',
        associatedParty: 'عميل أ',
        date: '2025-04-01T00:00:00Z',
        paymentStatus: 'partial',
        totalPaid: 2000,
        remainingBalance: 2900,
        totalDiscount: 100,
        isARAPEntry: true,
        immediateSettlement: false,
      },
      OPTS,
    );

    expect(row.paymentStatus).toBe('partial');
    expect(row.isARAPEntry).toBe(true);
    expect(row.totalDiscount).toBe(100);
    expect(row.remainingBalance).toBe(2900);
  });

  it('drops unknown paymentStatus to undefined so the schema default applies', () => {
    const row = mapLedger(
      { id: 'led-2', type: 'دخل', amount: 100, paymentStatus: 'pending' as unknown as 'paid' },
      OPTS,
    );
    expect(row.paymentStatus).toBeUndefined();
  });

  it('serializes paidFromAdvances as JSON', () => {
    const row = mapLedger(
      {
        id: 'led-3',
        type: 'دخل',
        amount: 100,
        paidFromAdvances: [
          { advanceId: 'adv-1', amount: 50, date: '2025-04-01T00:00:00Z' },
        ],
        totalPaidFromAdvances: 50,
      },
      OPTS,
    );
    expect(row.paidFromAdvances).toBeTruthy();
    const parsed = JSON.parse(row.paidFromAdvances as string);
    expect(parsed[0].advanceId).toBe('adv-1');
    expect(parsed[0].amount).toBe(50);
  });

  it('falls back transactionId to the document id when missing', () => {
    const row = mapLedger({ id: 'led-4' }, OPTS);
    expect(row.transactionId).toBe('led-4');
  });

  it('round-trips through SQLite', () => {
    const db = openTestDb();
    const row = mapLedger({ id: 'led-5', type: 'دخل', amount: 200, transactionId: 'TXN-005' }, OPTS);
    db.insert(schema.ledger).values(row).run();
    const read = db.select().from(schema.ledger).where(eq(schema.ledger.id, 'led-5')).get();
    expect(read?.amount).toBe(200);
    expect(read?.transactionId).toBe('TXN-005');
  });
});

// ── Inventory ──────────────────────────────────────────────────────────────────

describe('mapInventoryItem', () => {
  it('preserves dimensions and last-purchase pricing', () => {
    const row = mapInventoryItem(
      {
        id: 'inv-1',
        itemName: 'حجر خام',
        category: 'مواد خام',
        quantity: 50,
        unit: 'متر',
        unitPrice: 25,
        minStock: 10,
        thickness: 3,
        width: 60,
        length: 120,
        lastPurchasePrice: 24,
        lastPurchaseDate: '2025-03-01T00:00:00Z',
        lastPurchaseAmount: 1200,
        inventoryAccountCode: '1301',
      },
      OPTS,
    );

    expect(row.itemName).toBe('حجر خام');
    expect(row.thickness).toBe(3);
    expect(row.inventoryAccountCode).toBe('1301');
    expect(row.lastPurchaseDate).toBe('2025-03-01T00:00:00.000Z');
  });

  it('defaults inventoryAccountCode to 1300', () => {
    const row = mapInventoryItem({ id: 'inv-2', itemName: 'X' }, OPTS);
    expect(row.inventoryAccountCode).toBe('1300');
  });

  it('round-trips through SQLite', () => {
    const db = openTestDb();
    const row = mapInventoryItem({ id: 'inv-3', itemName: 'X' }, OPTS);
    db.insert(schema.inventory).values(row).run();
    const read = db.select().from(schema.inventory).where(eq(schema.inventory.id, 'inv-3')).get();
    expect(read?.itemName).toBe('X');
  });
});

// ── Employees ──────────────────────────────────────────────────────────────────

describe('mapEmployee', () => {
  it('maps salary and dates correctly', () => {
    const row = mapEmployee(
      {
        id: 'emp-1',
        name: 'أحمد',
        currentSalary: 600,
        overtimeEligible: true,
        hireDate: '2023-01-01T00:00:00Z',
        position: 'عامل',
      },
      OPTS,
    );

    expect(row.name).toBe('أحمد');
    expect(row.currentSalary).toBe(600);
    expect(row.overtimeEligible).toBe(true);
    expect(row.hireDate).toBe('2023-01-01T00:00:00.000Z');
  });

  it('treats explicit overtimeEligible=false correctly', () => {
    const row = mapEmployee({ id: 'emp-2', name: 'X', overtimeEligible: false }, OPTS);
    expect(row.overtimeEligible).toBe(false);
  });

  it('round-trips through SQLite', () => {
    const db = openTestDb();
    const row = mapEmployee({ id: 'emp-3', name: 'X' }, OPTS);
    db.insert(schema.employees).values(row).run();
    const read = db.select().from(schema.employees).where(eq(schema.employees.id, 'emp-3')).get();
    expect(read?.name).toBe('X');
  });
});

// ── Invoices ───────────────────────────────────────────────────────────────────

describe('mapInvoice', () => {
  it('JSON-encodes the items array', () => {
    const row = mapInvoice(
      {
        id: 'inv-1',
        invoiceNumber: 'INV-001',
        clientName: 'عميل أ',
        invoiceDate: '2025-04-01T00:00:00Z',
        dueDate: '2025-05-01T00:00:00Z',
        items: [
          { description: 'حجر مقطوع', quantity: 10, unitPrice: 100, total: 1000 },
        ],
        subtotal: 1000,
        total: 1000,
      },
      OPTS,
    );

    expect(row.items).toBe(
      JSON.stringify([
        { description: 'حجر مقطوع', quantity: 10, unitPrice: 100, total: 1000 },
      ]),
    );
    expect(row.total).toBe(1000);
  });

  it('falls back invoiceNumber to the doc id and items to []', () => {
    const row = mapInvoice({ id: 'inv-2', clientName: 'X' }, OPTS);
    expect(row.invoiceNumber).toBe('inv-2');
    expect(row.items).toBe('[]');
  });

  it('round-trips through SQLite', () => {
    const db = openTestDb();
    const row = mapInvoice(
      { id: 'inv-3', clientName: 'X', invoiceDate: '2025-04-01T00:00:00Z',
        dueDate: '2025-05-01T00:00:00Z', subtotal: 100, total: 100 },
      OPTS,
    );
    db.insert(schema.invoices).values(row).run();
    const read = db.select().from(schema.invoices).where(eq(schema.invoices.id, 'inv-3')).get();
    expect(read?.total).toBe(100);
  });
});

// ── Batch helper ───────────────────────────────────────────────────────────────

describe('mapMany', () => {
  it('runs a single mapper across an array, passing opts through', () => {
    const docs = [
      { id: 'cli-1', name: 'A' },
      { id: 'cli-2', name: 'B' },
      { id: 'cli-3', name: 'C' },
    ];
    const rows = mapMany(docs, mapClient, OPTS);

    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.id)).toEqual(['cli-1', 'cli-2', 'cli-3']);
    expect(rows.every((r) => r.profileId === PROFILE)).toBe(true);
  });
});
