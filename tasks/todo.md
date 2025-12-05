# Feature: LedgerTable Mobile Card View

## Problem

The LedgerTable component has 10 columns which is unusable on mobile devices. Users have to scroll horizontally through a massive table, leading to poor UX.

**Current columns:**
1. رقم المعاملة (Transaction ID)
2. التاريخ (Date)
3. الوصف (Description)
4. النوع (Type - income/expense)
5. التصنيف (Category)
6. الفئة الفرعية (SubCategory)
7. الطرف المعني (Associated Party)
8. المبلغ (Amount)
9. حالة الدفع (Payment Status)
10. الإجراءات (Actions)

## Analysis

### Current Implementation

**File:** `src/components/ledger/components/LedgerTable.tsx`
- Uses shadcn `Table` component
- Has memoized `LedgerTableRow` for performance
- No responsive handling - table renders same on all screen sizes

### Solution

Add a card-based mobile view that:
- Shows on `md:hidden` (mobile only)
- Displays key info: description, amount, date, party, payment status
- Provides all action buttons (Quick Pay, View Related, Edit, Delete)
- Hides the table on mobile with `hidden md:block`

### Card Layout Design

```
┌─────────────────────────────────────┐
│ [Description]          [Amount badge]│
│                        دخل/مصروف     │
├─────────────────────────────────────┤
│ [Date]              [Associated Party]│
│ [Category > SubCategory]             │
├─────────────────────────────────────┤
│ [Payment Status - if AR/AP]          │
│ Remaining: X دينار | Paid: Y دينار   │
├─────────────────────────────────────┤
│ [Quick Pay] [Related] [Edit] [Delete]│
└─────────────────────────────────────┘
```

---

## Todo List

- [ ] **1. Create LedgerCard component**
  - New memoized component for mobile card view
  - Receives same props as LedgerTableRow
  - Displays all essential info in card format

- [ ] **2. Update LedgerTable to show cards on mobile**
  - Add mobile card list with `md:hidden`
  - Wrap existing table with `hidden md:block`
  - Maintain empty state for both views

- [ ] **3. Add cn utility import if missing**
  - Need `cn()` for conditional className merging

- [ ] **4. Verify TypeScript compiles**
  - Run `npx tsc --noEmit`

- [ ] **5. Verify existing tests pass**
  - Run tests for LedgerTable component

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ledger/components/LedgerTable.tsx` | Add LedgerCard component, wrap table with responsive classes |

---

## Constraints

- Keep existing table functionality intact (desktop)
- Reuse existing action handlers (onEdit, onDelete, onQuickPay, onViewRelated)
- Maintain memoization for performance
- Preserve accessibility (aria-labels, roles)
- Use existing shadcn Button component
- Arabic-first UI text

---

## Review

### Summary of Changes

Added a responsive card-based mobile view for the LedgerTable component. On mobile (`md:hidden`), entries display as stacked cards with key information. On desktop (`hidden md:block`), the original table view remains unchanged.

### Files Modified

| File | Changes |
|------|---------|
| `src/components/ledger/components/LedgerTable.tsx` | Added `LedgerCard` component, wrapped table with responsive classes |
| `src/components/ledger/components/__tests__/LedgerTable.test.tsx` | Updated tests to scope queries within desktop table |

### New Component: LedgerCard

A memoized card component for mobile that displays:
- Description + Amount badge (color-coded by type)
- Date + Associated Party
- Category > SubCategory
- Payment status (for AR/AP entries only)
- Action buttons: Quick Pay, Related, Edit, Delete

### Card Layout

```
┌─────────────────────────────────────┐
│ مبيعات منتجات           1000 دينار │
├─────────────────────────────────────┤
│ ١٥/١/٢٠٢٥                   عميل أ │
│ مبيعات > منتجات                     │
├─────────────────────────────────────┤
│ [غير مدفوع] متبقي: 1000            │
├─────────────────────────────────────┤
│ [دفعة] [مرتبط] [تعديل] [حذف]       │
└─────────────────────────────────────┘
```

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript | ✅ Compiles without errors |
| Tests | ✅ All 23 tests pass |
| Desktop table | ✅ Unchanged functionality |
| Mobile cards | ✅ Responsive card layout |
| Memoization | ✅ LedgerCard is memoized |
| Accessibility | ✅ aria-labels preserved |

### Testing Recommendations

- Test on actual mobile device
- Verify card actions work (edit, delete, quick pay)
- Test with long descriptions (text should wrap)
- Test with AR/AP entries (payment status visible)
