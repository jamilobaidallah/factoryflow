# Task: Fix Party Balance Display in Ledger Dialog

**Branch:** `fix/party-balance-display`
**Date:** December 19, 2025

---

## Problem

In the ledger entry dialog, the party dropdown shows incorrect balance labels:
- موسى shows "لنا عليه: 720.00" (he owes us 720)
- But his actual account statement shows balance is 0.00 (fully paid)
- Even the direction is wrong - we owed him, not the other way around

---

## Root Cause

**Issue 1: Swapped labels** in `StepPartyARAP.tsx`
- When balance > 0 (they owe us): was showing "له علينا" (we owe him) - WRONG
- When balance < 0 (we owe them): was showing "لنا عليه" (he owes us) - WRONG

**Issue 2: Stale balance data** (separate investigation needed)
- The dropdown shows 720 but the entry is marked as paid
- This may be a data integrity issue from an old payment that didn't update `remainingBalance`

---

## Solution

### Fix 1: Swap the labels (this PR)
Changed line 168 from:
```tsx
{client.balance && client.balance > 0 ? 'له علينا: ' : 'لنا عليه: '}
```
To:
```tsx
{client.balance && client.balance > 0 ? 'لنا عليه: ' : 'له علينا: '}
```

---

## Todo Items

- [x] Fix swapped balance labels in `StepPartyARAP.tsx`
- [x] Test TypeScript compilation

---

## Files Modified

1. `src/components/ledger/steps/StepPartyARAP.tsx`
   - Line 168: Swapped "له علينا" and "لنا عليه" labels
   - Updated comments to clarify positive/negative balance meanings

---

## Test Results

- TypeScript: 0 errors
