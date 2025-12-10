# Task: Add Smart Filters to Ledger Page

## Context
Users need to quickly filter ledger entries by date, category, type, and payment status without multiple clicks. The Ledger page is the most-used page.

## Branch
`feature/ledger-smart-filters`

---

## Analysis

### Current State
- **Ledger page:** `src/components/ledger/ledger-page.tsx`
- **LedgerEntry type:** Has `date`, `type` ("دخل"/"مصروف"), `category`, `paymentStatus` ("paid"/"unpaid"/"partial")
- **Categories:** Defined in `src/components/ledger/utils/ledger-constants.ts` (CATEGORIES array)
- **Data hook:** `useLedgerData` provides entries, clients, partners, totalCount, totalPages
- **Existing UI:** Button, Card, Dialog, Tabs - NO Select, Calendar, or Popover components exist

### Dependencies Already Installed
- `date-fns@^3.6.0` - date manipulation
- `@radix-ui/react-select@^2.1.0` - select dropdown
- `@radix-ui/react-popover@^1.1.0` - popover for date picker
- `react-day-picker@^8.10.0` - calendar component

### Missing UI Components (need to create)
1. `src/components/ui/select.tsx` - shadcn Select wrapper
2. `src/components/ui/calendar.tsx` - shadcn Calendar wrapper
3. `src/components/ui/popover.tsx` - shadcn Popover wrapper

---

## Plan

### Phase 1: Create Missing UI Components
- [x] Create `src/components/ui/select.tsx` (shadcn Select wrapper for @radix-ui/react-select)
- [x] Create `src/components/ui/popover.tsx` (shadcn Popover wrapper for @radix-ui/react-popover)
- [x] Create `src/components/ui/calendar.tsx` (shadcn Calendar wrapper for react-day-picker)

### Phase 2: Create Filter Components
- [x] Create `src/components/ledger/filters/useLedgerFilters.ts` (filter state hook with date-fns)
- [x] Create `src/components/ledger/filters/DatePresetButtons.tsx` (date quick filter buttons)
- [x] Create `src/components/ledger/filters/FilterDropdown.tsx` (reusable dropdown component)
- [x] Create `src/components/ledger/filters/LedgerFilters.tsx` (main filter bar component)
- [x] Create `src/components/ledger/filters/index.ts` (barrel export)

### Phase 3: Integration
- [x] Integrate filters into `ledger-page.tsx`
- [x] Apply client-side filtering to entries
- [x] Show filtered count: "عرض X من Y حركة"

### Phase 4: Testing & Verification
- [x] Run TypeScript check (`npx tsc --noEmit`) - PASSED
- [x] Run lint check (`npm run lint`) - PASSED (pre-existing warnings only)
- [x] Run build (`npm run build`) - PASSED (21/21 pages)

### Phase 5: Finalization
- [x] Add Review section to this file
- [ ] Push branch to remote
- [ ] Create PR

---

## Acceptance Criteria
- [x] Filter bar appears above ledger table
- [x] Date presets work (اليوم، هذا الأسبوع، هذا الشهر، الكل)
- [x] Type dropdown filters (الكل، دخل، مصروف)
- [x] Category dropdown shows actual categories from data
- [x] Payment status dropdown filters (الكل، مدفوع، غير مدفوع، جزئي)
- [x] "مسح الفلاتر" clears all filters
- [x] Entry count updates: "عرض X من Y حركة"
- [x] Filters are client-side (fast, no re-fetch)
- [x] RTL layout correct
- [x] Mobile responsive (stack on small screens)
- [x] No TypeScript errors

---

## Component Architecture

```
LedgerPage
└── LedgerFilters
    ├── DatePresetButtons (اليوم | هذا الأسبوع | هذا الشهر | الكل)
    ├── FilterDropdown (النوع)
    ├── FilterDropdown (التصنيف)
    ├── FilterDropdown (الحالة)
    └── Clear Button (مسح الفلاتر)
```

## Filter State Shape

```typescript
interface LedgerFilters {
  datePreset: "today" | "week" | "month" | "all" | "custom";
  dateRange: { from: Date | null; to: Date | null };
  entryType: "all" | "دخل" | "مصروف";
  category: string; // "all" or category name
  paymentStatus: "all" | "paid" | "unpaid" | "partial";
}
```

## Arabic Labels

| Key | Arabic |
|-----|--------|
| today | اليوم |
| week | هذا الأسبوع |
| month | هذا الشهر |
| all | الكل |
| type | النوع |
| category | التصنيف |
| status | الحالة |
| income | دخل |
| expense | مصروف |
| paid | مدفوع |
| unpaid | غير مدفوع |
| partial | جزئي |
| clear | مسح الفلاتر |

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ui/select.tsx` | **NEW** - shadcn Select wrapper for @radix-ui/react-select |
| `src/components/ui/popover.tsx` | **NEW** - shadcn Popover wrapper for @radix-ui/react-popover |
| `src/components/ui/calendar.tsx` | **NEW** - shadcn Calendar wrapper for react-day-picker |
| `src/components/ledger/filters/useLedgerFilters.ts` | **NEW** - Filter state hook with date-fns integration |
| `src/components/ledger/filters/DatePresetButtons.tsx` | **NEW** - Quick date filter buttons component |
| `src/components/ledger/filters/FilterDropdown.tsx` | **NEW** - Reusable dropdown filter component |
| `src/components/ledger/filters/LedgerFilters.tsx` | **NEW** - Main filter bar component |
| `src/components/ledger/filters/index.ts` | **NEW** - Barrel exports |
| `src/components/ledger/ledger-page.tsx` | **MODIFIED** - Integrated filters, uses filteredEntries |

### Architecture Summary

```
LedgerPage
├── useLedgerFilters() hook
│   ├── filters state
│   ├── setDatePreset(), setEntryType(), etc.
│   ├── filterEntries() - client-side filtering
│   └── hasActiveFilters - for clear button visibility
│
└── LedgerFilters component
    ├── DatePresetButtons (toggle group)
    │   └── اليوم | هذا الأسبوع | هذا الشهر | الكل
    ├── FilterDropdown (النوع)
    │   └── الكل | دخل | مصروف
    ├── FilterDropdown (التصنيف)
    │   └── Dynamic from entries data
    ├── FilterDropdown (الحالة)
    │   └── الكل | مدفوع | غير مدفوع | جزئي
    ├── Clear Button (مسح الفلاتر)
    └── Results count (عرض X من Y حركة)
```

### Key Features Implemented

1. **Date Preset Buttons**: Quick one-click filters for today, this week, this month, or all
2. **Type Dropdown**: Filter by income (دخل) or expense (مصروف)
3. **Category Dropdown**: Dynamically populated from actual entry categories
4. **Payment Status Dropdown**: Filter AR/AP entries by paid/unpaid/partial status
5. **Clear Filters Button**: Appears only when filters are active
6. **Results Count**: Shows "عرض X من Y حركة" with filtered vs total count
7. **Client-Side Filtering**: Fast filtering without API calls
8. **RTL Layout**: Proper Arabic/RTL support
9. **Mobile Responsive**: Filters stack on small screens
10. **Export Integration**: Exports (Excel, PDF) use filtered entries

### Test Results

```
TypeScript: PASSED (no errors)
ESLint: PASSED (pre-existing warnings only)
Build: PASSED (21/21 pages generated)
```

---

## Status: READY FOR PR
