# Task: Extract InventoryFormCard Component

## Context
Continuing refactoring of LedgerFormDialog.tsx by extracting reusable form components.
Previous extraction: ChequeFormCard - reduced ~180 lines.

## Goal
Create a reusable `<InventoryFormCard />` component that handles inventory updates in ledger entries.

---

## Plan

### Step 1: Create InventoryFormCard.tsx
- [x] Create new file: `src/components/ledger/forms/InventoryFormCard.tsx`
- [x] Add JSDoc comment at top of file
- [x] Define `InventoryFormCardProps` interface with:
  - `formData`: object with itemName, quantity, unit, thickness, width, length, shippingCost, otherCosts
  - `onUpdate`: callback function `(field: string, value: string) => void`
- [x] Extract JSX from LedgerFormDialog.tsx lines 774-858
- [x] Adapt onChange handlers to use `onUpdate(fieldName, value)` pattern

### Step 2: Update LedgerFormDialog.tsx
- [x] Add import statement for InventoryFormCard
- [x] Replace inline inventory section with `<InventoryFormCard />` component
- [x] Pass `inventoryFormData` as `formData` prop
- [x] Pass update callback: `(field, value) => setInventoryFormData({ ...inventoryFormData, [field]: value })`

### Step 3: Verify
- [x] No TypeScript errors (`npx tsc --noEmit`)
- [x] Visual appearance unchanged
- [x] All fields functional (itemName, quantity, unit, dimensions, costs)

---

## Acceptance Criteria
- [x] New file: `src/components/ledger/forms/InventoryFormCard.tsx`
- [x] Component properly typed with TypeScript
- [x] JSDoc comment added
- [x] LedgerFormDialog.tsx imports and uses new component
- [x] All inventory fields work (itemName, quantity, unit, thickness, width, length, shippingCost, otherCosts)
- [x] No TypeScript errors
- [x] Visual appearance identical

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/forms/InventoryFormCard.tsx` | **NEW** - 93 lines |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Uses InventoryFormCard |

### Line Reduction
- **Before:** 977 lines
- **After:** 899 lines
- **Reduction:** 78 lines (8%)

### Summary
Extracted inventory update form fields into a clean, reusable `<InventoryFormCard />` component following the same pattern as `ChequeFormCard`. The component:
- Has JSDoc documentation
- Uses typed props with `InventoryFormCardProps` interface
- Handles all 8 inventory fields (itemName, quantity, unit, thickness, width, length, shippingCost, otherCosts)
- Uses consistent `onUpdate(field, value)` callback pattern

---

## Status: COMPLETE - Ready for PR
