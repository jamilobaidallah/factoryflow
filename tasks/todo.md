# Fix: WriteBatch vs runTransaction Misuse

## Issue Summary
**Severity**: HIGH
**Location**: `src/services/ledgerService.ts`

### The Problem
`WriteBatch` provides **atomicity** (all-or-nothing) but **NOT isolation**.

In `handleInventoryUpdateBatch` and `deleteLedgerEntry`, we:
1. READ data outside the batch (`getDocs`)
2. Calculate new values using that data
3. WRITE inside batch (`batch.update`)

**Race Condition**: The read data can become stale between the read and batch commit. If two users update the same inventory item simultaneously, one update will be lost.

### Affected Code

**1. `handleInventoryUpdateBatch` (lines 1413-1573)**
```typescript
// Line 1427: READ outside batch - can be stale!
const itemSnapshot = await getDocs(itemQuery);
const currentQuantity = existingItemData.quantity || 0;

// Line 1473-1484: WRITE with potentially stale data!
batch.update(itemDocRef, { quantity: newQuantity });
```

**2. `deleteLedgerEntry` (lines 619-724)**
```typescript
// Lines 664-665: READ outside batch
const itemQuery = query(this.inventoryRef, where("__name__", "==", itemId));
const itemSnapshot = await getDocs(itemQuery);
const currentQuantity = itemDoc.data().quantity || 0;

// Lines 683-684: WRITE with potentially stale data
batch.update(itemDocRef, { quantity: validatedQuantity });
```

---

## Solution
Replace `writeBatch` with `runTransaction` for read-modify-write operations on inventory.

`runTransaction` provides:
- **Isolation**: Reads are consistent - if data changes, transaction retries
- **Automatic retry**: Retries on conflicts (up to 5 times by default)
- **Atomicity**: All operations succeed or fail together

---

## Todo List

- [x] **1. Add `runTransaction` import** from firebase/firestore
- [x] **2. Refactor `handleInventoryUpdateBatch`**
  - Convert from batch helper to transaction-based approach
  - Read inventory inside transaction
  - Perform all inventory calculations inside transaction
  - Return data needed for remaining batch operations (COGS, movement records)
- [x] **3. Refactor `deleteLedgerEntry` inventory reversion**
  - Move inventory read-modify-write into transaction
  - Keep non-inventory batch operations as-is (they're write-only)
- [x] **4. Update `createLedgerEntryWithRelated`**
  - No changes needed - already calls refactored `handleInventoryUpdateBatch`
- [x] **5. Verify no regressions**
  - TypeScript compiles ✓
  - Tests pass (1110/1110) ✓
  - Build succeeds ✓

---

## Implementation Strategy

### Current (BROKEN):
```typescript
// READ - can be stale by commit time!
const itemSnapshot = await getDocs(itemQuery);
const currentQuantity = existingItemData.quantity || 0;

// ... later ...
batch.update(itemDocRef, { quantity: newQuantity }); // Using STALE data!
```

### After (CORRECT):
```typescript
await runTransaction(firestore, async (transaction) => {
  // READ inside transaction - guaranteed fresh
  const itemDoc = await transaction.get(itemDocRef);
  const currentQuantity = itemDoc.data()?.quantity || 0;

  // Calculate new value
  const newQuantity = currentQuantity + quantityChange;

  // WRITE inside same transaction - isolated
  transaction.update(itemDocRef, { quantity: newQuantity });
});
```

### Key Design Decisions

1. **Separate transaction for inventory, batch for the rest**
   - Inventory operations need isolation (runTransaction)
   - Other operations (cheques, payments) are write-only and can use batch

2. **Transaction scope**: Only inventory item and movement
   - Ledger entry creation stays in batch (no read-modify-write)
   - COGS record stays in batch (write-only)

---

## Review Section

### Changes Made

**File Modified:** `src/services/ledgerService.ts`

**1. Added imports:**
- `runTransaction` from firebase/firestore
- `getDoc` from firebase/firestore

**2. Refactored `handleInventoryUpdateBatch` (lines 1415-1609):**
- Wrapped inventory read-modify-write in `runTransaction`
- Reads quantity inside transaction (guaranteed fresh)
- Calculates weighted average cost inside transaction
- Updates inventory inside transaction (isolated from concurrent updates)
- Returns `currentUnitPrice` for COGS calculation
- Added proper error handling with user-friendly messages

**3. Refactored `deleteLedgerEntry` (lines 618-733):**
- Wrapped inventory reversion in `runTransaction` for each movement
- Reads current quantity inside transaction
- Calculates reverted quantity inside transaction
- Uses `assertNonNegative` for data integrity validation
- Updates inside transaction (isolated from concurrent deletes)

### What This Fixes

**Before (Race Condition):**
```
User A reads quantity=10
User B reads quantity=10
User A writes quantity=15 (added 5)
User B writes quantity=17 (added 7)
Result: quantity=17 (User A's update LOST!)
```

**After (Transaction Isolation):**
```
User A reads quantity=10 inside transaction
User B reads quantity=10 inside transaction
User A writes quantity=15
User B's transaction detects conflict, RETRIES
User B re-reads quantity=15, writes quantity=22
Result: quantity=22 (Both updates preserved!)
```

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Tests | 1110/1110 passed |
| Build | Production build succeeds |

### Notes

- Write-only operations (cheques, payments, movements, COGS) remain in `writeBatch` - no race condition for writes
- Transaction scope is minimal (only inventory item updates) to reduce contention
- Firestore transactions automatically retry up to 5 times on conflicts

