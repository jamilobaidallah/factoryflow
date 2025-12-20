# Task: Fix Client Cheques Issue Date Display

**Branch:** `fix/client-cheques-issue-date`
**Date:** December 20, 2025

---

## Problem

In the client detail page cheques tab, the "تاريخ الشيك" column was showing the wrong date:
- It was displaying the date when the transaction was entered (from `chequeDate` field)
- User wanted to see the actual issue date (`issueDate`) when the cheque was issued

---

## Root Cause

The client-detail-page.tsx had a local `Cheque` interface that used `chequeDate` instead of `issueDate`:
- The official Cheque type in `src/components/cheques/types/cheques.ts` uses `issueDate`
- But the local interface in client-detail-page.tsx was using a different field name `chequeDate`

---

## Solution

Changed all references from `chequeDate` to `issueDate`:

1. Updated the local `Cheque` interface (line 99)
2. Updated data loading to read `issueDate` from Firestore (line 307)
3. Updated the sorting to use `issueDate` (line 312)
4. Updated the table cell to display `issueDate` (line 764)
5. Updated the column header from "تاريخ الشيك" to "تاريخ الإصدار" (line 746)
6. Updated fallback references for `dueDate` (lines 372, 477)

---

## Todo Items

- [x] Update Cheque interface to use issueDate instead of chequeDate
- [x] Update data loading to read issueDate field
- [x] Update cheques table to display issueDate
- [x] Test TypeScript compilation

---

## Files Modified

1. `src/components/clients/client-detail-page.tsx`
   - Line 99: Changed interface field from `chequeDate` to `issueDate`
   - Line 307: Changed data loading from `data.chequeDate` to `data.issueDate`
   - Line 312: Changed sort to use `issueDate`
   - Line 746: Changed column header to "تاريخ الإصدار"
   - Line 764: Changed display from `cheque.chequeDate` to `cheque.issueDate`
   - Lines 372, 477: Changed fallback from `c.chequeDate` to `c.issueDate`

---

## Test Results

- TypeScript: 0 errors

