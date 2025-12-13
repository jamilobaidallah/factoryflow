# Task: Fix Accessibility - Buttons Without Discernible Text

## Branch
`fix/accessibility-aria-labels`

---

## Context
Select/dropdown buttons are missing `aria-label` attributes, causing accessibility issues for screen readers.

---

## Plan

### Task 1: Add aria-label to FilterDropdown
- [x] Add `aria-label={label}` to SelectTrigger

### Task 2: Add aria-label to RoleSelector
- [x] Add `aria-label="اختر الدور"` to SelectTrigger

### Task 3: Verify Changes
- [x] TypeScript check passes
- [x] Build succeeds

---

## Review

### Changes Made

| File | Change |
|------|--------|
| `src/components/ledger/filters/FilterDropdown.tsx` | Added `aria-label={label}` to SelectTrigger (line 35) |
| `src/components/users/RoleSelector.tsx` | Added `aria-label="اختر الدور"` to SelectTrigger (line 36) |

### Summary
- **2 files modified**
- Screen readers can now announce the purpose of dropdown buttons
- No new warnings introduced

---

## Status: COMPLETED
