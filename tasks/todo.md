# Task: Extract ChequeFormCard Component + Bug Fixes

## Part 1: ChequeFormCard Extraction

Extracted duplicate cheque form code from `LedgerFormDialog.tsx` into a new reusable `ChequeFormCard` component.

- [x] Create `src/components/ledger/forms/ChequeFormCard.tsx`
- [x] Integrate into LedgerFormDialog.tsx
- [x] Line count reduction: 1,151 → 967 lines (16%)

---

## Part 2: Bug Fix - Cashed Cheques

### Bug Description
When creating a ledger entry with a "cashed" outgoing cheque:
1. Payment record was missing `category` and `subCategory` fields
2. Ledger entry's `paymentStatus` remained undefined instead of "paid"

### Root Cause
1. `chequeHandlers.ts` wasn't including category fields in payment records
2. `LedgerService.ts` only set AR/AP fields when `trackARAP` was explicitly enabled

### Fix Applied

- [x] Added `category` and `subCategory` to payment records in `chequeHandlers.ts`
  - Incoming cashed cheques (lines 66-67)
  - Outgoing cashed cheques (lines 155-156)
  - Outgoing endorsed cheques (lines 169-170)

- [x] Updated `LedgerService.ts` to track payment status for cashed cheques
  - Added `hasCashedCheques` detection (lines 396-403)
  - Modified `calculateARAPTracking` to accept `hasCashedCheques` parameter
  - Set AR/AP fields when cashed cheques are present, even without explicit `trackARAP`

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/forms/ChequeFormCard.tsx` | **NEW** - Reusable component |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Uses ChequeFormCard |
| `src/services/ledger/handlers/chequeHandlers.ts` | Added category fields to payments |
| `src/services/ledger/LedgerService.ts` | Fixed paymentStatus for cashed cheques |

---

## Verification

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Payment includes category | Fixed |
| paymentStatus updates | Fixed |

---

**Ready for PR**
