# Task: Extract StepPartyARAP Component from LedgerFormDialog

## Context
Continuing the LedgerFormDialog refactoring. Previous extraction: StepBasicInfo (Step 1).
Now we extract Step 2 which handles the associated party, payment status (AR/AP), and related records toggles.

## Goal
Create a `<StepPartyARAP />` component that contains all Step 2 fields.

---

## Completed

- [x] Create `src/components/ledger/steps/StepPartyARAP.tsx` with:
  - JSDoc comment
  - Props interface (20+ props)
  - Local `showPartyDropdown` state
  - Local `filteredClients` useMemo
  - Associated Party input with dropdown
  - Owner dropdown (conditional on capital category)
  - Payment Status radio buttons (conditional on isEditMode)
  - Related Records checkboxes (conditional on isEditMode)
- [x] Update `LedgerFormDialog.tsx`:
  - Add import for StepPartyARAP
  - Replace all three Step 2 JSX blocks with single `<StepPartyARAP />` component
  - Remove unused `showPartyDropdown` state
  - Remove unused `filteredClients` useMemo
  - Remove unused `handlePartySelect` function
  - Remove unused imports (`useMemo`, `ChevronDown`)
- [x] Run lint and type check - PASSED
- [x] Verify build works - PASSED

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/steps/StepPartyARAP.tsx` | **NEW** - 323 lines |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Removed ~250 lines, uses StepPartyARAP |

### Line Reduction
- LedgerFormDialog.tsx reduced by ~250 lines from this extraction
- Combined with StepBasicInfo extraction: ~305 total lines removed

### Component Features
- Associated Party input with searchable dropdown
- Party search/filter with balance display
- Option to add new party
- Owner dropdown for capital transactions
- Payment Status radio buttons (Paid / Credit / Partial)
- Initial payment amount input
- Related Records checkboxes:
  - Incoming cheques (for income)
  - Outgoing cheques (for expenses)
  - Inventory update
  - Fixed asset (for fixed asset category)
  - Create invoice (for income with party)

### Props Interface
```typescript
interface StepPartyARAPProps {
  formData: LedgerFormData;
  onUpdate: (updates: Partial<LedgerFormData>) => void;
  allClients: ClientOption[];
  clientsLoading: boolean;
  partners: PartnerOption[];
  currentEntryType: string;
  isEditMode: boolean;
  hasInitialPayment: boolean;
  setHasInitialPayment: (value: boolean) => void;
  initialPaymentAmount: string;
  setInitialPaymentAmount: (value: string) => void;
  hasIncomingCheck: boolean;
  setHasIncomingCheck: (value: boolean) => void;
  hasOutgoingCheck: boolean;
  setHasOutgoingCheck: (value: boolean) => void;
  hasInventoryUpdate: boolean;
  setHasInventoryUpdate: (value: boolean) => void;
  hasFixedAsset: boolean;
  setHasFixedAsset: (value: boolean) => void;
  createInvoice: boolean;
  setCreateInvoice: ((value: boolean) => void) | undefined;
  onAddIncomingCheque: () => void;
  onAddOutgoingCheque: () => void;
  incomingChequesCount: number;
  outgoingChequesCount: number;
  hasRelatedRecords: boolean;
}
```

---

## Status: COMPLETE - Ready for PR
