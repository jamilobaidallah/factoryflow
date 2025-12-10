# Task: Extract StepBasicInfo Component from LedgerFormDialog

## Context
Continuing the LedgerFormDialog refactoring. Previous phase extracted Step 3 sub-forms (ChequeFormCard, InventoryFormCard, FixedAssetFormCard). Now we extract the wizard steps themselves, starting with Step 1 (Basic Info).

## Goal
Create a `<StepBasicInfo />` component that contains all Step 1 fields (description, category, subcategory, amount, date, reference, notes).

---

## Completed

- [x] Create `src/components/ledger/steps/` folder
- [x] Create `src/components/ledger/steps/StepBasicInfo.tsx` with:
  - JSDoc comment
  - Props interface: `formData`, `onUpdate`, `categories`
  - All Step 1 fields from both JSX blocks
  - Use `onUpdate({ field: value })` pattern
  - Handle category change (clears subcategory)
- [x] Update `LedgerFormDialog.tsx`:
  - Add import for StepBasicInfo
  - Replace both Step 1 JSX blocks with single `<StepBasicInfo />` component
- [x] Run lint and type check - PASSED
- [x] Verify build works - PASSED

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/steps/StepBasicInfo.tsx` | **NEW** - 111 lines |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Removed ~55 lines, uses StepBasicInfo |

### Line Reduction
- LedgerFormDialog.tsx reduced by ~55 lines from this extraction (two separate Step 1 blocks consolidated)

### Component Features
- Description input field
- Category dropdown (clears subcategory on change)
- SubCategory dropdown (disabled until category selected)
- Amount input (number with 0.01 step)
- Date input (date picker)
- Reference input (optional)
- Notes input (optional)
- Clean `onUpdate(Partial<LedgerFormData>)` callback pattern

### Props Interface
```typescript
interface StepBasicInfoProps {
  formData: LedgerFormData;
  onUpdate: (updates: Partial<LedgerFormData>) => void;
  categories: Array<{
    name: string;
    subcategories: string[];
  }>;
}
```

---

## Status: COMPLETE - Ready for PR
