/**
 * Phase 6 — Data migration: import layer.
 *
 * Inserts transformed rows into a SQLite database. Unlike the live create path
 * (electron/queries/journal.queries.ts `insertJournalEntry`, which GENERATES
 * ids/sequence/entryNumber), the migration import PRESERVES the original
 * Firestore document IDs and entry numbers — only assigning the SQLite-side
 * `sequenceNumber` as it goes.
 *
 * Balance is still enforced per entry: an unbalanced journal entry aborts the
 * whole import (the caller wraps this in a transaction), exactly mirroring the
 * golden rule the live path guarantees.
 */

import type { DrizzleDb } from '@/lib/database';
import { journalEntries, journalLines } from '@/lib/schema';
import {
  splitJournalEntry,
  lineTotals,
  type FirestoreJournalEntry,
} from './transform';

const BALANCE_TOLERANCE = 0.001;

export interface ImportJournalOptions {
  profileId: string;
  /** Fallback ISO date for documents with a missing/invalid date. */
  fallbackIso?: string;
}

export interface ImportResult {
  entriesInserted: number;
  linesInserted: number;
}

/**
 * Import an array of Firestore journal-entry documents into SQLite, preserving
 * IDs. Entries are sequenced in the order given (assumed already date-sorted by
 * the caller). Throws on the first unbalanced entry — wrap in a transaction so
 * a failure rolls back the entire migration.
 */
export function importJournalEntries(
  db: DrizzleDb,
  docs: FirestoreJournalEntry[],
  opts: ImportJournalOptions,
): ImportResult {
  const fallbackIso = opts.fallbackIso ?? new Date(0).toISOString();
  let entriesInserted = 0;
  let linesInserted = 0;

  docs.forEach((doc, index) => {
    const { totalDebit, totalCredit } = lineTotals(doc.lines);
    if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
      throw new Error(
        `Migration aborted: journal entry "${doc.id}" is unbalanced ` +
        `(DR ${totalDebit.toFixed(3)} ≠ CR ${totalCredit.toFixed(3)}).`,
      );
    }

    const { entry, lines } = splitJournalEntry(doc, {
      profileId: opts.profileId,
      sequenceNumber: index + 1,
      fallbackIso,
    });

    db.insert(journalEntries).values(entry).run();
    entriesInserted++;

    for (const line of lines) {
      db.insert(journalLines).values(line).run();
      linesInserted++;
    }
  });

  return { entriesInserted, linesInserted };
}
