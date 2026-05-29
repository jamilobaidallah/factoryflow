/**
 * @jest-environment node
 *
 * Phase 6 — Data migration tests.
 *
 * Unit-tests the pure transforms, then proves the full transform -> import ->
 * verify path against a real in-memory SQLite database: the migrated trial
 * balance must be exactly zero (the plan's hard requirement before go-live).
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { applyMigrations } from '@/lib/database';
import * as schema from '@/lib/schema';
import { journalEntries, journalLines } from '@/lib/schema';

import {
  firestoreTimestampToIso,
  splitJournalEntry,
  flattenPaymentAllocations,
  lineTotals,
  type FirestoreJournalEntry,
} from '../transform';
import { importJournalEntries } from '../import';
import { checkCount, checkTrialBalance } from '../verify';
import {
  getJournalEntries,
  getLinesForJournalEntry,
} from '../../../electron/queries/journal.queries';

function openTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  applyMigrations(sqlite);
  return drizzle(sqlite, { schema });
}

const PROFILE = 'factory1';

// ── Timestamp conversion ───────────────────────────────────────────────────────

describe('firestoreTimestampToIso', () => {
  it('converts { seconds, nanoseconds } to UTC ISO', () => {
    // 2026-05-28T00:00:00Z
    expect(firestoreTimestampToIso({ seconds: 1779062400, nanoseconds: 0 })).toBe(
      new Date(1779062400 * 1000).toISOString(),
    );
  });

  it('handles the admin-SDK { _seconds } form', () => {
    expect(firestoreTimestampToIso({ _seconds: 1779062400 })).toBe(
      new Date(1779062400 * 1000).toISOString(),
    );
  });

  it('handles Timestamp objects with toDate()', () => {
    const d = new Date('2026-01-15T10:30:00.000Z');
    expect(firestoreTimestampToIso({ toDate: () => d })).toBe(d.toISOString());
  });

  it('passes through JS Date and ISO strings', () => {
    const d = new Date('2026-03-03T08:00:00.000Z');
    expect(firestoreTimestampToIso(d)).toBe(d.toISOString());
    expect(firestoreTimestampToIso('2026-03-03T08:00:00.000Z')).toBe(d.toISOString());
  });

  it('treats small numbers as seconds and large numbers as milliseconds', () => {
    expect(firestoreTimestampToIso(1779062400)).toBe(new Date(1779062400000).toISOString());
    expect(firestoreTimestampToIso(1779062400000)).toBe(new Date(1779062400000).toISOString());
  });

  it('returns null for missing or invalid values', () => {
    expect(firestoreTimestampToIso(null)).toBeNull();
    expect(firestoreTimestampToIso(undefined)).toBeNull();
    expect(firestoreTimestampToIso('not-a-date')).toBeNull();
  });
});

// ── Journal entry splitting ─────────────────────────────────────────────────────

describe('splitJournalEntry', () => {
  const doc: FirestoreJournalEntry = {
    id: 'je001',
    entryNumber: 'JE-000042',
    date: { seconds: 1779062400, nanoseconds: 0 },
    description: 'بيع نقدي',
    lines: [
      { accountCode: '1100', accountNameAr: 'النقدية', debit: 500, credit: 0 },
      { accountCode: '4100', accountNameAr: 'المبيعات', debit: 0, credit: 500 },
    ],
    linkedTransactionId: 'TXN-1',
    linkedDocumentType: 'ledger',
  };

  it('preserves the Firestore id and entry number', () => {
    const { entry } = splitJournalEntry(doc, {
      profileId: PROFILE,
      sequenceNumber: 42,
      fallbackIso: new Date(0).toISOString(),
    });
    expect(entry.id).toBe('je001');
    expect(entry.entryNumber).toBe('JE-000042');
    expect(entry.sequenceNumber).toBe(42);
    expect(entry.profileId).toBe(PROFILE);
    expect(entry.linkedTransactionId).toBe('TXN-1');
  });

  it('splits lines into rows with deterministic ids and denormalized profile', () => {
    const { lines } = splitJournalEntry(doc, {
      profileId: PROFILE,
      sequenceNumber: 1,
      fallbackIso: new Date(0).toISOString(),
    });
    expect(lines).toHaveLength(2);
    expect(lines[0].id).toBe('je001-line-1');
    expect(lines[1].id).toBe('je001-line-2');
    expect(lines.every((l) => l.journalId === 'je001')).toBe(true);
    expect(lines.every((l) => l.profileId === PROFILE)).toBe(true);
  });

  it('synthesizes an entry number when Firestore lacks one', () => {
    const { entry } = splitJournalEntry(
      { ...doc, entryNumber: undefined },
      { profileId: PROFILE, sequenceNumber: 7, fallbackIso: new Date(0).toISOString() },
    );
    expect(entry.entryNumber).toBe('JE-000007');
  });
});

describe('lineTotals', () => {
  it('sums debits and credits, treating missing values as 0', () => {
    expect(lineTotals([{ debit: 100 }, { credit: 100 }, {}])).toEqual({
      totalDebit: 100,
      totalCredit: 100,
    });
  });
});

// ── Payment allocation flattening ───────────────────────────────────────────────

describe('flattenPaymentAllocations', () => {
  it('flattens valid allocations and skips empty/zero ones', () => {
    const rows = flattenPaymentAllocations(
      {
        id: 'pay1',
        date: { seconds: 1779062400 },
        allocations: [
          { transactionId: 'TXN-1', ledgerDocId: 'led-1', allocatedAmount: 300 },
          { transactionId: 'TXN-2', ledgerDocId: 'led-2', allocatedAmount: 0 }, // skipped
          { allocatedAmount: 50 }, // skipped — no link
        ],
      },
      { profileId: PROFILE, fallbackIso: new Date(0).toISOString() },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      paymentId: 'pay1',
      profileId: PROFILE,
      transactionId: 'TXN-1',
      ledgerDocId: 'led-1',
      allocatedAmount: 300,
    });
  });

  it('returns an empty array when there are no allocations', () => {
    expect(
      flattenPaymentAllocations(
        { id: 'pay2' },
        { profileId: PROFILE, fallbackIso: new Date(0).toISOString() },
      ),
    ).toEqual([]);
  });
});

// ── Full transform -> import -> verify path ──────────────────────────────────────

describe('migration import (integration)', () => {
  function balancedEntry(i: number): FirestoreJournalEntry {
    const amount = Math.round(Math.random() * 100000) / 100;
    return {
      id: `je-${i}`,
      date: { seconds: 1779062400 + i * 86400 },
      description: `Entry ${i}`,
      lines: [
        { accountCode: '1100', accountNameAr: 'النقدية', debit: amount, credit: 0 },
        { accountCode: '4100', accountNameAr: 'المبيعات', debit: 0, credit: amount },
      ],
    };
  }

  it('imports entries preserving ids, splitting lines, and keeps trial balance at zero', () => {
    const db = openTestDb();
    const docs = Array.from({ length: 250 }, (_, i) => balancedEntry(i));

    const result = importJournalEntries(db, docs, { profileId: PROFILE });
    expect(result.entriesInserted).toBe(250);
    expect(result.linesInserted).toBe(500);

    // Counts match
    const countCheck = checkCount(db, journalEntries, journalEntries.profileId, PROFILE, 250, 'journal_entries');
    expect(countCheck.ok).toBe(true);
    const lineCount = checkCount(db, journalLines, journalLines.profileId, PROFILE, 500, 'journal_lines');
    expect(lineCount.ok).toBe(true);

    // Ids preserved + lines retrievable
    const stored = getJournalEntries(db, PROFILE, 1000);
    expect(stored.some((e) => e.id === 'je-0')).toBe(true);
    expect(getLinesForJournalEntry(db, 'je-0')).toHaveLength(2);

    // The golden rule: trial balance is exactly zero
    const tb = checkTrialBalance(db, PROFILE);
    expect(tb.isBalanced).toBe(true);
    expect(tb.difference).toBeLessThanOrEqual(0.001);
  });

  it('aborts the import when an entry is unbalanced', () => {
    const db = openTestDb();
    const bad: FirestoreJournalEntry = {
      id: 'je-bad',
      date: { seconds: 1779062400 },
      description: 'unbalanced',
      lines: [
        { accountCode: '1100', debit: 100, credit: 0 },
        { accountCode: '4100', debit: 0, credit: 90 }, // 100 ≠ 90
      ],
    };
    expect(() => importJournalEntries(db, [bad], { profileId: PROFILE })).toThrow(/unbalanced/i);
  });
});
