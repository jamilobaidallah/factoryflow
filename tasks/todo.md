# Task: Add Amount Column to Activity Log Table

## Branch
`feature/ledger-activity-logging` (continuing on same branch)

---

## Context
The activity log currently shows description but not the amount for financial transactions. Adding an "Amount" column will make it easier to track financial changes.

---

## Plan

### Task 1: Add Amount Column Header
- [x] Add `<TableHead>المبلغ</TableHead>` between "القسم" and "الوصف"

**File:** `src/components/activity/activity-log-page.tsx`

### Task 2: Add Amount Column Cell
- [x] Add a `<TableCell>` to display `activity.metadata?.amount`
- [x] Format using `toLocaleString('ar-EG')` for Arabic numerals
- [x] Show "دينار" suffix
- [x] Show "-" for non-financial activities
- [x] Color code: green for income (دخل), red for expense (مصروف)

**File:** `src/components/activity/activity-log-page.tsx`

### Task 3: Import cn utility
- [x] Import `cn` from `@/lib/utils` for conditional classes

### Task 4: Verify Changes
- [x] TypeScript check passes
- [x] Build succeeds

---

## Files Modified
| File | Changes |
|------|---------|
| `src/components/activity/activity-log-page.tsx` | Added cn import, amount column header, amount cell with formatting |

---

## Review

### Summary
Added an "Amount" (المبلغ) column to the activity log table to display financial transaction amounts.

### Implementation Details:

1. **Column Header**: Added "المبلغ" between "القسم" and "الوصف"

2. **Amount Cell**:
   - Shows formatted amount with Arabic numerals + "دينار" suffix
   - Color coded: green for income (دخل), red for expense (مصروف)
   - Shows "-" for non-financial activities

3. **Formatting**: Uses `toLocaleString('ar-EG')` for proper Arabic number formatting

### Verification:
- TypeScript check: PASSED
- Production build: PASSED

---

## Status: COMPLETE
