# Task: Add Capital Movement to Type Filter

**Branch:** `feature/add-capital-to-type-filter`
**Date:** December 19, 2025

---

## Problem

The Ledger page's "النوع" (Type) filter dropdown only shows:
- جميع الأنواع (All Types)
- دخل (Income)
- مصروف (Expense)

Capital movements ("حركة رأس مال") are stored in the database with type "حركة رأس مال" but cannot be filtered in the UI.

---

## Root Cause

1. The `EntryType` type in `useLedgerFilters.ts:16` is defined as:
   ```typescript
   export type EntryType = "all" | "دخل" | "مصروف";
   ```
   Missing: `"حركة رأس مال"`

2. The `typeOptions` array in `LedgerFilters.tsx:52-56` only has 3 options, missing capital movement.

---

## Solution Plan

### Files to Modify
1. `src/components/ledger/filters/useLedgerFilters.ts`
2. `src/components/ledger/filters/LedgerFilters.tsx`

---

## Todo Items

- [x] **1. Update EntryType definition** (`useLedgerFilters.ts:16`)
  - Add "حركة رأس مال" to the union type
  - Change: `"all" | "دخل" | "مصروف"`
  - To: `"all" | "دخل" | "مصروف" | "حركة رأس مال"`

- [x] **2. Add capital option to typeOptions array** (`LedgerFilters.tsx:52-56`)
  - Add new option: `{ value: "حركة رأس مال", label: "حركة رأس مال" }`

- [x] **3. Test the changes**
  - Run TypeScript build to verify no errors
  - Run lint to verify no issues

---

## Impact Analysis

- **Minimal changes**: Only 2 files, 2 small edits
- **No breaking changes**: Existing functionality unchanged
- **Category filter**: Already handles this correctly (filters by `cat.type === filters.entryType`)

---

## Review

### Summary of Changes

**Files Modified (2 files):**
1. `src/components/ledger/filters/useLedgerFilters.ts` - Added "حركة رأس مال" to EntryType union
2. `src/components/ledger/filters/LedgerFilters.tsx` - Added capital option to typeOptions array

### What This Enables
- Users can now filter ledger entries by "حركة رأس مال" (Capital Movement) type
- When selected, the category dropdown will show only "رأس المال" category
- Existing income/expense filtering unchanged

### Test Results
- TypeScript: ✅ 0 errors
- ESLint: ✅ Warnings only (pre-existing, unrelated)
