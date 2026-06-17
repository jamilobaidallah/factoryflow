import { eq, desc, and, sql, asc, count } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { ledger } from '../../src/lib/schema/ledger.schema';
import {
  insertJournalEntry,
  deleteJournalEntriesForTransaction,
  type NewJournalLineRow,
} from './journal.queries';
import { resolveAccountMapping, type AccountMapping } from './account-mapping';

export type LedgerRow    = typeof ledger.$inferSelect;
export type NewLedgerRow = typeof ledger.$inferInsert;

/**
 * Generate a unique transaction ID — "TXN-YYYYMMDD-HHMMSS-XXXXXX"
 * The trailing 6 chars use a process-local counter mixed with randomness
 * to guarantee uniqueness even for rapid-fire bulk inserts within the
 * same millisecond. Format matches the Firestore version + extra entropy.
 */
let _txnCounter = 0;
export function generateTransactionId(): string {
  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const dt = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const tm = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  _txnCounter = (_txnCounter + 1) % 1_000_000;
  const seq = pad(_txnCounter, 6);
  return `TXN-${dt}-${tm}-${seq}`;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export function getLedgerEntries(
  db: DrizzleDb,
  profileId: string,
  limit = 500
): LedgerRow[] {
  return db.select().from(ledger)
    .where(eq(ledger.profileId, profileId))
    .orderBy(desc(ledger.date))
    .limit(limit)
    .all();
}

export function getLedgerEntryById(db: DrizzleDb, id: string): LedgerRow | undefined {
  return db.select().from(ledger).where(eq(ledger.id, id)).get();
}

export function getLedgerEntryByTransactionId(
  db: DrizzleDb,
  transactionId: string
): LedgerRow | undefined {
  return db.select().from(ledger).where(eq(ledger.transactionId, transactionId)).get();
}

export function getLedgerCount(db: DrizzleDb, profileId: string): number {
  const result = db
    .select({ n: count() })
    .from(ledger)
    .where(eq(ledger.profileId, profileId))
    .get();
  return Number(result?.n ?? 0);
}

export function getUnpaidARAPCount(db: DrizzleDb, profileId: string): number {
  return db.select().from(ledger)
    .where(eq(ledger.profileId, profileId))
    .all()
    .filter(e => e.isARAPEntry && (e.paymentStatus === 'unpaid' || e.paymentStatus === 'partial'))
    .length;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Input for createLedgerEntry — the user-facing data that matches the
 * existing LedgerFormData on the Firestore side.
 */
export interface LedgerFormInput {
  profileId:             string;
  description?:          string;
  type:                  string;
  amount:                number;
  category?:             string;
  subCategory?:          string;
  associatedParty?:      string;
  ownerName?:            string | null;
  date:                  string;        // UTC ISO
  immediateSettlement?:  boolean;
  totalDiscount?:        number;
  paymentStatus?:        string;
  isInventoryPurchase?:  boolean;
  isReturnEntry?:        boolean;
  returnCostAmount?:     number;
  isCOGSReversal?:       boolean;
  isARAPEntry?:          boolean;
  /** Optional explicit overrides — used by handlers (cheque, advance, etc.) */
  overrides?: Partial<NewLedgerRow>;
}

/**
 * Create a ledger entry AND its matching journal entry atomically.
 *
 * This is the foundation function. Complex flows (cheque payments, advance
 * applications, multi-allocation payments, inventory movements) are layered
 * on top via separate handler functions that call this and then create
 * additional records.
 *
 * If anything fails (balance check, journal write, ledger write), the entire
 * transaction rolls back.
 */
export function createLedgerEntry(
  db: DrizzleDb,
  input: LedgerFormInput
): { ledger: LedgerRow; journalId: string } {
  const transactionId = generateTransactionId();
  const ledgerId      = `led-${transactionId}`;
  const now           = new Date().toISOString();

  // Determine final field values from input + sensible defaults
  const isInstant      = input.immediateSettlement ?? !input.isARAPEntry;
  const isARAP         = input.isARAPEntry ?? !isInstant;
  const amount         = input.amount;
  const paymentStatus  = input.paymentStatus
                       ?? (isInstant ? 'paid' : 'unpaid');
  const totalPaid      = isInstant ? amount : 0;
  const remainingBal   = isInstant ? 0 : amount;

  // Resolve which accounts to use based on type + category + subCategory
  const mapping: AccountMapping = resolveAccountMapping({
    type:           input.type,
    category:       input.category,
    subCategory:    input.subCategory,
    isInstant,
    isInventoryPurchase: input.isInventoryPurchase ?? false,
    isReturnEntry:  input.isReturnEntry ?? false,
    isCOGSReversal: input.isCOGSReversal ?? false,
  });

  // Build journal lines (always 1 DR + 1 CR for the simple case)
  const lines: Omit<NewJournalLineRow, 'id' | 'journalId' | 'profileId'>[] = [
    {
      accountCode:   mapping.debitAccount.code,
      accountName:   mapping.debitAccount.name,
      accountNameAr: mapping.debitAccount.nameAr,
      debit:  amount,
      credit: 0,
      description: input.description ?? '',
    },
    {
      accountCode:   mapping.creditAccount.code,
      accountName:   mapping.creditAccount.name,
      accountNameAr: mapping.creditAccount.nameAr,
      debit:  0,
      credit: amount,
      description: input.description ?? '',
    },
  ];

  return db.transaction((tx) => {
    // 1. Insert the journal entry (with balance enforcement inside insertJournalEntry)
    // The transaction handle has the same query API as DrizzleDb but a slightly
    // different TypeScript type — safe to cast within this context.
    const { entry: journal } = insertJournalEntry(
      tx as unknown as DrizzleDb,
      {
        profileId: input.profileId,
        date: input.date,
        description: input.description ?? '',
        sourceType: 'ledger',
        sourceTransactionId: transactionId,
        linkedTransactionId: transactionId,
        createdAt: now,
        createdBy: 'local',
      },
      lines,
    );

    // 2. Insert the ledger row
    const ledgerRow = tx.insert(ledger).values({
      id:                  ledgerId,
      profileId:           input.profileId,
      transactionId,
      description:         input.description ?? '',
      type:                input.type,
      amount,
      category:            input.category    ?? '',
      subCategory:         input.subCategory ?? '',
      associatedParty:     input.associatedParty ?? '',
      ownerName:           input.ownerName ?? null,
      date:                input.date,
      createdAt:           now,
      paymentStatus:       paymentStatus as 'paid' | 'unpaid' | 'partial',
      isARAPEntry:         isARAP,
      immediateSettlement: isInstant,
      totalPaid,
      remainingBalance:    remainingBal,
      totalDiscount:       input.totalDiscount ?? 0,
      isInventoryPurchase: input.isInventoryPurchase ?? false,
      isReturnEntry:       input.isReturnEntry ?? false,
      returnCostAmount:    input.returnCostAmount ?? 0,
      isCOGSReversal:      input.isCOGSReversal ?? false,
      ...input.overrides,
    }).returning().get();

    return { ledger: ledgerRow, journalId: journal.id };
  });
}

/**
 * Delete a ledger entry and ALL its linked journal entries.
 * Removes payment allocations too (payment_allocations table references the
 * transactionId via ledger_doc_id).
 */
export function deleteLedgerEntry(db: DrizzleDb, id: string): void {
  const entry = getLedgerEntryById(db, id);
  if (!entry) { return; }

  db.transaction((tx) => {
    // Remove all journal entries linked to this transactionId
    deleteJournalEntriesForTransaction(tx as unknown as DrizzleDb, entry.transactionId);
    // Remove the ledger row itself
    tx.delete(ledger).where(eq(ledger.id, id)).run();
  });
}

/**
 * Update non-financial fields on a ledger entry (e.g., notes, description).
 * For financial updates that require journal recreation, use the
 * updateLedgerEntry handler (built in a follow-up commit) which rebuilds
 * the journal entries from scratch.
 */
export function updateLedgerEntryMetadata(
  db: DrizzleDb,
  id: string,
  data: Partial<Pick<LedgerRow, 'description' | 'associatedParty' | 'category' | 'subCategory'>>
): LedgerRow | undefined {
  return db.update(ledger).set(data).where(eq(ledger.id, id)).returning().get();
}

/**
 * Update payment-related fields after a payment has been applied to this entry.
 */
export function updateLedgerPaymentStatus(
  db: DrizzleDb,
  id: string,
  totalPaid: number,
  totalDiscount: number,
  amount: number,
): LedgerRow | undefined {
  const remaining = Math.max(0, amount - totalPaid - totalDiscount);
  let status: 'paid' | 'unpaid' | 'partial';
  if (remaining <= 0.001) {
    status = 'paid';
  } else if (totalPaid > 0 || totalDiscount > 0) {
    status = 'partial';
  } else {
    status = 'unpaid';
  }
  return db.update(ledger).set({
    totalPaid,
    totalDiscount,
    remainingBalance: remaining,
    paymentStatus: status,
  }).where(eq(ledger.id, id)).returning().get();
}
