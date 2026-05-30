# Phase 6 — Data Migration (Firebase → SQLite)

Moves a profile's real business data out of Firestore and into its local
`data.db`. Follows the plan's Phase 6: **always work on copies, never touch the
live Firebase data.**

## What's built and tested here

| File | Responsibility | Tested |
|------|----------------|--------|
| `transform.ts` | Pure Firestore→SQLite transforms: `Timestamp`→UTC ISO, journal `lines[]`→rows, payment `allocations[]`→rows | ✅ unit |
| `import.ts` | Inserts journal entries into SQLite preserving Firestore IDs; enforces debits = credits per entry | ✅ integration (trial balance = 0) |
| `verify.ts` | Post-import checks: per-collection counts + trial balance | ✅ via integration |
| `mappers.ts` | Per-collection field mappers (clients, partners, ledger, cheques, payments, inventory, employees, invoices) — Firestore doc → SQLite insert row, preserving IDs | ✅ unit + round-trip (27 tests) |
| `runner.ts` | End-to-end orchestrator: load JSON exports → map all collections in FK-safe order → verify → return printable checklist. One transaction so any failure rolls back. | ✅ integration (12 tests covering full-fixture migration + atomicity) |

> The **export** step and the **full live run** are intentionally not automated
> here — they require Firebase service-account credentials, which live only on
> your machine. The integrity-critical *transformation*, *import*,
> *verification*, and *orchestration* logic is what's been built and proven
> against a real in-memory database.

## Runbook (on your machine)

### 1. Export from Firebase (work on a copy)

Export each collection to JSON under `export/`. Either:
- Firebase Console → Firestore → Export, or
- a small script using the Admin SDK that reads each collection (and the
  `payments/{id}/allocations` subcollection) to `export/<collection>.json`.

```
export/
  ledger.json
  journal_entries.json
  payments.json            # include each payment's allocations array
  clients.json
  partners.json
  chart_of_accounts.json
  cheques.json
  ...
```

### 2. Run the migration

The orchestrator handles loading, mapping in FK-safe order, atomic insert,
and verification — all in a single transaction:

```ts
import { getDatabase } from '@/lib/database';
import { runMigrationFromDirectory } from './runner';

const db = getDatabase(profile.dbPath);
const result = runMigrationFromDirectory(db, 'export/', { profileId: profile.id });

console.log(result.checklist);
if (!result.trialBalance.isBalanced) {
  throw new Error('Trial balance ≠ 0 — migration rejected.');
}
```

If anything fails (mapper throws, unbalanced journal entry, FK violation),
the whole transaction rolls back and the database is left untouched.

If documents are already in memory (e.g. fetched directly via the Admin SDK
without writing JSON files), use the in-memory variant:

```ts
import { runMigrationFromExports } from './runner';

const result = runMigrationFromExports(db, {
  clients:         exportedClients,
  ledger:          exportedLedger,
  payments:        exportedPaymentsWithAllocations,
  journal_entries: exportedJournalsWithLines,
  // ...
}, { profileId: profile.id });
```

### 3. Spot-check against Firebase

The runner already verifies counts and trial balance. The plan also requires
manual spot checks before go-live:

- 20 random ledger entries — field-by-field against Firebase
- 5 client balances — match the Firebase dashboard
- 5 journal entries — every debit/credit line matches

## Status / remaining work

- [x] Timestamp, journal-split, allocation-flatten transforms (+ tests)
- [x] Journal import with per-entry balance enforcement (+ integration test)
- [x] Count + trial-balance verification helpers
- [x] Per-collection field mappers (8 collections — preserve Firestore IDs)
- [x] End-to-end runner with FK-safe ordering, atomicity, and verification
- [ ] Export script (Admin SDK) — runs on your machine with credentials
- [ ] Live run against real Firebase data (one-time, at go-live)
