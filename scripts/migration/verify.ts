/**
 * Phase 6 — Data migration: verification helpers.
 *
 * After importing, the plan requires a verification checklist:
 *   - record counts match Firebase (per collection)
 *   - trial balance is exactly zero (total debits = total credits)
 *   - revenue / expense / profit totals match the Firebase dashboard
 *
 * These helpers compute the SQLite side of those checks. The Firebase side is
 * supplied by the export step and compared on the user's machine.
 */

import { count, eq, type AnyColumn } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';
import type { DrizzleDb } from '@/lib/database';
import { getTrialBalanceSummary } from '../../electron/queries/journal.queries';

export interface CountCheck {
  collection: string;
  expected: number;
  actual: number;
  ok: boolean;
}

/**
 * Compare an expected count (from the Firebase export) against the SQLite table
 * count for a profile. The profile column is passed explicitly so the query is
 * fully type-safe and parameterized — no raw SQL.
 */
export function checkCount(
  db: DrizzleDb,
  table: SQLiteTable,
  profileColumn: AnyColumn,
  profileId: string,
  expected: number,
  label: string,
): CountCheck {
  const row = db
    .select({ n: count() })
    .from(table)
    .where(eq(profileColumn, profileId))
    .get();
  const actual = Number(row?.n ?? 0);
  return { collection: label, expected, actual, ok: actual === expected };
}

export interface TrialBalanceCheck {
  totalDebits: number;
  totalCredits: number;
  difference: number;
  isBalanced: boolean;
}

/**
 * The single most important post-migration check: debits must equal credits.
 * Returns the summary; callers should treat `isBalanced === false` as a hard
 * failure that blocks go-live.
 */
export function checkTrialBalance(db: DrizzleDb, profileId: string): TrialBalanceCheck {
  const summary = getTrialBalanceSummary(db, profileId);
  return {
    totalDebits: summary.totalDebits,
    totalCredits: summary.totalCredits,
    difference: summary.difference,
    isBalanced: summary.isBalanced,
  };
}

/** Format the verification results as a printable checklist for the runbook. */
export function formatChecklist(
  counts: CountCheck[],
  trialBalance: TrialBalanceCheck,
): string {
  const lines: string[] = ['Migration verification:', '', 'Record counts:'];
  for (const c of counts) {
    lines.push(`  ${c.ok ? '✓' : '✗'} ${c.collection}: SQLite ${c.actual} / Firebase ${c.expected}`);
  }
  lines.push('', 'Accounting integrity:');
  lines.push(
    `  ${trialBalance.isBalanced ? '✓' : '✗'} Trial balance: ` +
    `DR ${trialBalance.totalDebits.toFixed(2)} / CR ${trialBalance.totalCredits.toFixed(2)} ` +
    `(difference ${trialBalance.difference.toFixed(4)})`,
  );
  return lines.join('\n');
}
