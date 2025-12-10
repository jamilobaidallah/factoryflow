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

### Code Review & Cleanup
- [x] All components have JSDoc comments
- [x] All props interfaces are complete with comments
- [x] No `any` types
- [x] No unused imports
- [x] Created `steps/index.ts` barrel export
- [x] Created `forms/index.ts` barrel export
- [x] Lint check - PASSED (no new warnings)
- [x] Type check - PASSED

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/steps/StepBasicInfo.tsx` | **NEW** - 120 lines |
| `src/components/ledger/steps/StepPartyARAP.tsx` | **NEW** - 395 lines |
| `src/components/ledger/steps/StepRelatedRecords.tsx` | **NEW** - 205 lines |
| `src/components/ledger/steps/index.ts` | **NEW** - barrel export |
| `src/components/ledger/forms/index.ts` | **NEW** - barrel export |
| `src/components/ledger/components/LedgerFormDialog.tsx` | ~391 lines (orchestrator) |

### Architecture Summary

```
LedgerFormDialog.tsx (orchestrator)
├── StepBasicInfo (Step 1)
│   └── Description, Category, Amount, Date, Reference, Notes
├── StepPartyARAP (Step 2)
│   ├── Associated Party dropdown
│   ├── Owner dropdown (capital)
│   ├── Payment Status radios
│   └── Related Records checkboxes
└── StepRelatedRecords (Step 3)
    ├── ChequeFormCard (incoming)
    ├── ChequeFormCard (outgoing)
    ├── InventoryFormCard
    ├── FixedAssetFormCard
    └── Invoice info
```

### Total Impact
- **New step components:** ~720 lines (well-organized, reusable)
- **LedgerFormDialog.tsx:** ~391 lines (orchestration + cheque CRUD)
- **Original size:** ~760 lines → Now split into focused modules

---

## Status: COMPLETE - Ready for PR
