# Fix: Race Condition in Journal Entry Creation

## Problem Analysis

In `LedgerService.ts`, journal entries are created with fire-and-forget async calls AFTER `batch.commit()`:

```typescript
// Lines 459-481 in LedgerService.ts
await batch.commit();  // Ledger entry committed

// Fire-and-forget - can fail silently!
createJournalEntryForLedger(...).catch((err) => console.error(...));
createJournalEntryForCOGS(...).catch((err) => console.error(...));
```

**Risk**: If batch commits but journal creation fails, ledger and journal become out of sync.

## Solution

Create batch-compatible versions of journal entry functions that add to an existing `WriteBatch` instead of using `addDoc`. This ensures journal entries are part of the same atomic batch as ledger entries.

### Key Locations

| File | Function | Issue |
|------|----------|-------|
| `journalService.ts:329` | `createJournalEntryForLedger` | Uses `addDoc` (standalone) |
| `journalService.ts:374` | `createJournalEntryForCOGS` | Uses `addDoc` (standalone) |
| `LedgerService.ts:328` | `createSimpleLedgerEntry` | Fire-and-forget after addDoc |
| `LedgerService.ts:460` | `createLedgerEntryWithRelated` | Fire-and-forget after batch.commit |
| `LedgerService.ts:474` | `createLedgerEntryWithRelated` | Fire-and-forget COGS after batch.commit |

---

## Todo List

- [x] **1. Add batch versions in journalService.ts**
  - Create `addJournalEntryToBatch(batch, userId, data)` function
  - Create `addCOGSJournalEntryToBatch(batch, userId, data)` function
  - These add to WriteBatch instead of using addDoc
  - Keep existing async functions unchanged for backwards compatibility

- [x] **2. Update createLedgerEntryWithRelated**
  - Import batch functions in LedgerService.ts
  - Call `addJournalEntryToBatch` BEFORE `batch.commit()`
  - Call `addCOGSJournalEntryToBatch` BEFORE `batch.commit()` (when COGS exists)
  - Remove fire-and-forget `.catch()` calls
  - Add clear error handling with Arabic error message

- [x] **3. Update createSimpleLedgerEntry**
  - Convert to use WriteBatch instead of addDoc
  - Call `addJournalEntryToBatch` before batch.commit()
  - Remove fire-and-forget call
  - Add clear error handling with Arabic error message

- [x] **4. Verify TypeScript compiles**
  - Run `npx tsc --noEmit` - PASSED

- [x] **5. Run tests**
  - Run full test suite - ALL TESTS PASSED

- [x] **6. Build verification**
  - Run `npm run build` - BUILD SUCCEEDED

---

## Review Section

### Summary of Changes

Fixed a race condition where journal entries were created asynchronously after ledger entries, potentially causing data desync. Journal entries are now part of the same atomic Firestore batch.

### Files Modified

| File | Changes |
|------|---------|
| `src/services/journalService.ts` | Added `WriteBatch` import, `JournalEntryBatchData` interface, `COGSJournalEntryBatchData` interface, `addJournalEntryToBatch()` function, `addCOGSJournalEntryToBatch()` function |
| `src/services/ledger/LedgerService.ts` | Updated import to use batch functions, refactored `createSimpleLedgerEntry` to use WriteBatch, refactored `createLedgerEntryWithRelated` to call journal batch functions before commit, added clear error handling |

### New Functions Added

```typescript
// journalService.ts

// Internal helper (DRY) - not exported
function addValidatedJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  lines: JournalLine[],
  description: string,
  date: Date,
  linkedTransactionId: string | null,
  linkedDocumentType: 'ledger' | 'inventory'
): void

// Add journal entry to an existing batch (atomic with ledger)
export function addJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  data: JournalEntryBatchData
): void

// Add COGS journal entry to an existing batch
export function addCOGSJournalEntryToBatch(
  batch: WriteBatch,
  userId: string,
  data: COGSJournalEntryBatchData
): void
```

### Clean Code Standards Applied

- **DRY**: Extracted `addValidatedJournalEntryToBatch` helper to avoid code duplication
- **Single Responsibility**: Each function has one clear purpose
- **Clear naming**: Function names describe what they do
- **Type safety**: Interfaces define expected data shapes
- **Proper error handling**: ValidationError thrown for invalid inputs

### Error Handling

Both functions now return a clear error message on batch failure:
```typescript
return {
  success: false,
  error: "حدث خطأ أثناء حفظ الحركة المالية والقيد المحاسبي",
};
```

### Backwards Compatibility

- Existing async functions (`createJournalEntryForLedger`, `createJournalEntryForCOGS`) remain unchanged
- No breaking changes to public API

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Tests | All tests passed |
| Build | Production build succeeded |

---

## Expected Outcome

After the fix:
- If `batch.commit()` succeeds -> ledger AND journal entries guaranteed to exist
- If `batch.commit()` fails -> nothing is written (atomic rollback)
- Error messages clearly indicate both ledger and journal operations were affected
