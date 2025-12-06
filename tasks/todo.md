# Feature: LedgerFormDialog Step Wizard

## Problem

LedgerFormDialog is a massive 958-line form that shows everything at once:
- Description, category, amount, date
- Associated party with dropdown
- AR/AP tracking options
- Cheques (incoming/outgoing with multiple support)
- Inventory updates
- Fixed assets
- Invoice creation

This creates cognitive overload for users, especially when adding new entries.

## Solution

Convert the form into a step wizard for **new entries only**:
- **Step 1**: Basic Info (description, category, subcategory, amount, date, reference, notes)
- **Step 2**: Party & AR/AP (associated party, owner for capital, AR/AP tracking)
- **Step 3**: Related Records (cheques, inventory, fixed assets, invoice - only if any checkbox is checked)

For **edit mode**, keep the current single-page form since most additional options don't apply.

---

## Todo List

- [x] **1. Add wizard state and progress indicator**
  - Add `step` state (1, 2, or 3)
  - Calculate `totalSteps` based on whether related records are selected
  - Add progress bar UI at top of dialog

- [x] **2. Create Step 1: Basic Info section**
  - Wrap description, category/subcategory, amount/date, reference/notes in a conditional `{step === 1 && ...}`
  - These are required fields for all entries

- [x] **3. Create Step 2: Party & AR/AP section**
  - Wrap associated party dropdown, owner dropdown (capital), and AR/AP tracking in `{step === 2 && ...}`

- [x] **4. Create Step 3: Related Records section**
  - Wrap "Additional Options" section (cheques, inventory, fixed assets, invoice) in `{step === 3 && ...}`
  - This step only appears if user checks any related record option

- [x] **5. Update DialogFooter with navigation buttons**
  - "السابق" (Previous) button when step > 1
  - "التالي" (Next) button when step < totalSteps
  - "حفظ" (Save) button on final step
  - Keep original buttons for edit mode

- [x] **6. Add step validation before advancing**
  - Step 1: Require description, category, subcategory, amount, date
  - Step 2: Require owner if capital transaction
  - Prevent advancing if validation fails

- [x] **7. Handle edit mode - skip wizard**
  - When `editingEntry` exists, show single-page form (current behavior)
  - Wizard only applies to new entries

- [x] **8. Verify TypeScript compiles**
  - Run `npx tsc --noEmit` - PASSED

- [x] **9. Build successful**
  - Run `npm run build` - PASSED

- [x] **10. Clean code standards review**
  - Fixed inconsistent indentation in Step 2 "Associated Party" section (lines 345-443)
  - Fixed inconsistent indentation in Fixed Asset section (lines 1035-1090)
  - TypeScript compiles - PASSED
  - Build - PASSED

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/ledger/components/LedgerFormDialog.tsx` | Added wizard state, progress bar, step sections, navigation, validation |

---

## Review

### Summary of Changes

Converted the 958-line LedgerFormDialog from a monolithic form into a 3-step wizard for new entries:

1. **Step 1 - Basic Info**: Description, Category/Subcategory, Amount/Date, Reference/Notes
2. **Step 2 - Party & AR/AP**: Associated Party dropdown, Owner dropdown (for capital), AR/AP tracking options
3. **Step 3 - Related Records**: Cheques (incoming/outgoing), Inventory updates, Fixed assets, Invoice creation

### Key Implementation Details

- **Wizard for new entries only** - Edit mode retains the original single-page form
- **Dynamic step count** - 2 steps if no related records, 3 steps if any checkbox is checked
- **Progress indicator** - Visual progress bar with Arabic step labels
- **Step validation** - Validates required fields before allowing navigation to next step
- **Error display** - Shows validation errors in a red highlighted box

### Technical Changes

1. Added `step` and `stepError` state variables
2. Added `hasRelatedRecords` and `totalSteps` computed values
3. Added `validateStep()` and `handleNextStep()` functions
4. Wrapped form sections in step conditionals: `{(step === N || editingEntry) && ...}`
5. Updated DialogFooter with Previous/Next/Save navigation
6. Added progress indicator with step labels in Arabic

### Verification

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Build | Production build successful |
| Edit mode | Unchanged (single-page form) |
| New entry | 3-step wizard flow |

---

**PR Ready for Review**
