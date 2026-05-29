/**
 * Phase 6 — Data migration: transformation layer.
 *
 * Pure functions that convert Firestore-shaped export data into the SQLite row
 * shapes defined in src/lib/schema. These are the integrity-critical transforms
 * the migration plan calls out:
 *
 *   1. Firestore Timestamp  ->  UTC ISO string   (timezone-bug prevention)
 *   2. Journal entry lines[] ->  separate journal_lines rows
 *   3. Payment allocations[] ->  payment_allocations rows
 *
 * Everything here is side-effect free and fully unit-testable WITHOUT a live
 * Firebase connection or a database. The actual export + DB import are wired in
 * import.ts and run on the user's machine (they require Firebase credentials).
 */

import { journalEntries, journalLines, paymentAllocations } from '@/lib/schema';

// Row insert shapes derived straight from the Drizzle schema, so these stay in
// lockstep with the tables (the barrel exports tables, not the inferred types).
type NewJournalEntryRow = typeof journalEntries.$inferInsert;
type NewJournalLineRow = typeof journalLines.$inferInsert;
type NewPaymentAllocationRow = typeof paymentAllocations.$inferInsert;

// ── 1. Timestamps ─────────────────────────────────────────────────────────────

/**
 * The shapes a Firestore date can arrive in once exported:
 *  - `{ seconds, nanoseconds }`        (raw REST/JSON export)
 *  - `{ _seconds, _nanoseconds }`      (admin SDK serialization)
 *  - a Firestore Timestamp with `.toDate()`
 *  - a JS `Date`
 *  - an ISO string (already converted)
 *  - `null` / `undefined`
 */
export type FirestoreDateLike =
  | { seconds: number; nanoseconds?: number }
  | { _seconds: number; _nanoseconds?: number }
  | { toDate: () => Date }
  | Date
  | string
  | number
  | null
  | undefined;

/**
 * Convert any Firestore date representation to a UTC ISO string.
 *
 * Storing UTC (never local time) is what prevents the "entered at 11pm local,
 * shows up on the previous day in reports" class of bug. Display-layer code is
 * responsible for converting back to local time.
 *
 * Returns `null` for missing dates so callers can decide on a default.
 */
export function firestoreTimestampToIso(value: FirestoreDateLike): string | null {
  if (value === null || value === undefined) { return null; }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'string') {
    const parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value === 'number') {
    // Heuristic: seconds vs milliseconds. Firestore seconds are ~1.7e9 today;
    // millisecond epochs are ~1.7e12. Anything below 1e12 is treated as seconds.
    const ms = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(ms);
    return isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    const d = (value as { toDate: () => Date }).toDate();
    return isNaN(d.getTime()) ? null : d.toISOString();
  }

  const seconds =
    (value as { seconds?: number }).seconds ??
    (value as { _seconds?: number })._seconds;
  if (typeof seconds === 'number') {
    const nanos =
      (value as { nanoseconds?: number }).nanoseconds ??
      (value as { _nanoseconds?: number })._nanoseconds ??
      0;
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toISOString();
  }

  return null;
}

/** Convert a date, falling back to a provided default ISO (or epoch) when absent. */
export function firestoreTimestampToIsoOr(
  value: FirestoreDateLike,
  fallbackIso: string,
): string {
  return firestoreTimestampToIso(value) ?? fallbackIso;
}

// ── 2. Journal entries: nested lines[] -> separate rows ─────────────────────────

/** Minimal shape of a Firestore journal-entry export document. */
export interface FirestoreJournalEntry {
  id: string;
  entryNumber?: string;
  date: FirestoreDateLike;
  description?: string;
  status?: string;
  lines: Array<{
    accountCode: string;
    accountName?: string;
    accountNameAr?: string;
    debit?: number;
    credit?: number;
    description?: string;
  }>;
  linkedTransactionId?: string;
  linkedPaymentId?: string;
  linkedDocumentType?: string;
  createdAt?: FirestoreDateLike;
}

export interface SplitJournalResult {
  entry: NewJournalEntryRow;
  lines: NewJournalLineRow[];
}

/**
 * Split one Firestore journal entry into the entry row + its line rows,
 * preserving the original document ID and entry number (the migration keeps
 * Firestore IDs as primary keys). The caller supplies `sequenceNumber` and
 * `profileId`, since those are SQLite-side concerns not present in Firestore.
 */
export function splitJournalEntry(
  doc: FirestoreJournalEntry,
  opts: { profileId: string; sequenceNumber: number; fallbackIso: string },
): SplitJournalResult {
  const { profileId, sequenceNumber, fallbackIso } = opts;
  const dateIso = firestoreTimestampToIsoOr(doc.date, fallbackIso);
  const createdIso = firestoreTimestampToIsoOr(doc.createdAt, dateIso);

  const entry: NewJournalEntryRow = {
    id: doc.id,
    profileId,
    sequenceNumber,
    entryNumber: doc.entryNumber ?? `JE-${String(sequenceNumber).padStart(6, '0')}`,
    date: dateIso,
    description: doc.description ?? '',
    status: doc.status === 'reversed' ? 'reversed' : 'posted',
    entryStatus: 'active',
    sourceType: doc.linkedDocumentType ?? 'migrated',
    sourceTransactionId: doc.linkedTransactionId ?? null,
    linkedTransactionId: doc.linkedTransactionId ?? null,
    linkedPaymentId: doc.linkedPaymentId ?? null,
    linkedDocumentType: doc.linkedDocumentType ?? null,
    createdAt: createdIso,
    createdBy: 'migration',
  };

  const lines: NewJournalLineRow[] = doc.lines.map((line, i) => ({
    id: `${doc.id}-line-${i + 1}`,
    journalId: doc.id,
    profileId,
    accountCode: line.accountCode,
    accountName: line.accountName ?? '',
    accountNameAr: line.accountNameAr ?? '',
    debit: line.debit ?? 0,
    credit: line.credit ?? 0,
    description: line.description ?? '',
  }));

  return { entry, lines };
}

/** Sum debits/credits for an entry's lines — used by import-time balance checks. */
export function lineTotals(lines: Array<{ debit?: number; credit?: number }>): {
  totalDebit: number;
  totalCredit: number;
} {
  return lines.reduce(
    (acc, l) => ({
      totalDebit: acc.totalDebit + (l.debit ?? 0),
      totalCredit: acc.totalCredit + (l.credit ?? 0),
    }),
    { totalDebit: 0, totalCredit: 0 },
  );
}

// ── 3. Payments: allocations[] -> payment_allocations rows ──────────────────────

/** Minimal shape of a Firestore payment export document with embedded allocations. */
export interface FirestorePayment {
  id: string;
  date?: FirestoreDateLike;
  allocations?: Array<{
    id?: string;
    transactionId?: string;
    ledgerDocId?: string;
    allocatedAmount?: number;
    transactionDate?: FirestoreDateLike;
    description?: string;
  }>;
}

/**
 * Flatten a payment's allocation array (originally a Firestore subcollection)
 * into payment_allocations rows. Allocations missing an amount or both link
 * fields are skipped — they can't be reconciled and would corrupt the join.
 */
export function flattenPaymentAllocations(
  payment: FirestorePayment,
  opts: { profileId: string; fallbackIso: string },
): NewPaymentAllocationRow[] {
  const { profileId, fallbackIso } = opts;
  const allocations = payment.allocations ?? [];

  return allocations
    .filter((a) => (a.allocatedAmount ?? 0) > 0 && (a.transactionId || a.ledgerDocId))
    .map((a, i) => ({
      id: a.id ?? `${payment.id}-alloc-${i + 1}`,
      paymentId: payment.id,
      profileId,
      transactionId: a.transactionId ?? a.ledgerDocId ?? '',
      ledgerDocId: a.ledgerDocId ?? a.transactionId ?? '',
      allocatedAmount: a.allocatedAmount ?? 0,
      transactionDate: firestoreTimestampToIso(a.transactionDate) ?? null,
      description: a.description ?? '',
      createdAt: firestoreTimestampToIsoOr(payment.date, fallbackIso),
    }));
}
