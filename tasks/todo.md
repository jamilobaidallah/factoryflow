# Task: Extract ChequeFormCard Component (Refactoring LedgerFormDialog)

## Context
Refactoring `LedgerFormDialog.tsx` (1,151 lines) to extract duplicate cheque form code into a reusable component.

---

## Todo List

- [x] Create directory `src/components/ledger/forms/`
- [x] Create `src/components/ledger/forms/ChequeFormCard.tsx`
  - [x] Import types from `../types/ledger`
  - [x] Import UI components (Input, Label, Button)
  - [x] Import Trash2 icon from lucide-react
  - [x] Define `ChequeFormCardProps` interface
  - [x] Implement component using incoming cheque as base template
  - [x] Add conditional rendering for direction-specific text/fields
- [x] Integrate ChequeFormCard into LedgerFormDialog.tsx
  - [x] Add import for ChequeFormCard
  - [x] Replace incoming cheques mapping (~100 lines)
  - [x] Replace outgoing cheques mapping (~100 lines)
  - [x] Update function signatures for type compatibility
- [x] Verify TypeScript compiles without errors (`npx tsc --noEmit`)

---

## Acceptance Criteria

- [x] New file created at `src/components/ledger/forms/ChequeFormCard.tsx`
- [x] Component is typed with TypeScript
- [x] Component handles both incoming/outgoing via `direction` prop
- [x] LedgerFormDialog.tsx uses ChequeFormCard for both cheque types
- [x] TypeScript compiles cleanly
- [x] No logic changes, just extraction

---

## Review

### Summary of Changes

Extracted duplicate cheque form code from `LedgerFormDialog.tsx` into a new reusable `ChequeFormCard` component.

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/forms/ChequeFormCard.tsx` | **NEW** - Reusable cheque form card component (134 lines) |
| `src/components/ledger/components/LedgerFormDialog.tsx` | **MODIFIED** - Uses ChequeFormCard, removed duplicate JSX |

### Line Count Reduction

| Metric | Value |
|--------|-------|
| Before | 1,151 lines |
| After | 967 lines |
| **Reduction** | **184 lines (16%)** |

### Technical Details

1. **ChequeFormCard Props:**
   - `cheque`: Union type `CheckFormDataItem | OutgoingCheckFormDataItem`
   - `direction`: `'incoming' | 'outgoing'` for conditional rendering
   - `onUpdate`: Callback for field changes
   - `onRemove`: Callback for removing cheque
   - `canRemove`: Controls delete button visibility

2. **Direction-specific rendering:**
   - Endorsed label/placeholder text
   - Postponed warning message
   - Endorsed dropdown option text

3. **Type compatibility fix:**
   - Changed `updateIncomingCheque` and `updateOutgoingCheque` function signatures from `keyof CheckFormDataItem` to `string` for compatibility with the generic `onUpdate` prop

### Verification

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Imports | ChequeFormCard properly imported |
| Trash2 | Removed from LedgerFormDialog (now in ChequeFormCard) |

---

**Ready for PR**
