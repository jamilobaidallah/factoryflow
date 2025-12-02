# Fix Race Condition in AR/AP Updates (CRITICAL)

## Problem Summary

The AR/AP utility functions in `arap-utils.ts` suffer from a classic **Read-Modify-Write race condition**. When concurrent payments are processed, updates can be lost:

```
Time    User A (pays 100 JOD)              User B (pays 50 JOD)
─────────────────────────────────────────────────────────────
T1      READ: totalPaid = 0
T2                                          READ: totalPaid = 0
T3      CALCULATE: 0 + 100 = 100
T4                                          CALCULATE: 0 + 50 = 50
T5      WRITE: totalPaid = 100
T6                                          WRITE: totalPaid = 50  ← OVERWRITES!

RESULT: 150 JOD paid, but totalPaid = 50 JOD (Lost 100 JOD!)
```

### Why `writeBatch` Doesn't Fix This

The previous fix converted operations to use `writeBatch` for **atomicity** (all writes succeed or fail together). However, `writeBatch` does NOT solve the race condition because:

1. Each request still reads the current value independently
2. Each request calculates new value based on stale data
3. The batch commits happen, but the last one wins (overwriting earlier updates)

---

## Affected Functions

| Function | Location | Pattern |
|----------|----------|---------|
| `updateARAPOnPaymentAdd` | arap-utils.ts:59-123 | READ → MODIFY → WRITE |
| `reverseARAPOnPaymentDelete` | arap-utils.ts:134-198 | READ → MODIFY → WRITE |
| `updateLedgerEntryById` | arap-utils.ts:277-330 | READ → MODIFY → WRITE |

---

## Solution: Firestore Transactions

Use `runTransaction()` instead of separate read/write operations. Firestore transactions provide **optimistic concurrency control**:

1. Read document inside transaction
2. Modify data
3. Write back
4. **If another client modified the document between read and write, Firestore automatically retries the transaction**

### Technical Design

**Before (Race Condition):**
```typescript
export async function updateARAPOnPaymentAdd(...) {
  // READ - can be stale!
  const snapshot = await getDocs(query);
  const currentTotalPaid = data.totalPaid || 0;

  // MODIFY - based on stale data
  const newTotalPaid = currentTotalPaid + paymentAmount;

  // WRITE - can overwrite concurrent updates!
  await updateDoc(docRef, { totalPaid: newTotalPaid });
}
```

**After (Transaction - Race-Safe):**
```typescript
export async function updateARAPOnPaymentAdd(...) {
  return runTransaction(firestore, async (transaction) => {
    // READ inside transaction - Firestore tracks this
    const snapshot = await transaction.get(docRef);
    const currentTotalPaid = data.totalPaid || 0;

    // MODIFY
    const newTotalPaid = currentTotalPaid + paymentAmount;

    // WRITE - if document changed since read, transaction retries!
    transaction.update(docRef, { totalPaid: newTotalPaid });

    return result;
  });
}
```

---

## Implementation Plan

### Phase 1: Update arap-utils.ts Functions

- [x] **Task 1.1: Fix `updateARAPOnPaymentAdd`**
  - Wrap in `runTransaction`
  - Move query inside transaction
  - Use `transaction.get()` for reads
  - Use `transaction.update()` for writes

- [x] **Task 1.2: Fix `reverseARAPOnPaymentDelete`**
  - Wrap in `runTransaction`
  - Move query inside transaction
  - Use `transaction.get()` for reads
  - Use `transaction.update()` for writes

- [x] **Task 1.3: Fix `updateLedgerEntryById`**
  - Wrap in `runTransaction`
  - Use `transaction.get()` for reads
  - Use `transaction.update()` for writes

### Phase 2: Update Existing Batch Callers

The previous fix converted many operations to use `writeBatch`. These callers inline the ARAP updates. We need to check if they also need transaction protection.

- [x] **Task 2.1: Review ledgerService.ts batch operations**
  - Checked: ARAP updates in batches read data BEFORE batch creation
  - Finding: Still vulnerable to race conditions (separate issue)

- [x] **Task 2.2: Review cheque hooks batch operations**
  - Checked: useChequesOperations.ts, useIncomingChequesOperations.ts, useOutgoingChequesOperations.ts
  - Finding: All inline ARAP updates, same vulnerability pattern (separate issue)

### Phase 3: Update Tests

- [x] **Task 3.1: Update arap-utils.test.ts**
  - Mock `runTransaction` instead of separate read/write
  - Updated helper functions for transaction pattern
  - All 64 tests passing

### Phase 4: Verification

- [x] **Task 4.1: Run TypeScript build**
  - `npm run build` - passed with no type errors

- [x] **Task 4.2: Run unit tests**
  - `npm test` - all 986 tests pass

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/arap-utils.ts` | Convert 3 functions to use `runTransaction` |
| `src/lib/__tests__/arap-utils.test.ts` | Update mocks for transaction pattern |
| Possibly: ledgerService.ts, cheque hooks | If inlined ARAP updates need fixing |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing callers | Function signatures remain the same |
| Transaction failures | Firestore auto-retries up to 5 times |
| Performance | Minimal - transactions add ~1-2ms latency |
| Batch integration | Transactions can be composed with batches if needed |

---

## Notes

- Transactions automatically retry up to 5 times on conflicts
- Transaction reads MUST use `transaction.get()`, not `getDocs()`
- Transactions have a max duration of 60 seconds
- This is the standard pattern for preventing lost updates in distributed systems

---

## Review - Implementation Complete

### Summary

Fixed the **Read-Modify-Write race condition** in 3 AR/AP utility functions by converting them to use Firestore `runTransaction()`. This ensures that concurrent payment updates cannot overwrite each other.

### Changes Made

| File | Changes |
|------|---------|
| `src/lib/arap-utils.ts` | Converted `updateARAPOnPaymentAdd`, `reverseARAPOnPaymentDelete`, and `updateLedgerEntryById` to use `runTransaction` |
| `src/lib/__tests__/arap-utils.test.ts` | Updated mocks to use `mockRunTransaction`, `mockTransactionGet`, `mockTransactionUpdate` |

### Key Technical Changes

1. **Two-Step Pattern**: Query to find document ID (outside transaction), then use transaction for atomic read-modify-write
2. **Error Handling**: Throw specific errors inside transaction, catch and convert to user-friendly messages outside
3. **Fresh Reads**: `transaction.get()` ensures we always read the latest data, and Firestore will retry if it changes before commit

### What This Fixes

**Before (Race Condition):**
```
User A pays 100 JOD → reads totalPaid=0 → writes totalPaid=100
User B pays 50 JOD  → reads totalPaid=0 → writes totalPaid=50 (OVERWRITES!)
Result: 150 JOD paid, but totalPaid=50 (LOST 100 JOD!)
```

**After (Transaction):**
```
User A pays 100 JOD → transaction reads totalPaid=0 → writes totalPaid=100 ✓
User B pays 50 JOD  → transaction reads totalPaid=0 → CONFLICT DETECTED → RETRY
                    → transaction reads totalPaid=100 → writes totalPaid=150 ✓
Result: 150 JOD paid, totalPaid=150 (CORRECT!)
```

### Known Limitation (Future Work)

The inlined ARAP updates in `ledgerService.ts` and cheque hooks still have the race condition because they:
1. Read data BEFORE creating the batch
2. Use `writeBatch` which doesn't protect against stale reads

This is a **separate issue** that would require converting those methods from `writeBatch` to `runTransaction`. The current fix addresses the core `arap-utils.ts` functions as specified.

### Verification

- **TypeScript Build**: ✅ Passed (no type errors)
- **Unit Tests**: ✅ All 986 tests pass
- **API Compatibility**: ✅ Function signatures unchanged

---
