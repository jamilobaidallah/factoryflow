# Add: Cheque State Machine Validation

## Problem Analysis

Cheques have implicit states (PENDING, CASHED, ENDORSED, BOUNCED) but no validation to prevent invalid state transitions. For example:
- A CASHED cheque could be endorsed (money already received)
- A BOUNCED cheque could be cashed again (bank rejected it)
- An ENDORSED cheque could be modified (transferred to another party)

**Risk**: Invalid state transitions can cause accounting inconsistencies and data corruption.

## Solution

Created a simple, clean state machine utility that defines valid transitions and validation functions. The validation guards are added at entry points in the cheque operation hooks.

### State Machine Diagram

```
PENDING → CASHED | ENDORSED | BOUNCED | RETURNED | CANCELLED | DELETED
CASHED → BOUNCED | RETURNED | PENDING (reversal)
ENDORSED → (terminal state - no transitions allowed)
BOUNCED → (terminal state - no transitions allowed)
RETURNED → (terminal state - no transitions allowed)
CANCELLED → (terminal state - no transitions allowed)
COLLECTED → BOUNCED | RETURNED
```

---

## Todo List

- [x] **1. Explore codebase for existing structure**
  - Located CHEQUE_STATUS_AR constants in `src/lib/constants.ts`
  - Identified cheque operation hooks in `src/components/cheques/hooks/`
  - Found three main operation files: useChequesOperations.ts, useIncomingChequesOperations.ts, useOutgoingChequesOperations.ts

- [x] **2. Create lib/chequeStateMachine.ts**
  - Defined valid state transitions as a simple map
  - Created `canTransition(fromStatus, toStatus): boolean` function
  - Created `validateTransition(fromStatus, toStatus): void` function (throws on invalid)
  - Created `canDelete(currentStatus): boolean` function
  - Created `validateDeletion(currentStatus): void` function (throws on invalid)
  - Created `getValidTransitions(currentStatus): ChequeStatusValue[]` helper
  - Created `InvalidChequeTransitionError` custom error class

- [x] **3. Add validation guards to cheque operations**
  - Added guards to `useChequesOperations.ts`:
    - `clearCheque()` - validates PENDING → CASHED
    - `bounceCheque()` - validates PENDING/CASHED → BOUNCED
    - `endorseCheque()` - validates PENDING → ENDORSED
    - `deleteCheque()` - validates deletion is allowed
  - Added guards to `useIncomingChequesOperations.ts`:
    - `endorseCheque()` - validates PENDING → ENDORSED
  - Added guards to `useOutgoingChequesOperations.ts`:
    - `submitCheque()` status changes - validates transitions

- [x] **4. Write unit tests**
  - Created `src/lib/__tests__/chequeStateMachine.test.ts`
  - 43 tests covering all functions and business rules
  - All tests passing

- [x] **5. Verify TypeScript compiles**
  - Run `npx tsc --noEmit` - PASSED

---

## Review Section

### Summary of Changes

Added cheque state machine validation to prevent invalid state transitions. The implementation is simple, clean, and follows the existing codebase patterns.

### Files Created

| File | Description |
|------|-------------|
| `src/lib/chequeStateMachine.ts` | State machine utility with transition validation |
| `src/lib/__tests__/chequeStateMachine.test.ts` | Unit tests (43 tests) |

### Files Modified

| File | Changes |
|------|---------|
| `src/components/cheques/hooks/useChequesOperations.ts` | Added imports and validation guards to clearCheque, bounceCheque, endorseCheque, deleteCheque |
| `src/components/cheques/hooks/useIncomingChequesOperations.ts` | Added imports and validation guard to endorseCheque |
| `src/components/cheques/hooks/useOutgoingChequesOperations.ts` | Added imports and validation guards to submitCheque status transitions |

### New Functions Added

```typescript
// chequeStateMachine.ts

// Check if transition is valid
export function canTransition(
  fromStatus: ChequeStatusValue,
  toStatus: ChequeStatusValue
): boolean

// Check if deletion is allowed
export function canDelete(currentStatus: ChequeStatusValue): boolean

// Validate transition (throws InvalidChequeTransitionError if invalid)
export function validateTransition(
  fromStatus: ChequeStatusValue,
  toStatus: ChequeStatusValue
): void

// Validate deletion (throws InvalidChequeTransitionError if not allowed)
export function validateDeletion(currentStatus: ChequeStatusValue): void

// Get list of valid target states (useful for UI)
export function getValidTransitions(
  currentStatus: ChequeStatusValue
): ChequeStatusValue[]

// Custom error class with Arabic error messages
export class InvalidChequeTransitionError extends Error
```

### Clean Code Standards Applied

- **Simple design**: Single file, ~150 lines, easy to understand
- **Clear naming**: Function names describe what they do
- **Type safety**: Uses existing CHEQUE_STATUS_AR constants
- **Fail fast**: Validation at entry points with clear error messages
- **No over-engineering**: No complex frameworks or patterns
- **Arabic error messages**: User-friendly messages for Arabic-speaking users

### Error Handling

All validation guards show clear toast messages in Arabic:
```typescript
toast({
  title: "عملية غير مسموحة",
  description: error.message, // e.g., "لا يمكن تغيير حالة الشيك من "مجيّر" إلى "تم الصرف""
  variant: "destructive",
});
```

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Unit Tests | 43 tests passed |
| Business Rules | All validated |

---

## Expected Outcome

After the fix:
- Invalid state transitions are blocked at entry points
- Users see clear Arabic error messages explaining why operation is not allowed
- Terminal states (ENDORSED, BOUNCED) cannot be modified
- Deleted cheques must be in PENDING state
- Business logic is centralized in one small utility file

---

## Previous Task: Fix Race Condition in Journal Entry Creation

### Problem Analysis

In `LedgerService.ts`, journal entries were created with fire-and-forget async calls AFTER `batch.commit()`:

```typescript
// Lines 459-481 in LedgerService.ts
await batch.commit();  // Ledger entry committed

// Fire-and-forget - can fail silently!
createJournalEntryForLedger(...).catch((err) => console.error(...));
createJournalEntryForCOGS(...).catch((err) => console.error(...));
```

**Risk**: If batch commits but journal creation fails, ledger and journal become out of sync.

### Solution

Created batch-compatible versions of journal entry functions that add to an existing `WriteBatch` instead of using `addDoc`. This ensures journal entries are part of the same atomic batch as ledger entries.

### Files Modified

| File | Changes |
|------|---------|
| `src/services/journalService.ts` | Added `WriteBatch` import, `JournalEntryBatchData` interface, `COGSJournalEntryBatchData` interface, `addJournalEntryToBatch()` function, `addCOGSJournalEntryToBatch()` function |
| `src/services/ledger/LedgerService.ts` | Updated import to use batch functions, refactored `createSimpleLedgerEntry` to use WriteBatch, refactored `createLedgerEntryWithRelated` to call journal batch functions before commit, added clear error handling |

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Tests | All tests passed |
| Build | Production build succeeded |
