# Task: Fix Client Dialog Scroll & Alignment

**Branch:** `fix/client-dialog-scroll-alignment`
**Date:** December 19, 2025

---

## Problem

1. **Dialog Not Scrollable:** The "إضافة عميل جديد" dialog is too tall on smaller screens and cannot scroll
2. **Labels Pushed to Edge:** The field labels and inputs are pushed to the far right edge with no padding

---

## Solution

### Fix 1: Add scroll to dialog
Add `max-h-[90vh] overflow-y-auto` to DialogContent (matches inventory dialog pattern)

### Fix 2: Add horizontal padding
Add `px-6` to form content to match header/footer padding

---

## Todo Items

- [x] Add scroll to client dialog (`max-h-[90vh] overflow-y-auto`)
- [x] Add horizontal padding to form content (`px-6`)
- [x] Add padding wrapper to alert section
- [x] Test the changes

---

## Files Modified

1. `src/components/clients/clients-page.tsx`
   - Line 497: Added `max-h-[90vh] overflow-y-auto` to DialogContent
   - Line 510: Wrapped Alert in div with `px-6`
   - Line 521: Added `px-6` to form grid container

---

## Review

### Summary of Changes
- Dialog now scrolls on smaller screens
- Form content properly padded with 24px (px-6) horizontal spacing
- Matches the pattern used in inventory dialog

### Test Results
- TypeScript: ✅ 0 errors
- ESLint: ✅ No errors
