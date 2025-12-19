# Task: Add Capital Movement to Type Filter + Fix Search

**Branch:** `feature/add-capital-to-type-filter`
**Date:** December 19, 2025

---

## Problem 1 (Completed)

The Ledger page's "النوع" (Type) filter dropdown only shows:
- جميع الأنواع (All Types)
- دخل (Income)
- مصروف (Expense)

Capital movements ("حركة رأس مال") are stored in the database with type "حركة رأس مال" but cannot be filtered in the UI.

---

## Problem 2 (Completed)

When clicking "عرض الكل في دفتر الأستاذ" from Partners page:
- URL: `/ledger?category=رأس المال&search=جميل`
- Result: 0 entries shown even though capital entries exist

**Root Cause:** Capital entries store partner name in `ownerName`, not `associatedParty`. But the search filter only searched `associatedParty`.

---

## Todo Items

- [x] **1. Update EntryType definition** (`useLedgerFilters.ts:16`)
- [x] **2. Add capital option to typeOptions array** (`LedgerFilters.tsx:52-56`)
- [x] **3. Test the changes**
- [x] **4. Fix search filter to include ownerName** (`useLedgerFilters.ts:274-285`)
- [x] **5. Test the fix**

---

## Review

### Summary of Changes

**Files Modified (2 files):**
1. `src/components/ledger/filters/useLedgerFilters.ts`
   - Line 16: Added "حركة رأس مال" to EntryType union
   - Lines 278, 283: Added `ownerName` to search filter fields

2. `src/components/ledger/filters/LedgerFilters.tsx`
   - Line 56: Added capital option to typeOptions array

### What This Enables
1. Users can now filter ledger entries by "حركة رأس مال" (Capital Movement) type
2. Search now works correctly for capital entries (searches both `associatedParty` and `ownerName`)
3. "عرض الكل في دفتر الأستاذ" link from Partners page now shows correct results

### Test Results
- TypeScript: ✅ 0 errors
- ESLint: ✅ Warnings only (pre-existing, unrelated)
