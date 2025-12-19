# Inventory Page Redesign - Phase 1

**Branch:** `feature/inventory-page-redesign`
**Date:** December 19, 2025

---

## Task Overview

Redesign the inventory page with 5 main changes:
1. Track who made inventory movements (userEmail)
2. Add movement history tab
3. Extract components from 901-line file
4. Add 2-level category dropdown
5. Fix unit dropdown options

---

## Task 1: Track Who Made Inventory Movements

**Goal:** Save user email when recording دخول/خروج movements

### Current State
```typescript
// Line 269-278 in inventory-page.tsx
await addDoc(movementsRef, {
  itemId: selectedItem.id,
  itemName: selectedItem.itemName,
  type: movementData.type,
  quantity: movementQty,
  linkedTransactionId: movementData.linkedTransactionId,
  notes: movementData.notes,
  createdAt: new Date(),
  // ❌ NO userEmail field!
});
```

### Changes Required
- [ ] 1.1 Add `userEmail: user.email || ''` to movement record in `handleMovementSubmit()`
- [ ] 1.2 Also update production hooks that create movements (`useProductionOperations.ts`)

### Files to Modify
- `src/components/inventory/inventory-page.tsx`
- `src/components/production/hooks/useProductionOperations.ts`

---

## Task 2: Add Movement History Tab

**Goal:** Add a second tab showing all inventory movements (دخول/خروج history)

### UI Design
```
Tabs: [المواد (3)] | [سجل الحركات (15)]
```

### Movement History Table Columns
| Column | Arabic | Notes |
|--------|--------|-------|
| Date | التاريخ | Formatted date |
| Item Name | اسم العنصر | |
| Movement Type | نوع الحركة | دخول = green badge, خروج = red badge |
| Quantity | الكمية | With unit |
| Transaction ID | رقم المعاملة | Optional, linked |
| Notes | ملاحظات | |
| User | المستخدم | Email of who did it |

### Changes Required
- [ ] 2.1 Add `Tabs` import from shadcn/ui
- [ ] 2.2 Create `InventoryMovement` interface
- [ ] 2.3 Add state for movements list and active tab
- [ ] 2.4 Add Firestore listener for `inventory_movements` collection
- [ ] 2.5 Wrap items table in `TabsContent` for "المواد" tab
- [ ] 2.6 Create movement history table in "سجل الحركات" tab
- [ ] 2.7 Add count to tab labels

### Files to Modify
- `src/components/inventory/inventory-page.tsx` (will be extracted later)

---

## Task 3: Extract Components

**Goal:** Break 901-line file into separate, focused components

### Target Structure
```
src/components/inventory/
├── inventory-page.tsx          (main orchestration, ~150 lines)
├── components/
│   ├── InventoryStatsCards.tsx
│   ├── InventoryItemsTable.tsx
│   ├── MovementHistoryTable.tsx
│   ├── AddEditItemDialog.tsx
│   └── MovementDialog.tsx
├── hooks/
│   └── useInventoryData.ts     (data fetching, state)
└── types/
    └── inventory.types.ts      (interfaces)
```

### Changes Required
- [ ] 3.1 Create `types/inventory.types.ts` with all interfaces
- [ ] 3.2 Create `hooks/useInventoryData.ts` with data fetching logic
- [ ] 3.3 Create `components/InventoryStatsCards.tsx`
- [ ] 3.4 Create `components/InventoryItemsTable.tsx`
- [ ] 3.5 Create `components/MovementHistoryTable.tsx`
- [ ] 3.6 Create `components/AddEditItemDialog.tsx`
- [ ] 3.7 Create `components/MovementDialog.tsx`
- [ ] 3.8 Refactor `inventory-page.tsx` to use extracted components
- [ ] 3.9 Update tests if needed

---

## Task 4: Add 2-Level Category Dropdown

**Goal:** Replace free-text category field with hierarchical dropdowns

### Category Structure
```
تكلفة البضاعة المباعة (COGS)
├── مواد خام
└── منتجات جاهزة

إيرادات المبيعات
└── مبيعات منتجات
```

### Changes Required
- [ ] 4.1 Add `INVENTORY_CATEGORIES` constant with category structure
- [ ] 4.2 Update `formData` state to include `category` and `subCategory`
- [ ] 4.3 Replace category `<Input>` with main category `<Select>`
- [ ] 4.4 Add sub-category `<Select>` that updates based on main category
- [ ] 4.5 Both fields required - validate before submit
- [ ] 4.6 Update Firestore schema to store both category and subCategory
- [ ] 4.7 Update items table to show both category and subCategory

### Files to Modify
- `src/components/inventory/components/AddEditItemDialog.tsx`
- `src/components/inventory/types/inventory.types.ts`

---

## Task 5: Fix Unit Dropdown

**Goal:** Replace current unit options with exactly 3 options, no default

### Target Options
```
م² (متر مربع)
م (متر طولي)
قطعة
```

### Current State (WRONG)
```typescript
// Line 99 - Default is "كجم" which isn't in the new list
unit: "كجم",

// Lines 716-720 - Has different options
<option value="م">م (متر)</option>
<option value="م²">م² (متر مربع)</option>
<option value="قطعة">قطعة</option>
```

### Changes Required
- [ ] 5.1 Change default unit in `formData` to empty string `""`
- [ ] 5.2 Update unit options:
  - `م²` (متر مربع)
  - `م` (متر طولي) - update label from "متر" to "متر طولي"
  - `قطعة`
- [ ] 5.3 Make unit field required with validation

### Files to Modify
- `src/components/inventory/components/AddEditItemDialog.tsx`

---

## Commit Strategy

After each task, run:
```bash
npm run lint
npm run build
git add . && git commit -m "feat(inventory): [description]"
```

### Commit Order
1. Task 1: `feat(inventory): track user email in movement records`
2. Task 2: `feat(inventory): add movement history tab`
3. Task 3: `refactor(inventory): extract components from inventory page`
4. Task 4: `feat(inventory): add 2-level category dropdown`
5. Task 5: `fix(inventory): update unit dropdown options`

---

## Verification Checklist

- [ ] TypeScript compiles without errors
- [ ] ESLint passes (warnings OK)
- [ ] Production build succeeds
- [ ] All existing functionality preserved
- [ ] Movement history displays correctly
- [ ] Category dropdowns work correctly
- [ ] Unit dropdown has correct options

---

## Review Section

*To be completed after implementation*

---

**STOP** - Waiting for plan approval before proceeding.
