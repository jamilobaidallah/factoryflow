# Task: Improve Inventory Form UX - Dropdown + Consistent Units

## Context
Building on the InventoryFormCard extraction, this task improves the UX by:
1. Replacing free text with a dropdown for item selection
2. Making dimension units consistent (cm everywhere)

---

## Completed Changes

### Part 1: Type Updates
- [x] Added `itemId` field to `InventoryFormData` interface
- [x] Updated `initialInventoryFormData` to include `itemId: ""`

### Part 2: useInventoryItems Hook (NEW)
- [x] Created `src/hooks/useInventoryItems.ts`
- [x] Fetches from `users/${user.uid}/inventory` collection
- [x] Returns `{ items, loading, error }`
- [x] Proper error handling with Firestore onSnapshot error callback
- [x] Proper cleanup (unsubscribe)

### Part 3: InventoryFormCard Component Updates
- [x] Added new props: `inventoryItems`, `isLoadingItems`, `error`
- [x] Added `onItemSelect` callback for batched state updates
- [x] Replaced text input with `<select>` dropdown
- [x] Auto-fills unit when item selected
- [x] Shows warning if no inventory items exist
- [x] Shows error message if fetch fails
- [x] Updated dimension placeholders to سم (cm)
- [x] Uses shared `InventoryItemOption` type from hook

### Part 4: LedgerFormDialog Updates
- [x] Imports `useInventoryItems` hook
- [x] Passes `inventoryItems`, `isLoadingItems`, `error` to InventoryFormCard
- [x] Uses `onItemSelect` callback for batched updates (fixes dropdown selection bug)

### Part 5: Bug Fixes
- [x] Fixed dropdown selection not working (React state batching issue)
  - Root cause: Multiple `onUpdate` calls using stale closure
  - Solution: Added `onItemSelect` callback for batched updates

---

## Code Review Checklist

- [x] No TypeScript errors (`npx tsc --noEmit`)
- [x] No ESLint errors on new files
- [x] Proper error handling in hook
- [x] Cleanup/unsubscribe in useEffect
- [x] Shared types (no duplication)
- [x] No console.log debugging statements
- [x] JSDoc comments on hook

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/types/ledger.ts` | Added `itemId` to InventoryFormData |
| `src/hooks/useInventoryItems.ts` | **NEW** - Hook with error handling |
| `src/components/ledger/forms/InventoryFormCard.tsx` | Dropdown, error display, shared type |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Uses hook, passes all props |

---

## Status: COMPLETE - Ready for PR
