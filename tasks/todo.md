# Task: Extract FixedAssetFormCard Component

## Context
Continuing the Step 3 refactoring of LedgerFormDialog.tsx.
Previous extractions: ChequeFormCard, InventoryFormCard.

## Goal
Create a reusable `<FixedAssetFormCard />` component for fixed asset details.

---

## Completed

- [x] Create `src/components/ledger/forms/FixedAssetFormCard.tsx`
- [x] Add JSDoc comment
- [x] Define props: formData, onUpdate, entryAmount
- [x] Extract JSX from LedgerFormDialog.tsx
- [x] Include depreciation calculation display
- [x] Update LedgerFormDialog.tsx to use new component
- [x] Run lint and type check - PASSED

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/forms/FixedAssetFormCard.tsx` | **NEW** - 83 lines |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Uses FixedAssetFormCard |

### Line Reduction
- LedgerFormDialog.tsx reduced by ~45 lines from this extraction

### Component Features
- Asset name input
- Useful life (years) input
- Salvage value input
- Monthly depreciation calculation display
- Clean `onUpdate(field, value)` callback pattern

---

## Status: COMPLETE - Ready for merge
