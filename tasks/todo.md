# Task: Add Subcategory Breakdown to Financial Reports

**Branch:** `feature/reports-subcategory-breakdown`
**Date:** December 19, 2025

---

## Problem

The Income Statement report currently shows only category totals (e.g., "مصروفات تشغيلية: 500 دينار"). The user wants to see subcategories under each category for more detailed breakdown.

---

## Solution

Changed data structure from flat category totals to hierarchical breakdown:

**Before:**
```typescript
revenueByCategory: { [key: string]: number }
```

**After:**
```typescript
revenueByCategory: {
  [category: string]: {
    total: number,
    subcategories: { [subCategory: string]: number }
  }
}
```

---

## Todo Items

- [x] Update `IncomeStatementData` interface in `useReportsCalculations.ts`
- [x] Update income statement calculation to group by category AND subcategory
- [x] Update `IncomeStatementData` interface in `IncomeStatementTab.tsx`
- [x] Update revenue table to show subcategories under each category
- [x] Update expenses table to show subcategories under each category
- [x] Test the changes with TypeScript and verify UI

---

## Files Modified

1. `src/components/reports/hooks/useReportsCalculations.ts`
   - Added `CategoryBreakdown` interface (lines 62-65)
   - Updated `IncomeStatementData` interface to use new structure (lines 67-74)
   - Updated `incomeStatement` calculation to group by category AND subcategory (lines 173-228)

2. `src/components/reports/tabs/IncomeStatementTab.tsx`
   - Added `Fragment` import from React (line 6)
   - Added `CategoryBreakdown` interface (lines 18-21)
   - Updated `IncomeStatementData` interface (lines 23-30)
   - Updated revenue table to show category rows with subcategory rows underneath (lines 205-250)
   - Updated expenses table to show category rows with subcategory rows underneath (lines 252-297)

---

## Review

### Summary of Changes
- Categories now show as highlighted rows with bold text and totals
- Subcategories show indented underneath each category with "↳" prefix
- Both revenue and expense tables now show hierarchical breakdown
- Header changed from "الفئة" to "الفئة / الفئة الفرعية" for clarity

### Test Results
- TypeScript: 0 errors
- ESLint: No new errors (only pre-existing warnings)
