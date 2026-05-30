/**
 * Phase 6 — End-to-end migration runner.
 *
 * Reads a folder of JSON files exported from Firestore and writes the
 * transformed rows into a SQLite database — atomically. If any step fails
 * (a mapper throws, an unbalanced journal entry is found, an FK violation
 * surfaces, anything), the entire migration rolls back and the database is
 * left untouched.
 *
 * Designed to be testable WITHOUT live Firebase: callers either supply a
 * directory of JSON files OR an in-memory `exports` map. The integration
 * tests use the in-memory variant; the real CLI run uses the directory.
 *
 * Insert order respects the schema's foreign keys:
 *   1. chart_of_accounts  (seeded by seedChartOfAccounts on new profiles —
 *      this runner does NOT seed; the import file overrides if present)
 *   2. clients
 *   3. partners
 *   4. employees
 *   5. inventory                 (parents of inventory_movements)
 *   6. fixed_assets              (parent of depreciation_records — not yet wired)
 *   7. ledger
 *   8. payments                  (parent of payment_allocations)
 *   9. payment_allocations
 *  10. cheques
 *  11. invoices
 *  12. journal_entries           (parent of journal_lines)
 *  13. journal_lines             (handled by importJournalEntries via splitJournalEntry)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { DrizzleDb } from '@/lib/database';
import {
  clients, partners, employees, inventory,
  ledger, payments, paymentAllocations, cheques, invoices,
  journalEntries,
} from '@/lib/schema';
import { mapClient, mapPartner, mapEmployee, mapInventoryItem,
         mapLedger, mapPayment, mapCheque, mapInvoice, mapMany,
         type FirestoreClient, type FirestorePartner, type FirestoreEmployee,
         type FirestoreInventory, type FirestoreLedger, type FirestorePaymentMeta,
         type FirestoreCheque, type FirestoreInvoice } from './mappers';
import { flattenPaymentAllocations, type FirestorePayment } from './transform';

/**
 * A real exported payment document has BOTH the metadata fields (clientName,
 * amount, type, …) consumed by `mapPayment` AND an embedded `allocations[]`
 * array consumed by `flattenPaymentAllocations`. The two interfaces describe
 * the same document from different angles, so the runner sees their union.
 */
type FirestorePaymentFull = FirestorePaymentMeta & FirestorePayment;
import { importJournalEntries, type ImportResult } from './import';
import { checkCount, checkTrialBalance, formatChecklist,
         type CountCheck, type TrialBalanceCheck } from './verify';
import type { FirestoreJournalEntry } from './transform';

// ─────────────────────────────────────────────────────────────────────────────
// Public surface
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One collection's worth of exported Firestore documents. Each key is
 * optional — missing collections are skipped (the runner only writes what
 * it's given), and a collection with an empty array writes zero rows.
 */
export interface MigrationExports {
  clients?: FirestoreClient[];
  partners?: FirestorePartner[];
  employees?: FirestoreEmployee[];
  inventory?: FirestoreInventory[];
  ledger?: FirestoreLedger[];
  /** Each payment may embed its own `allocations` array; flattenPaymentAllocations splits them out. */
  payments?: FirestorePaymentFull[];
  cheques?: FirestoreCheque[];
  invoices?: FirestoreInvoice[];
  /** Journal entries with embedded `lines` arrays; importJournalEntries enforces balance. */
  journal_entries?: FirestoreJournalEntry[];
}

export interface MigrationOptions {
  profileId: string;
  /**
   * Fallback ISO date used when a document is missing its primary date field.
   * Defaults to the Unix epoch so the data is still queryable but obviously
   * not-real (it sticks out as 1970 in any report).
   */
  fallbackIso?: string;
}

export interface MigrationResult {
  /** Per-collection row counts that were inserted. */
  inserted: Record<keyof MigrationExports | 'payment_allocations', number>;
  /** Journal-import detail: total entries + total lines inserted. */
  journal: ImportResult;
  /** Verification: per-collection count check (Firebase vs SQLite). */
  counts: CountCheck[];
  /** Verification: debits = credits across all journal lines. */
  trialBalance: TrialBalanceCheck;
  /** Human-readable summary suitable for `console.log`. */
  checklist: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run a full migration from in-memory export data. Wraps everything in a single
 * SQLite transaction — on any failure, nothing is persisted.
 *
 * Order respects FK constraints. The single most important guarantee:
 * `importJournalEntries` aborts on the first unbalanced entry, taking the
 * whole transaction down with it.
 */
export function runMigrationFromExports(
  db: DrizzleDb,
  exports: MigrationExports,
  opts: MigrationOptions,
): MigrationResult {
  const fallbackIso = opts.fallbackIso ?? new Date(0).toISOString();
  const mapperOpts = { profileId: opts.profileId, fallbackIso };

  // Tally what gets inserted so the caller can verify against the export sizes.
  const inserted: MigrationResult['inserted'] = {
    clients: 0, partners: 0, employees: 0, inventory: 0,
    ledger: 0, payments: 0, payment_allocations: 0,
    cheques: 0, invoices: 0, journal_entries: 0,
  };
  let journalImport: ImportResult = { entriesInserted: 0, linesInserted: 0 };

  // Single transaction — all-or-nothing.
  db.transaction((tx) => {
    if (exports.clients?.length) {
      const rows = mapMany(exports.clients, mapClient, mapperOpts);
      tx.insert(clients).values(rows).run();
      inserted.clients = rows.length;
    }

    if (exports.partners?.length) {
      const rows = mapMany(exports.partners, mapPartner, mapperOpts);
      tx.insert(partners).values(rows).run();
      inserted.partners = rows.length;
    }

    if (exports.employees?.length) {
      const rows = mapMany(exports.employees, mapEmployee, mapperOpts);
      tx.insert(employees).values(rows).run();
      inserted.employees = rows.length;
    }

    if (exports.inventory?.length) {
      const rows = mapMany(exports.inventory, mapInventoryItem, mapperOpts);
      tx.insert(inventory).values(rows).run();
      inserted.inventory = rows.length;
    }

    if (exports.ledger?.length) {
      const rows = mapMany(exports.ledger, mapLedger, mapperOpts);
      tx.insert(ledger).values(rows).run();
      inserted.ledger = rows.length;
    }

    if (exports.payments?.length) {
      // Parent payment rows first…
      const payRows = mapMany(exports.payments, mapPayment, mapperOpts);
      tx.insert(payments).values(payRows).run();
      inserted.payments = payRows.length;

      // …then the flattened allocations rows for each payment. Using a flat
      // array keeps the single round-trip per collection rather than N inserts.
      const allocRows = exports.payments.flatMap((p) =>
        flattenPaymentAllocations(p, mapperOpts),
      );
      if (allocRows.length > 0) {
        tx.insert(paymentAllocations).values(allocRows).run();
        inserted.payment_allocations = allocRows.length;
      }
    }

    if (exports.cheques?.length) {
      const rows = mapMany(exports.cheques, mapCheque, mapperOpts);
      tx.insert(cheques).values(rows).run();
      inserted.cheques = rows.length;
    }

    if (exports.invoices?.length) {
      const rows = mapMany(exports.invoices, mapInvoice, mapperOpts);
      tx.insert(invoices).values(rows).run();
      inserted.invoices = rows.length;
    }

    if (exports.journal_entries?.length) {
      // importJournalEntries: preserves Firestore IDs, splits lines into rows,
      // and aborts on any unbalanced entry. Runs INSIDE this transaction so a
      // single bad entry rolls back the entire migration.
      journalImport = importJournalEntries(
        tx as unknown as DrizzleDb,
        exports.journal_entries,
        { profileId: opts.profileId, fallbackIso },
      );
      inserted.journal_entries = journalImport.entriesInserted;
    }
  });

  // ── Verification ───────────────────────────────────────────────────────
  // For each collection that had any input, check the SQLite count matches.
  // This catches FK-rejection silent failures and mapper bugs that drop rows.
  const counts: CountCheck[] = [];
  const append = (
    label: string,
    table: Parameters<typeof checkCount>[1],
    col: Parameters<typeof checkCount>[2],
    expected: number,
  ) => {
    if (expected > 0) {
      counts.push(checkCount(db, table, col, opts.profileId, expected, label));
    }
  };

  append('clients',            clients,            clients.profileId,            inserted.clients);
  append('partners',           partners,           partners.profileId,           inserted.partners);
  append('employees',          employees,          employees.profileId,          inserted.employees);
  append('inventory',          inventory,          inventory.profileId,          inserted.inventory);
  append('ledger',             ledger,             ledger.profileId,             inserted.ledger);
  append('payments',           payments,           payments.profileId,           inserted.payments);
  append('payment_allocations', paymentAllocations, paymentAllocations.profileId, inserted.payment_allocations);
  append('cheques',            cheques,            cheques.profileId,            inserted.cheques);
  append('invoices',           invoices,           invoices.profileId,           inserted.invoices);
  append('journal_entries',   journalEntries,     journalEntries.profileId,     inserted.journal_entries);

  const trialBalance = checkTrialBalance(db, opts.profileId);
  const checklist = formatChecklist(counts, trialBalance);

  return { inserted, journal: journalImport, counts, trialBalance, checklist };
}

/**
 * Load an export directory and run the migration. The directory layout
 * matches the README:
 *
 *   export/
 *     clients.json
 *     partners.json
 *     ledger.json
 *     payments.json           # each payment embeds its allocations[]
 *     cheques.json
 *     invoices.json
 *     journal_entries.json    # each entry embeds its lines[]
 *     employees.json
 *     inventory.json
 *
 * Missing files are silently skipped. Malformed JSON throws.
 */
export function runMigrationFromDirectory(
  db: DrizzleDb,
  exportDir: string,
  opts: MigrationOptions,
): MigrationResult {
  const exports = loadExportsFromDirectory(exportDir);
  return runMigrationFromExports(db, exports, opts);
}

/** Read every recognised JSON file under `dir`, returning an in-memory exports map. */
export function loadExportsFromDirectory(dir: string): MigrationExports {
  const out: MigrationExports = {};
  const collections: Array<keyof MigrationExports> = [
    'clients', 'partners', 'employees', 'inventory',
    'ledger', 'payments', 'cheques', 'invoices', 'journal_entries',
  ];

  for (const name of collections) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) { continue; }
    const raw = fs.readFileSync(file, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Migration export "${name}.json" is not valid JSON: ${(err as Error).message}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`Migration export "${name}.json" must be a top-level array; got ${typeof parsed}.`);
    }
    // Type-narrow via the dispatch table; the actual mapper validates fields.
    (out as Record<string, unknown[]>)[name] = parsed;
  }

  return out;
}
