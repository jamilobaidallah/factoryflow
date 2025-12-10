# Task: Improve Inventory Form UX - Dropdown + Consistent Units

## Context
Building on the InventoryFormCard extraction, this task improves the UX by:
1. Replacing free text with a dropdown for item selection
2. Making dimension units consistent (cm everywhere)

---

## Plan

### Part 1: Update Types
- [x] Add `itemId` field to `InventoryFormData` interface
- [x] Update `initialInventoryFormData` to include `itemId: ""`

### Part 2: Create useInventoryItems Hook
- [x] Create `src/hooks/useInventoryItems.ts`
- [x] Fetch from `users/${user.uid}/inventory` collection
- [x] Return `{ items, loading }` with `{ id, name, unit }`

### Part 3: Update InventoryFormCard Component
- [x] Add new props: `inventoryItems`, `isLoadingItems`
- [x] Replace text input with `<select>` dropdown
- [x] Auto-fill unit when item selected
- [x] Show warning if no inventory items
- [x] Update dimension placeholders to سم (cm)

### Part 4: Update LedgerFormDialog.tsx
- [x] Import `useInventoryItems` hook
- [x] Pass inventory items to InventoryFormCard

### Part 5: Verify
- [x] No TypeScript errors
- [x] Dropdown works correctly
- [x] Unit auto-fill works

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/types/ledger.ts` | Added `itemId` to InventoryFormData |
| `src/hooks/useInventoryItems.ts` | **NEW** - Hook to fetch inventory items |
| `src/components/ledger/forms/InventoryFormCard.tsx` | Dropdown + cm units |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Uses hook, passes items |

### Summary
- Replaced free text input with dropdown for inventory item selection
- Dropdown shows all items from user's inventory collection
- Selecting an item auto-fills the unit field
- Warning message shows if no inventory items exist
- All dimension placeholders now use consistent سم (cm) units
- Unit field is disabled when item is selected (auto-filled)

---

## Status: COMPLETE - Ready for PR
