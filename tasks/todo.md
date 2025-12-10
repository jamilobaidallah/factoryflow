# Task: Global Search with Command Palette (Cmd+K)

## Context
Users reported "hard to find information" as a major pain point. Creating a powerful global search (command palette) that searches across ledger entries, clients, cheques, and payments from anywhere in the app.

## Branch
`feature/global-search-command-palette`

---

## Analysis

### Current State
- **Existing search:** `src/components/search/transaction-search-page.tsx` (searches by transaction ID only)
- **cmdk dependency:** Already installed (`"cmdk": "^1.0.0"`)
- **No Command UI component:** Needs creation
- **Header location:** `src/components/layout/header.tsx` (will add GlobalSearch trigger)
- **Auth hook:** `useUser()` from `@/firebase/provider`
- **Firestore:** Available from `@/firebase/config`

### Data Collections to Search
1. **Ledger** (`users/{uid}/ledger`) - Search by description, associatedParty
2. **Clients** (`users/{uid}/clients`) - Search by name
3. **Cheques** (`users/{uid}/cheques`) - Search by chequeNumber, clientName
4. **Payments** (`users/{uid}/payments`) - Search by clientName, notes

### Routes for Navigation
- `/ledger?highlight={id}`
- `/clients?highlight={id}`
- `/incoming-cheques?highlight={id}`
- `/outgoing-cheques?highlight={id}`
- `/payments?highlight={id}`

---

## Plan

### Phase 1: Create UI Components
- [x] Create `src/components/ui/command.tsx` - shadcn Command wrapper for cmdk

### Phase 2: Create Search Components
- [x] Create `src/components/search/useGlobalSearch.ts` - Search hook with debounce
- [x] Create `src/components/search/SearchDialog.tsx` - Modal with keyboard navigation
- [x] Create `src/components/search/SearchResults.tsx` - Grouped results display
- [x] Create `src/components/search/GlobalSearch.tsx` - Trigger button with Cmd+K
- [x] Create `src/components/search/index.ts` - Barrel export

### Phase 3: Integration
- [x] Add `<GlobalSearch />` to Header component
- [x] Style for RTL layout

### Phase 4: Testing & Verification
- [x] Run TypeScript check (`npx tsc --noEmit`) - PASSED
- [x] Run lint check (`npm run lint`) - PASSED (pre-existing warnings only)
- [x] Run build (`npm run build`) - PASSED

### Phase 5: Finalization
- [x] Add Review section to this file
- [ ] Push branch to remote
- [ ] Create PR

---

## Acceptance Criteria
- [x] GlobalSearch button appears in header
- [x] Cmd+K / Ctrl+K opens search dialog
- [x] Typing searches across ledger, clients, cheques
- [x] Results grouped by type with Arabic labels
- [x] Clicking result navigates to correct page
- [x] Keyboard navigation works (up/down, Enter, Esc)
- [x] Debounced search (300ms)
- [x] Loading state shows spinner
- [x] Empty state shows helpful message
- [x] RTL layout correct
- [x] Mobile responsive
- [x] No TypeScript errors

---

## Component Architecture

```
GlobalSearch (trigger in header)
├── Button with search icon + ⌘K badge
└── SearchDialog (modal)
    ├── Command.Input (search input)
    ├── Command.List
    │   ├── Command.Empty (no results)
    │   └── Command.Group (per type)
    │       └── Command.Item[] (results)
    └── Footer (keyboard hints)
```

## Type Labels (Arabic)
```typescript
const typeLabels = {
  ledger: "الحركات المالية",
  client: "العملاء",
  cheque: "الشيكات",
  payment: "المدفوعات",
};
```

---

## Review

### Files Changed

| File | Change |
|------|--------|
| `src/components/ui/command.tsx` | **NEW** - Command UI component (shadcn wrapper for cmdk) |
| `src/components/search/useGlobalSearch.ts` | **NEW** - Search hook with debounced Firestore queries |
| `src/components/search/SearchDialog.tsx` | **NEW** - Command palette modal dialog |
| `src/components/search/SearchResults.tsx` | **NEW** - Grouped results display component |
| `src/components/search/GlobalSearch.tsx` | **NEW** - Trigger button with Cmd+K shortcut |
| `src/components/search/index.ts` | **NEW** - Barrel exports |
| `src/components/layout/header.tsx` | **MODIFIED** - Added GlobalSearch component |

### Architecture Summary

```
Header
└── GlobalSearch
    ├── Trigger Button (⌘K badge)
    └── SearchDialog (CommandDialog)
        ├── CommandInput (RTL, Arabic placeholder)
        ├── CommandList
        │   ├── Loading state (spinner)
        │   ├── Empty state ("ابدأ الكتابة للبحث...")
        │   ├── No results state
        │   └── SearchResults
        │       ├── Group: الحركات المالية (ledger)
        │       ├── Group: العملاء (clients)
        │       ├── Group: الشيكات (cheques)
        │       └── Group: المدفوعات (payments)
        └── Footer (keyboard hints)
```

### Key Features Implemented

1. **Command Palette (Cmd+K / Ctrl+K):** Opens search dialog from anywhere
2. **Debounced Search (300ms):** Prevents excessive API calls
3. **Multi-Collection Search:** Searches ledger, clients, cheques, payments
4. **Grouped Results:** Results organized by type with Arabic labels
5. **Keyboard Navigation:** Arrow keys to navigate, Enter to select, Esc to close
6. **Loading State:** Spinner while searching
7. **Empty States:** Helpful messages for initial state and no results
8. **RTL Layout:** Proper Arabic/RTL support throughout
9. **Mobile Responsive:** Works on all screen sizes
10. **Direct Navigation:** Clicking result navigates to correct page with highlight param

### Test Results

```
TypeScript: PASSED (no errors)
ESLint: PASSED (pre-existing warnings only)
Build: PASSED (21/21 pages generated)
```

---

## Status: READY FOR PR
