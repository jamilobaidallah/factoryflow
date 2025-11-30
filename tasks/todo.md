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
