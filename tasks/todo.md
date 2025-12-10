# Task: Extract Wizard Step Components from LedgerFormDialog

## Context
Refactoring LedgerFormDialog.tsx by extracting the wizard step contents into reusable components.
This PR extracts both Step 1 (Basic Info) and Step 2 (Party & AR/AP).

## Goal
Create `<StepBasicInfo />` and `<StepPartyARAP />` components to reduce LedgerFormDialog complexity.

---

## Completed

### Step 1: StepBasicInfo
- [x] Create `src/components/ledger/steps/StepBasicInfo.tsx`
- [x] Extract description, category, subcategory, amount, date, reference, notes fields
- [x] Use `onUpdate(Partial<LedgerFormData>)` pattern
- [x] Handle category change (clears subcategory)

### Step 2: StepPartyARAP
- [x] Create `src/components/ledger/steps/StepPartyARAP.tsx`
- [x] Move local state: `showPartyDropdown`, `filteredClients` useMemo
- [x] Extract Associated Party searchable dropdown
- [x] Extract Owner dropdown (for capital transactions)
- [x] Extract Payment Status radio buttons
- [x] Extract Related Records checkboxes

### LedgerFormDialog Updates
- [x] Add imports for both step components
- [x] Replace Step 1 content with `<StepBasicInfo />`
- [x] Replace Step 2 content with `<StepPartyARAP />`
- [x] Remove unused code: state, functions, imports

### Verification
- [x] Run lint and type check - PASSED
- [x] Verify build works - PASSED

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/steps/StepBasicInfo.tsx` | **NEW** - 111 lines |
| `src/components/ledger/steps/StepPartyARAP.tsx` | **NEW** - 323 lines |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Reduced by ~305 lines |

### Total Line Reduction
- LedgerFormDialog.tsx: **~305 lines removed**
- New step components: **434 lines** (better organized, reusable)

### StepBasicInfo Features
- Description, Category, SubCategory inputs
- Amount, Date inputs
- Reference, Notes inputs (optional)
- Clean `onUpdate({ field: value })` pattern

### StepPartyARAP Features
- Associated Party searchable dropdown with balance display
- Owner dropdown for capital transactions
- Payment Status radio buttons (Paid / Credit / Partial)
- Initial payment amount input
- Related Records checkboxes (cheques, inventory, assets, invoice)

---

## Status: COMPLETE - Ready for PR
