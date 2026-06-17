import { eq, desc, and, asc, max, sql } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { journalEntries, journalLines } from '../../src/lib/schema/journal.schema';
import { chartOfAccounts } from '../../src/lib/schema/chart-of-accounts.schema';

export type JournalEntryRow    = typeof journalEntries.$inferSelect;
export type NewJournalEntryRow = typeof journalEntries.$inferInsert;
export type JournalLineRow     = typeof journalLines.$inferSelect;
export type NewJournalLineRow  = typeof journalLines.$inferInsert;

/** Tolerance for floating-point comparison (0.001 = 1/1000 of a currency unit) */
const BALANCE_TOLERANCE = 0.001;

/**
 * The single chokepoint for writing journal entries.
 * Enforces debits = credits BEFORE writing anything.
 * The entry and all its lines are written in one atomic transaction —
 * if balance check fails or any line insert fails, nothing is persisted.
 *
 * This is the function the 1,000-entry hard gate test stress-tests.
 */
export function insertJournalEntry(
  db: DrizzleDb,
  entry: Omit<NewJournalEntryRow, 'id' | 'sequenceNumber' | 'entryNumber'> & { id?: string },
  lines: Omit<NewJournalLineRow, 'id' | 'journalId' | 'profileId'>[]
): { entry: JournalEntryRow; lines: JournalLineRow[] } {
  // 1. Validate inputs
  if (lines.length === 0) {
    throw new Error('Journal entry must have at least one line');
  }

  const totalDebit  = lines.reduce((sum, l) => sum + (l.debit  || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > BALANCE_TOLERANCE) {
    throw new Error(
      `Unbalanced journal entry: DR ${totalDebit.toFixed(3)} ≠ CR ${totalCredit.toFixed(3)}. ` +
      `Entry rejected.`
    );
  }

  if (totalDebit <= 0) {
    throw new Error('Journal entry must have non-zero amounts');
  }

  // 2. Compute sequence number + entry number atomically inside the transaction
  return db.transaction((tx) => {
    const nextSeq = getNextSequenceNumber(tx as unknown as DrizzleDb, entry.profileId);
    const entryId = entry.id ?? `je-${entry.profileId}-${nextSeq}`;
    const entryNumber = `JE-${String(nextSeq).padStart(6, '0')}`;

    const insertedEntry = tx.insert(journalEntries).values({
      ...entry,
      id: entryId,
      sequenceNumber: nextSeq,
      entryNumber,
    }).returning().get();

    const insertedLines: JournalLineRow[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const row = tx.insert(journalLines).values({
        id: `${entryId}-line-${i + 1}`,
        journalId: entryId,
        profileId: entry.profileId,
        ...line,
      }).returning().get();
      insertedLines.push(row);
    }

    return { entry: insertedEntry, lines: insertedLines };
  });
}

/**
 * Returns the next sequence number for journal entries in this profile.
 * Sequence numbers are gapless (1, 2, 3, ...) per profile.
 */
export function getNextSequenceNumber(db: DrizzleDb, profileId: string): number {
  const result = db
    .select({ max: max(journalEntries.sequenceNumber) })
    .from(journalEntries)
    .where(eq(journalEntries.profileId, profileId))
    .get();
  return (result?.max ?? 0) + 1;
}

export function getJournalEntries(
  db: DrizzleDb,
  profileId: string,
  limit = 500
): JournalEntryRow[] {
  return db.select().from(journalEntries)
    .where(eq(journalEntries.profileId, profileId))
    .orderBy(desc(journalEntries.sequenceNumber))
    .limit(limit)
    .all();
}

export function getJournalEntryById(db: DrizzleDb, id: string): JournalEntryRow | undefined {
  return db.select().from(journalEntries).where(eq(journalEntries.id, id)).get();
}

export function getLinesForJournalEntry(db: DrizzleDb, journalId: string): JournalLineRow[] {
  return db.select().from(journalLines)
    .where(eq(journalLines.journalId, journalId))
    .orderBy(asc(journalLines.id))
    .all();
}

export function getJournalEntriesForTransaction(
  db: DrizzleDb,
  transactionId: string
): JournalEntryRow[] {
  return db.select().from(journalEntries)
    .where(eq(journalEntries.linkedTransactionId, transactionId))
    .all();
}

/**
 * Delete a journal entry and all its lines. Used by deleteLedgerEntry to
 * remove linked journals.
 */
export function deleteJournalEntry(db: DrizzleDb, id: string): void {
  db.transaction((tx) => {
    tx.delete(journalLines).where(eq(journalLines.journalId, id)).run();
    tx.delete(journalEntries).where(eq(journalEntries.id, id)).run();
  });
}

export function deleteJournalEntriesForTransaction(
  db: DrizzleDb,
  transactionId: string
): void {
  const entries = getJournalEntriesForTransaction(db, transactionId);
  db.transaction((tx) => {
    for (const e of entries) {
      tx.delete(journalLines).where(eq(journalLines.journalId, e.id)).run();
      tx.delete(journalEntries).where(eq(journalEntries.id, e.id)).run();
    }
  });
}

// ── Reporting queries ────────────────────────────────────────────────────────

export interface AccountBalance {
  accountCode: string;
  accountName: string;
  accountNameAr: string;
  totalDebit:  number;
  totalCredit: number;
  balance:     number;  // signed: debit-balance accounts → positive when DR > CR
}

/**
 * Trial balance — sum of all debits/credits per account.
 * Used to verify accounting integrity: total debits must equal total credits.
 *
 * Returns one row per account that has at least one journal line.
 * Returns ALL accounts (not just non-zero) so users can spot missing balances.
 */
export function getTrialBalance(db: DrizzleDb, profileId: string): AccountBalance[] {
  const rows = db
    .select({
      accountCode: journalLines.accountCode,
      accountName: journalLines.accountName,
      accountNameAr: journalLines.accountNameAr,
      totalDebit:  sql<number>`COALESCE(SUM(${journalLines.debit}), 0)`,
      totalCredit: sql<number>`COALESCE(SUM(${journalLines.credit}), 0)`,
    })
    .from(journalLines)
    .where(eq(journalLines.profileId, profileId))
    .groupBy(journalLines.accountCode, journalLines.accountName, journalLines.accountNameAr)
    .orderBy(asc(journalLines.accountCode))
    .all();

  return rows.map(r => ({
    accountCode: r.accountCode,
    accountName: r.accountName,
    accountNameAr: r.accountNameAr,
    totalDebit:  Number(r.totalDebit  || 0),
    totalCredit: Number(r.totalCredit || 0),
    balance:     Number(r.totalDebit || 0) - Number(r.totalCredit || 0),
  }));
}

export interface TrialBalanceSummary {
  totalDebits:    number;
  totalCredits:   number;
  difference:     number;
  isBalanced:     boolean;
}

export function getTrialBalanceSummary(db: DrizzleDb, profileId: string): TrialBalanceSummary {
  const rows = getTrialBalance(db, profileId);
  const totalDebits  = rows.reduce((s, r) => s + r.totalDebit,  0);
  const totalCredits = rows.reduce((s, r) => s + r.totalCredit, 0);
  const difference = Math.abs(totalDebits - totalCredits);
  return {
    totalDebits,
    totalCredits,
    difference,
    isBalanced: difference <= BALANCE_TOLERANCE,
  };
}

/**
 * Detailed ledger for a single account: every journal line touching that account
 * with a running balance.
 */
export interface AccountLedgerEntry {
  journalId:        string;
  entryNumber:      string;
  date:             string;
  description:      string | null;
  debit:            number;
  credit:           number;
  runningBalance:   number;
}

export function getAccountLedger(
  db: DrizzleDb,
  profileId: string,
  accountCode: string
): AccountLedgerEntry[] {
  const rows = db
    .select({
      journalId:   journalLines.journalId,
      entryNumber: journalEntries.entryNumber,
      date:        journalEntries.date,
      description: journalLines.description,
      debit:       journalLines.debit,
      credit:      journalLines.credit,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.journalId, journalEntries.id))
    .where(and(
      eq(journalLines.profileId, profileId),
      eq(journalLines.accountCode, accountCode),
    ))
    .orderBy(asc(journalEntries.date), asc(journalEntries.sequenceNumber))
    .all();

  let running = 0;
  return rows.map(r => {
    running += (r.debit || 0) - (r.credit || 0);
    return {
      journalId:    r.journalId,
      entryNumber:  r.entryNumber,
      date:         r.date,
      description:  r.description,
      debit:        r.debit  || 0,
      credit:       r.credit || 0,
      runningBalance: running,
    };
  });
}

/**
 * Balance sheet aggregation — groups account balances by account type.
 * Returns assets, liabilities, equity (revenue and expense are closed to equity
 * at year-end so they don't appear here directly during the year, but during the
 * year their net contributes to retained-earnings-equivalent).
 */
export interface BalanceSheet {
  assets:      AccountBalance[];
  liabilities: AccountBalance[];
  equity:      AccountBalance[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export function getBalanceSheet(db: DrizzleDb, profileId: string): BalanceSheet {
  // Join trial balance against chart of accounts to know the type of each account
  const tb = getTrialBalance(db, profileId);
  const accounts = db.select().from(chartOfAccounts)
    .where(eq(chartOfAccounts.profileId, profileId))
    .all();
  const accountTypeByCode = new Map(accounts.map(a => [a.code, a.type] as const));

  const assets:      AccountBalance[] = [];
  const liabilities: AccountBalance[] = [];
  const equity:      AccountBalance[] = [];

  for (const row of tb) {
    const type = accountTypeByCode.get(row.accountCode);
    if (type === 'asset')     { assets.push(row); }
    if (type === 'liability') { liabilities.push(row); }
    if (type === 'equity')    { equity.push(row); }
  }

  // For credit-normal accounts (liability, equity), positive balance = CR > DR
  // Assets are debit-normal: positive = DR > CR
  const totalAssets      = assets.reduce((s, r) => s + r.balance, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s - r.balance, 0);
  const totalEquity      = equity.reduce((s, r) => s - r.balance, 0);

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}
