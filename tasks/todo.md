# Task: Extract Wizard Step Components from LedgerFormDialog

## Context
Refactoring LedgerFormDialog.tsx by extracting all three wizard step contents into reusable components.

## Goal
Create `<StepBasicInfo />`, `<StepPartyARAP />`, and `<StepRelatedRecords />` components to reduce LedgerFormDialog complexity.

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

### Step 3: StepRelatedRecords
- [x] Create `src/components/ledger/steps/StepRelatedRecords.tsx`
- [x] Extract Incoming Cheques section with ChequeFormCard
- [x] Extract Outgoing Cheques section with ChequeFormCard
- [x] Extract Inventory section with InventoryFormCard
- [x] Extract Fixed Asset section with FixedAssetFormCard
- [x] Extract Invoice info section

### LedgerFormDialog Updates
- [x] Add imports for all three step components
- [x] Replace Step 1 content with `<StepBasicInfo />`
- [x] Replace Step 2 content with `<StepPartyARAP />`
- [x] Replace Step 3 content with `<StepRelatedRecords />`
- [x] Remove unused imports (Label, Input, Plus, ChequeFormCard, InventoryFormCard, FixedAssetFormCard)

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
| `src/components/ledger/steps/StepRelatedRecords.tsx` | **NEW** - 196 lines |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Reduced significantly |

### Total Impact
- **New step components:** 630 lines (well-organized, reusable)
- **LedgerFormDialog.tsx:** Now ~300 lines (orchestration only)
- **Original size:** ~760 lines → Now ~300 lines = **~460 lines removed**

### Component Summary

| Component | Purpose | Lines |
|-----------|---------|-------|
| StepBasicInfo | Basic entry info (description, category, amount, date) | 111 |
| StepPartyARAP | Party selection, payment status, related record toggles | 323 |
| StepRelatedRecords | Cheques, inventory, assets, invoice forms | 196 |

---

## Status: COMPLETE - Ready for PR
