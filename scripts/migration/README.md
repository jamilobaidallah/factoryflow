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

> The **export** step and the **full live run** are intentionally not automated
> here — they require Firebase service-account credentials, which live only on
> your machine. The integrity-critical *transformation* logic is what's been
> built and proven against a real in-memory database.

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

### 2. Transform + import into a profile's SQLite db

Wire the helpers into a runner that opens the target profile DB and imports
inside a single transaction (so any failure rolls back the whole migration):

```ts
import { getDatabase } from '@/lib/database';
import { importJournalEntries } from './import';

const db = getDatabase(profile.dbPath);
const journalDocs = JSON.parse(fs.readFileSync('export/journal_entries.json', 'utf8'));

// One transaction = all-or-nothing, same guarantee as Firestore WriteBatch
db.transaction(() => {
  importJournalEntries(db, journalDocs, { profileId: profile.id });
  // ...import clients, ledger, payments (+flattenPaymentAllocations), etc.
})();
```

Order matters where foreign keys apply: chart_of_accounts → clients/partners →
ledger → journal_entries → payments → payment_allocations.

### 3. Verify (do not skip — blocks go-live)

```ts
import { checkCount, checkTrialBalance, formatChecklist } from './verify';
import { journalEntries } from '@/lib/schema';

const counts = [
  checkCount(db, journalEntries, journalEntries.profileId, profile.id, firebaseJournalCount, 'journal_entries'),
  // ...one per collection, expected counts taken from the Firebase export
];
const tb = checkTrialBalance(db, profile.id);

console.log(formatChecklist(counts, tb));
if (!tb.isBalanced) throw new Error('Trial balance ≠ 0 — migration rejected.');
```

Then the plan's manual spot checks: 20 random ledger entries, 5 client
balances, and 5 journal entries verified field-by-field against Firebase.

## Status / remaining work

- [x] Timestamp, journal-split, allocation-flatten transforms (+ tests)
- [x] Journal import with per-entry balance enforcement (+ integration test)
- [x] Count + trial-balance verification helpers
- [ ] Per-collection field mappers for the simpler tables (clients, partners,
      ledger, cheques, …) — straightforward column maps, add as the export
      shapes are confirmed against real data
- [ ] Export script (Admin SDK) — runs on your machine with credentials
- [ ] End-to-end runner that ties export → transform → import → verify together
