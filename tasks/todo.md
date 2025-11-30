# Pagination Logic Bug Fix

## Problem Summary

The pagination UI shows correctly (e.g., "50 of 60", page numbers 1 and 2), but clicking page numbers or Next/Previous buttons does NOT update the table data. The same first page of data is always displayed.

**Affected pages:**
- Payments page (`src/components/payments/payments-page.tsx`)
- Ledger page (`src/components/ledger/ledger-page.tsx`)
- Likely other pages with similar pagination pattern

## Root Cause Analysis

### Payments Page (Line 181)
```typescript
const q = query(paymentsRef, orderBy("date", "desc"), limit(pageSize));
```
- The `currentPage` state is in the dependency array but **never used in the query**
- Query always fetches the first `pageSize` (50) records regardless of current page

### Ledger Page - `useLedgerData` hook (Line 42-52)
```typescript
const unsubscribe = service.subscribeLedgerEntries(
    pageSize,
    (entriesData, lastVisible) => { ... }
);
```
- Same issue: `currentPage` is passed but `subscribeLedgerEntries` doesn't use it
- The service method (`ledgerService.ts:199-225`) only uses `limit(pageSize)`

## Solution

Implement **cursor-based pagination** using Firestore's `startAfter()`. This is the recommended approach for Firestore.

**Key Changes:**
1. Track page cursors (first/last document of each page)
2. Use `startAfter(cursor)` to fetch subsequent pages
3. Store cursors in a map keyed by page number for backward navigation

---

## Implementation Plan

### Phase 1: Create Reusable Pagination Hook

- [x] **Task 1.1: Create `usePaginatedQuery` hook**
  - SKIPPED: Implemented cursor tracking directly in each component/hook for simplicity
  - Avoids over-engineering for the current use case

### Phase 2: Fix Payments Page

- [x] **Task 2.1: Update payments-page.tsx to use cursor-based pagination**
  - Added `startAfter`, `DocumentSnapshot`, `QueryConstraint` imports
  - Added `pageCursors` state using `useState<Map<number, DocumentSnapshot>>`
  - Modified useEffect to build query with `startAfter(cursor)` for pages > 1
  - Store last document of each page as cursor for next page

### Phase 3: Fix Ledger Page

- [x] **Task 3.1: Update `useLedgerData` hook**
  - Added `pageCursorsRef` using `useRef<Map<number, DocumentSnapshot>>`
  - Pass cursor to `subscribeLedgerEntries` when `currentPage > 1`
  - Store last document of each page for navigation

- [x] **Task 3.2: Update `ledgerService.subscribeLedgerEntries`**
  - Added `startAfter` and `QueryConstraint` imports
  - Accept optional `startAfterDoc?: DocumentSnapshot | null` parameter
  - Build query dynamically with `startAfter(startAfterDoc)` when cursor provided

### Phase 4: Testing & Build Verification

- [ ] **Task 4.1: Test pagination on payments page**
  - Click page 2 → verify different data loads
  - Click Previous → verify page 1 data returns
  - Verify "X of Y" count remains accurate

- [ ] **Task 4.2: Test pagination on ledger page**
  - Same tests as payments page

- [x] **Task 4.3: Run build**
  - `npm run build` - PASSED (no TypeScript errors)

---

## Technical Details

### Cursor Storage Strategy
```typescript
// Store the last document of each page
const [pageCursors, setPageCursors] = useState<Map<number, DocumentSnapshot>>(new Map());

// When fetching page N, use cursor from page N-1
const startAfterDoc = pageCursors.get(currentPage - 1) || null;
```

### Query with Cursor
```typescript
// Page 1: No cursor needed
query(collectionRef, orderBy("date", "desc"), limit(pageSize))

// Page 2+: Use cursor from previous page
query(collectionRef, orderBy("date", "desc"), startAfter(cursor), limit(pageSize))
```

---

## Files to Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/payments/payments-page.tsx` | MODIFY | Add cursor-based pagination |
| `src/components/ledger/hooks/useLedgerData.ts` | MODIFY | Add cursor tracking and pass to service |
| `src/services/ledgerService.ts` | MODIFY | Accept startAfter cursor parameter |

---

## Notes

- RTL (Right-to-Left) considerations: The "Previous" (السابق) and "Next" (التالي) buttons have inverted arrow icons for Arabic UI, but the logic should remain the same.
- The current UI shows arrows in opposite directions (ChevronRight for Previous, ChevronLeft for Next) which matches RTL expectations.

---

## Review

### Files Modified

| File | Changes |
|------|---------|
| `src/components/payments/payments-page.tsx` | Added cursor-based pagination with `startAfter()`, `pageCursors` state for tracking document cursors |
| `src/components/ledger/hooks/useLedgerData.ts` | Added `pageCursorsRef` for cursor tracking, pass cursor to service |
| `src/services/ledgerService.ts` | Updated `subscribeLedgerEntries` to accept optional `startAfterDoc` parameter |

### How It Works

1. **Page 1 Load**: Query without cursor, store last document as cursor for page 1
2. **Page 2+ Load**: Use cursor from previous page with `startAfter()`, store last document as cursor for current page
3. **Back Navigation**: Cursors are stored in a Map keyed by page number, allowing backward navigation

### Build Status

```
✓ Compiled successfully
Linting and checking validity of types passed
```

---

# Multi-Allocation Payment System

## Problem Summary

Currently, each payment in the app links to a **single** transaction via `linkedTransactionId`. This is impractical when a client wants to pay a lump sum covering multiple outstanding transactions. The user must manually create separate payment entries, which:
- Is tedious
- Makes bank reconciliation impossible (bank sees one deposit, not multiple)

## Proposed Solution

Build a **multi-allocation payment system** that:
1. Shows all unpaid/partially-paid transactions when a client is selected
2. Allows **FIFO auto-distribution** - applies payment to oldest transactions first
3. Allows **manual override** - user can allocate amounts to specific transactions
4. Implements **rollback logic** - deleting a payment reverses ALL allocations

---

## Architecture Changes

### New Data Model: `paymentAllocations` subcollection

Each payment will have a subcollection `paymentAllocations` storing how the payment is distributed:

```typescript
interface PaymentAllocation {
  id: string;
  transactionId: string;       // Ledger transaction ID
  allocatedAmount: number;     // How much of the payment went to this transaction
  transactionDate: Date;       // For sorting (FIFO reference)
  createdAt: Date;
}
```

The main `Payment` document will also track:
- `totalAllocated: number` - Sum of all allocations
- `allocationMethod: 'fifo' | 'manual'` - How it was allocated

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/payments/types.ts` | **CREATE** | Type definitions for allocations |
| `src/components/payments/MultiAllocationDialog.tsx` | **CREATE** | New dialog for multi-allocation payments |
| `src/components/payments/hooks/useClientTransactions.ts` | **CREATE** | Hook to fetch client's unpaid transactions |
| `src/components/payments/hooks/usePaymentAllocations.ts` | **CREATE** | Hook for allocation CRUD and FIFO logic |
| `src/components/payments/payments-page.tsx` | **MODIFY** | Add button to open new dialog |
| `src/lib/arap-utils.ts` | **MODIFY** | Add batch allocation/reversal functions |

---

## Implementation Plan

### Phase 1: Foundation (Types & Hooks)

- [x] **Task 1.1: Create types.ts**
  - Define `PaymentAllocation` interface
  - Define `UnpaidTransaction` interface (for listing client's debts)
  - Define `AllocationEntry` interface (for UI state)
  - Export all necessary types

- [x] **Task 1.2: Create useClientTransactions hook**
  - Fetch all ledger entries where `associatedParty === clientName` AND `isARAPEntry === true`
  - Filter to only `paymentStatus !== 'paid'` (unpaid or partial)
  - Sort by date (oldest first for FIFO)
  - Return list with `id`, `transactionId`, `date`, `amount`, `totalPaid`, `remainingBalance`

- [x] **Task 1.3: Create usePaymentAllocations hook**
  - `autoDistributeFIFO(amount, transactions)` - FIFO distribution logic
  - `saveAllocations(paymentId, allocations)` - Save to Firestore subcollection
  - `reverseAllocations(paymentId)` - Fetch allocations and reverse each one

### Phase 2: AR/AP Utilities

- [x] **Task 2.1: Add batch allocation functions to arap-utils.ts**
  - `isMultiAllocationPayment()` - Check if payment has multi-allocation
  - `updateLedgerEntryById()` - Update ledger AR/AP by document ID
  - Handle atomic updates (batch writes)

### Phase 3: UI Components

- [x] **Task 3.1: Create MultiAllocationDialog component**
  - Client selector dropdown with autocomplete
  - Payment amount input
  - Payment date input
  - "Auto-Distribute (FIFO)" button
  - Table showing client's unpaid transactions with:
    - Date, Description, Total Amount, Remaining Balance, **Allocation Input**
  - Manual input fields for each transaction
  - Running total of allocations vs payment amount
  - Save/Cancel buttons
  - Visual indicator when allocation sum !== payment amount

- [x] **Task 3.2: Update payments-page.tsx**
  - Add "دفعة متعددة" (Multi-Allocation Payment) button
  - Import and integrate `MultiAllocationDialog`
  - Update delete handler to use new reversal logic

### Phase 4: Delete/Rollback Logic

- [x] **Task 4.1: Implement rollback on payment delete**
  - When deleting a payment, check if it has allocations using `isMultiAllocationPayment()`
  - Fetch all allocations from subcollection
  - Call `reversePaymentAllocations()` to restore ledger balances
  - Delete allocations subcollection
  - Delete payment document

### Phase 5: Testing & Verification

- [ ] **Task 5.1: Manual testing scenarios**
  - Test FIFO distribution with exact payment amount
  - Test FIFO with partial payment (covers some transactions fully, one partially)
  - Test FIFO with overpayment
  - Test manual allocation
  - Test delete reversal (verify ledger balances restored)
  - Test edge cases (no unpaid transactions, zero remaining balance)

- [x] **Task 5.2: Build verification**
  - Run `npm run build` - no TypeScript errors (PASSED)

---

## Key Design Decisions

1. **Subcollection vs Array**: Using a subcollection for allocations allows:
   - Easy querying of allocations per payment
   - No document size limits
   - Atomic deletion of payment + allocations

2. **FIFO is Default**: Oldest transactions get paid first, which matches standard accounting practice

3. **Manual Override**: Users can override FIFO by typing amounts directly

4. **Allocations stored with payment**: Makes rollback simple - just read the allocations subcollection

5. **Allocation sum validation**: Allow saving even if sum !== payment (for flexibility), but show warning

---

## Out of Scope

- Bulk import of payments from bank statements
- Payment method tracking (cash/cheque/transfer) - existing field covers this
- Currency conversion

---

## Review

### Files Created

| File | Purpose |
|------|---------|
| `src/components/payments/types.ts` | Type definitions for multi-allocation payments |
| `src/components/payments/MultiAllocationDialog.tsx` | Main dialog component for creating multi-allocation payments |
| `src/components/payments/hooks/useClientTransactions.ts` | Hook to fetch client's unpaid/partial transactions |
| `src/components/payments/hooks/usePaymentAllocations.ts` | Hook with FIFO logic, save, and reversal functions |

### Files Modified

| File | Changes |
|------|---------|
| `src/components/payments/payments-page.tsx` | Added "دفعة متعددة" button, multi-allocation dialog integration, updated delete handler for rollback |
| `src/lib/arap-utils.ts` | Added `isMultiAllocationPayment()` and `updateLedgerEntryById()` helper functions |

### How It Works

1. **Creating a Multi-Allocation Payment**:
   - User clicks "دفعة متعددة" button
   - Selects a client from autocomplete dropdown
   - System fetches all unpaid/partial AR/AP transactions for that client
   - User enters payment amount
   - User clicks "توزيع تلقائي (FIFO)" to auto-distribute, OR manually enters amounts per transaction
   - System saves payment + allocations subcollection + updates each ledger entry

2. **FIFO Distribution**:
   - Transactions sorted by date (oldest first)
   - Payment amount applied to oldest transaction until fully paid
   - Remaining amount flows to next transaction
   - Continues until payment exhausted or all debts covered

3. **Rollback on Delete**:
   - When deleting a multi-allocation payment
   - System fetches all allocations from subcollection
   - Reverses each ledger entry's `totalPaid`, `remainingBalance`, `paymentStatus`
   - Deletes allocations and payment document

### UI Features

- Client autocomplete dropdown
- Summary cards showing: Total Outstanding, Payment Amount, Difference
- Transaction table with editable allocation inputs
- Visual indicator for balanced/unbalanced allocations
- Purple badge in payments table showing "X معاملات" for multi-allocation payments

### Build Status

```
Compiled successfully
Linting and checking validity of types passed
```

All code tasks completed. Ready for Vercel preview testing.
