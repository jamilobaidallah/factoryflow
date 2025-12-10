# Task: Collapsible Grouped Sidebar Navigation

## Context
The current sidebar has 15 flat menu items, making it cluttered and hard to scan. Users requested collapsible groups to organize navigation into logical categories.

## Branch
`feature/collapsible-sidebar-navigation`

---

## Analysis

### Current State
- **Sidebar location:** `src/components/layout/sidebar.tsx`
- **Mobile nav location:** `src/components/layout/mobile-nav.tsx`
- **15 flat menu items** with no grouping
- **Dependencies available:** `@radix-ui/react-accordion` already installed
- **No existing Collapsible/Accordion UI component** - needs creation

### Proposed Groups (5 categories)
1. **الحسابات (Accounts):** Ledger, Payments, Invoices
2. **الشيكات (Cheques):** Incoming, Outgoing
3. **الأطراف (Parties):** Clients, Partners, Employees
4. **المخزون والإنتاج (Inventory & Production):** Inventory, Production, Fixed Assets
5. **التقارير والنسخ (Reports & Backup):** Reports, Backup

### Top-Level Items (always visible)
- Dashboard (لوحة التحكم)
- Search (البحث عن معاملة)

---

## Plan

### Phase 1: Create Collapsible UI Component
- [x] Create `src/components/ui/collapsible.tsx` using `@radix-ui/react-collapsible`

### Phase 2: Refactor Desktop Sidebar
- [x] Define TypeScript interfaces (`NavGroup`, `NavItem`)
- [x] Create `navigationGroups` data structure
- [x] Create `topLevelItems` data structure
- [x] Create `SidebarGroup` component with collapse/expand logic
- [x] Add localStorage persistence for group open/closed state
- [x] Implement active group auto-expand based on current route
- [x] Add chevron icon rotation animation (RTL-aware)
- [x] Add indentation for sub-items
- [x] Style active item highlight

### Phase 3: Update Mobile Navigation
- [x] Update mobile-nav.tsx to match grouped structure
- [x] Ensure all navigation items are accessible from mobile

### Phase 4: Testing & Verification
- [x] Update sidebar tests for new grouped structure
- [x] Run TypeScript check (`npx tsc --noEmit`) - PASSED
- [x] Run lint check (`npm run lint`) - PASSED (pre-existing warnings only)
- [x] Run sidebar tests (`npm test`) - 23/23 PASSED
- [x] Run build (`npm run build`) - PASSED

### Phase 5: Finalization
- [x] Add Review section to this file
- [ ] Push branch to remote
- [ ] Create PR

---

## Acceptance Criteria
- [x] Sidebar items grouped into 5 logical categories
- [x] Groups are collapsible (click to expand/collapse)
- [x] Dashboard and Search remain always visible at top
- [x] Active page's group auto-expands
- [x] Active item is highlighted
- [x] Collapse state persists (localStorage)
- [x] RTL layout correct (chevron on left side for RTL)
- [x] Mobile sidebar works correctly
- [x] No TypeScript errors
- [x] Smooth expand/collapse animation

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ui/collapsible.tsx` | **NEW** - Collapsible UI component using @radix-ui/react-collapsible |
| `src/components/layout/sidebar.tsx` | **MODIFIED** - Grouped navigation with collapsible sections |
| `src/components/layout/mobile-nav.tsx` | **MODIFIED** - Grouped navigation in mobile menu |
| `src/components/layout/__tests__/sidebar.test.tsx` | **MODIFIED** - Updated tests for new structure |
| `tailwind.config.ts` | **MODIFIED** - Added collapsible-down/up animations |

### Architecture Summary

```
Sidebar (Desktop)
├── FactoryFlow Branding
├── Top-Level Items (always visible)
│   ├── لوحة التحكم (Dashboard)
│   └── البحث عن معاملة (Search)
├── ─────────── Divider ───────────
└── Collapsible Groups
    ├── الحسابات (Accounts) [default open]
    │   ├── دفتر الأستاذ (Ledger)
    │   ├── المدفوعات (Payments)
    │   └── الفواتير (Invoices)
    ├── الشيكات (Cheques)
    │   ├── الشيكات الواردة (Incoming)
    │   └── الشيكات الصادرة (Outgoing)
    ├── الأطراف (Parties)
    │   ├── العملاء (Clients)
    │   ├── الشركاء (Partners)
    │   └── الموظفين (Employees)
    ├── المخزون والإنتاج (Inventory & Production)
    │   ├── المخزون (Inventory)
    │   ├── الإنتاج (Production)
    │   └── الأصول الثابتة (Fixed Assets)
    └── التقارير والنسخ (Reports & Backup)
        ├── التقارير (Reports)
        └── النسخ الاحتياطي (Backup)
```

### Key Features Implemented

1. **Collapsible Groups:** Click group header to expand/collapse
2. **localStorage Persistence:** Open/closed states saved across sessions
3. **Auto-Expand:** When navigating to a page, its group automatically opens
4. **Visual Indicators:**
   - Chevron rotates 90° when expanded (RTL-aware: points left)
   - Active group header highlighted with `bg-primary/10`
   - Active item highlighted with `bg-primary text-white`
   - Sub-items indented with right border
5. **Smooth Animation:** 0.2s ease-out expand/collapse transition

### Test Results

```
PASS src/components/layout/__tests__/sidebar.test.tsx
  23 tests passed, 0 failed
```

---

## Status: READY FOR PR
