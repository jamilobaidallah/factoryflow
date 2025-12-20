# Task: Fix Client Cheques Issue Date & Pending Balance Calculation

**Branch:** `fix/client-cheques-issue-date`
**Date:** December 20, 2025

---

## Problem 1: Wrong Date Display

In the client detail page cheques tab, the "تاريخ الشيك" column was showing the wrong date:
- It was displaying the date when the transaction was entered (from `chequeDate` field)
- User wanted to see the actual issue date (`issueDate`) when the cheque was issued

## Problem 2: Wrong Balance Calculation for Pending Cheques

The "الرصيد المتوقع بعد صرف الشيكات" was calculating incorrectly for outgoing cheques:
- All pending cheques were being subtracted from the balance
- But outgoing cheques (صادر) should ADD to the balance (reduce what we owe them)
- Example: Balance 6,650 له (we owe them) with 7,500 outgoing cheques should become -850 (they owe us 850), not 14,150

---

## Solution

### Fix 1: Issue Date Display
Changed all references from `chequeDate` to `issueDate`:
- Updated the local `Cheque` interface
- Updated data loading to read `issueDate` from Firestore
- Updated the column header from "تاريخ الشيك" to "تاريخ الإصدار"
- Updated the table cell to display `issueDate`

### Fix 2: Pending Cheques Balance Calculation
Changed calculation to handle incoming vs outgoing cheques differently:
- **Incoming cheques (وارد)**: Subtract from balance (we receive money, reduces what they owe us)
- **Outgoing cheques (صادر)**: Add to balance (we pay money, reduces what we owe them)
- Added "النوع" (type) column to pending cheques table for clarity

---

## Todo Items

- [x] Update Cheque interface to use issueDate instead of chequeDate
- [x] Update data loading to read issueDate field
- [x] Update cheques table to display issueDate
- [x] Fix pending cheques balance calculation for incoming vs outgoing
- [x] Add type column to pending cheques table
- [x] Test TypeScript compilation

---

## Files Modified

1. `src/components/clients/client-detail-page.tsx`
   - Line 99: Changed interface field from `chequeDate` to `issueDate`
   - Line 307: Changed data loading from `data.chequeDate` to `data.issueDate`
   - Line 312: Changed sort to use `issueDate`
   - Line 746: Changed column header to "تاريخ الإصدار"
   - Line 764: Changed display from `cheque.chequeDate` to `cheque.issueDate`
   - Lines 1091-1100: Fixed balance calculation for incoming vs outgoing cheques
   - Lines 1115-1126: Added type column to pending cheques table

---

## Test Results

- TypeScript: 0 errors

