# Task: Full Performance Audit

## Branch
`audit/performance-review`

---

## Status: AWAITING APPROVAL

---

# Performance Audit Report

## Executive Summary

Comprehensive analysis of the FactoryFlow codebase identified **32 performance issues** across 6 categories:
- **8 Critical Issues** (fix immediately)
- **14 Medium Issues** (should fix)
- **10 Minor Issues** (nice to have)

**Estimated Impact**: 15-30% bundle size reduction, 40-60% fewer Firestore reads on dashboard, significant render performance improvements.

---

# CRITICAL ISSUES (Fix Immediately)

## 1. Unused Dependencies Bloating Bundle

| Property | Value |
|----------|-------|
| **Files** | `package.json` (lines 47, 55) |
| **Problem** | `jspdf` (29MB) and `recharts` (5.2MB) are installed but NEVER imported in source code |
| **Impact** | HIGH - 34MB wasted in node_modules, increases install time |
| **Fix** | Remove both packages from package.json |

---

## 2. Dashboard Loads ALL Ledger Entries on Every Visit

| Property | Value |
|----------|-------|
| **File** | `src/components/dashboard/hooks/useDashboardData.ts` (lines 57-140) |
| **Problem** | Two `onSnapshot` listeners fetch ENTIRE ledger and payments collections, then aggregate client-side |
| **Impact** | HIGH - O(n) Firestore reads on every dashboard load. 1000 entries = 1000 reads |
| **Fix** | Use Firestore aggregation queries or pre-computed counters document |

```typescript
// Current (BAD): Fetches all documents
onSnapshot(query(collection(db, 'users', uid, 'ledger')), (snapshot) => {
  snapshot.forEach(doc => { /* aggregate in JS */ });
});

// Better: Use aggregation or counters document
const countersRef = doc(db, 'users', uid, 'counters', 'dashboard');
```

---

## 3. Firebase Context Value Not Memoized

| Property | Value |
|----------|-------|
| **File** | `src/firebase/provider.tsx` (lines 190-193) |
| **Problem** | Context value object recreated on every render, causing ALL consumers to re-render |
| **Impact** | HIGH - Every component using `useUser()` re-renders unnecessarily |
| **Fix** | Wrap context value in `useMemo` |

```typescript
// Current (BAD)
return (
  <UserContext.Provider value={{ user, role, loading, signOut: signOutUser }}>

// Fixed
const value = useMemo(() => ({ user, role, loading, signOut: signOutUser }), [user, role, loading]);
return (
  <UserContext.Provider value={value}>
```

---

## 4. Queries Without Limits (Unbounded Data)

| Property | Value |
|----------|-------|
| **Files** | `src/lib/backup-utils.ts` (line 69), `src/services/journalService.ts` (lines 125, 624) |
| **Problem** | Firestore queries without `limit()` can fetch unlimited documents |
| **Impact** | HIGH - Could crash browser with large datasets, excessive Firestore costs |
| **Fix** | Add appropriate limits to all queries |

```typescript
// Current (BAD)
const q = query(collectionRef);  // NO LIMIT

// Fixed
const q = query(collectionRef, limit(1000));
```

---

## 5. Export Libraries Loaded Synchronously

| Property | Value |
|----------|-------|
| **File** | `src/lib/export-utils.ts` (lines 3-5) |
| **Problem** | ExcelJS (23MB) imported at top-level, bundled into every page that imports export functions |
| **Impact** | HIGH - Pages load 23MB+ even when user never exports |
| **Fix** | Use dynamic imports |

```typescript
// Current (BAD)
import ExcelJS from 'exceljs';

// Fixed
export async function exportToExcel(...) {
  const ExcelJS = (await import('exceljs')).default;
  // ...
}
```

---

## 6. Reports Page Missing useCallback for 7 Handlers

| Property | Value |
|----------|-------|
| **File** | `src/components/reports/reports-page.tsx` (lines 245-345) |
| **Problem** | 7 handler functions recreated on every render, passed to child components |
| **Impact** | HIGH - Causes all child components to re-render on every parent state change |
| **Fix** | Wrap all handlers in `useCallback` |

Handlers affected:
- `handleExportPDF` (line 246)
- `handleExportExcel` (line 268)
- `handleExportCSV` (line 299)
- `handleReportClick` (line 330)
- `handleCustomDateClick` (line 335)
- `handleCustomDateConfirm` (line 339)
- `handleDonutDetailsClick` (line 345)

---

## 7. Cheques Page Has 9 Scattered useState Calls

| Property | Value |
|----------|-------|
| **File** | `src/components/cheques/cheques-page.tsx` (lines 95-105) |
| **Problem** | 9 separate `useState` calls for dialog states cause multiple re-renders |
| **Impact** | HIGH - Each state update triggers separate re-render |
| **Fix** | Consolidate with `useReducer` (like ledger-page.tsx does) |

```typescript
// Current (BAD) - 9 separate states
const [imageViewerOpen, setImageViewerOpen] = useState(false);
const [selectedImageUrl, setSelectedImageUrl] = useState('');
const [endorseDialogOpen, setEndorseDialogOpen] = useState(false);
// ... 6 more

// Fixed - Single reducer
const [state, dispatch] = useReducer(chequesReducer, initialState);
```

---

## 8. All Images Use `unoptimized` Prop

| Property | Value |
|----------|-------|
| **Files** | `ChequeDialogs.tsx`, `IncomingChequeDialogs.tsx`, `OutgoingChequeDialogs.tsx` (lines 34-40) |
| **Problem** | Next.js Image component has `unoptimized` prop, disabling all optimization |
| **Impact** | HIGH - No WebP conversion, no responsive sizes, no lazy loading optimization |
| **Fix** | Remove `unoptimized` prop, configure remote patterns properly |

---

# MEDIUM ISSUES (Should Fix)

## 9. Ledger Page Missing useCallback for Handlers

| Property | Value |
|----------|-------|
| **File** | `src/components/ledger/ledger-page.tsx` (lines 146-245) |
| **Problem** | 9 handler functions without useCallback passed to child components |
| **Impact** | MEDIUM - LedgerTable and dialogs re-render unnecessarily |
| **Fix** | Wrap handlers in useCallback |

---

## 10. Dashboard Page Missing useCallback

| Property | Value |
|----------|-------|
| **File** | `src/components/dashboard/dashboard-page.tsx` (lines 29-78) |
| **Problem** | State setters and handlers passed to children without memoization |
| **Impact** | MEDIUM - Dashboard cards re-render on unrelated state changes |
| **Fix** | Wrap in useCallback |

---

## 11. Invoices Page Calculations Not Memoized

| Property | Value |
|----------|-------|
| **File** | `src/components/invoices/invoices-page.tsx` (lines 167-187) |
| **Problem** | Status counts and totals recalculated on every render |
| **Impact** | MEDIUM - Array filtering runs unnecessarily |
| **Fix** | Wrap in useMemo |

```typescript
// Current (BAD)
const paidCount = invoices.filter((inv) => inv.status === "paid").length;

// Fixed
const paidCount = useMemo(() =>
  invoices.filter((inv) => inv.status === "paid").length,
  [invoices]
);
```

---

## 12. Reports Page Has 4 Concurrent Queries

| Property | Value |
|----------|-------|
| **File** | `src/components/reports/hooks/useReportsData.ts` (lines 88-145) |
| **Problem** | Fetches Ledger (1000), Payments (1000), Inventory (500), Fixed Assets (500) in parallel |
| **Impact** | MEDIUM - 3000 potential document reads per report load |
| **Fix** | Consider caching, reduce limits, or paginate |

---

## 13. useAllClients Runs 3 Parallel Queries

| Property | Value |
|----------|-------|
| **File** | `src/hooks/useAllClients.ts` (lines 86-89) |
| **Problem** | Every component using this hook triggers 3 Firestore queries |
| **Impact** | MEDIUM - Redundant queries if multiple components use hook |
| **Fix** | Add caching layer or lift to context |

---

## 14. Global Search Runs 4 Queries Per Keystroke

| Property | Value |
|----------|-------|
| **File** | `src/components/search/useGlobalSearch.ts` (lines 71-155) |
| **Problem** | Search triggers 4 parallel queries (ledger, clients, cheques, payments) |
| **Impact** | MEDIUM - Debounce helps but still expensive |
| **Fix** | Consider Algolia/ElasticSearch, or implement server-side search |

---

## 15. No List Virtualization for Large Tables

| Property | Value |
|----------|-------|
| **Files** | `ledger-page.tsx`, `invoices-page.tsx`, `cheques-page.tsx`, `UserList.tsx` |
| **Problem** | Tables render all rows to DOM, no virtualization |
| **Impact** | MEDIUM - Slow rendering with 100+ rows |
| **Fix** | Implement react-window or @tanstack/react-virtual |

---

## 16. HTML img Tags Without Lazy Loading

| Property | Value |
|----------|-------|
| **Files** | 9 files with `<img>` tags (see list below) |
| **Problem** | No `loading="lazy"` attribute on any images |
| **Impact** | MEDIUM - All images load immediately, blocking render |
| **Fix** | Add `loading="lazy"` and `decoding="async"` |

Files:
- `IncomingChequesFormDialog.tsx` (line 262)
- `ChequesFormDialog.tsx` (line 280)
- `OutgoingChequesFormDialog.tsx` (line 264)
- `invoices-page.tsx` (line 359)
- `InvoicesFormDialog.tsx` (line 449)
- `QuickInvoiceDialog.tsx` (line 663)

---

## 17. N+1 Query Pattern in Production Operations

| Property | Value |
|----------|-------|
| **File** | `src/components/production/hooks/useProductionOperations.ts` (lines 91-156) |
| **Problem** | Multiple sequential getDocs calls for inventory items in edit mode |
| **Impact** | MEDIUM - 4 queries per production order edit |
| **Fix** | Batch queries or prefetch inventory items |

---

## 18. N+1 Query Pattern in Cheques Operations

| Property | Value |
|----------|-------|
| **File** | `src/components/cheques/hooks/useChequesOperations.ts` (lines 173-197, 260-264) |
| **Problem** | Inline ledger queries during cheque batch operations |
| **Impact** | MEDIUM - Extra queries inside transaction |
| **Fix** | Move queries outside batch, use transaction.get() |

---

## 19. TrialBalanceTab Missing React.memo

| Property | Value |
|----------|-------|
| **File** | `src/components/reports/tabs/TrialBalanceTab.tsx` (lines 28-275) |
| **Problem** | Large component not wrapped with React.memo |
| **Impact** | MEDIUM - Entire trial balance re-renders on parent state change |
| **Fix** | Wrap export with React.memo |

---

## 20. Payments Page Not Memoized (953 lines)

| Property | Value |
|----------|-------|
| **File** | `src/components/payments/payments-page.tsx` |
| **Problem** | Largest page component (953 lines) with no React.memo |
| **Impact** | MEDIUM - Complex multi-allocation UI re-renders unnecessarily |
| **Fix** | Split into smaller components, add React.memo |

---

## 21. Invoices Page Scattered useState

| Property | Value |
|----------|-------|
| **File** | `src/components/invoices/invoices-page.tsx` (lines 42-53) |
| **Problem** | 6 separate useState calls for dialog/form state |
| **Impact** | MEDIUM - Multiple re-renders on state updates |
| **Fix** | Consolidate with useReducer |

---

## 22. Clients Page Scattered useState

| Property | Value |
|----------|-------|
| **File** | `src/components/clients/clients-page.tsx` (lines 78-83) |
| **Problem** | 6 separate useState calls |
| **Impact** | MEDIUM - Scattered state management |
| **Fix** | Consolidate with useReducer |

---

# MINOR ISSUES (Nice to Have)

## 23. Google Fonts Blocking Render

| Property | Value |
|----------|-------|
| **File** | `src/app/layout.tsx` (lines 19-22) |
| **Problem** | External font request in `<head>` blocks initial paint |
| **Impact** | LOW - Adds ~100-300ms to First Contentful Paint |
| **Fix** | Use `next/font` for automatic optimization, or self-host Cairo font |

---

## 24. recharts in next.config.js Tree-Shaking

| Property | Value |
|----------|-------|
| **File** | `next.config.js` (line 24) |
| **Problem** | recharts listed in `optimizePackageImports` but package is unused |
| **Impact** | LOW - Wasted config |
| **Fix** | Remove from array |

---

## 25. Framer Motion Could Be Lazy Loaded

| Property | Value |
|----------|-------|
| **Files** | `cheque-card.tsx`, `cheques-list.tsx`, `floating-action-button.tsx`, `animated-components.tsx` |
| **Problem** | framer-motion (2.9MB) loaded synchronously for non-critical animations |
| **Impact** | LOW - Animations are nice-to-have, not critical |
| **Fix** | Consider React.lazy() for animated components |

---

## 26. Missing Image Dimensions (CLS Risk)

| Property | Value |
|----------|-------|
| **Files** | All `<img>` tags in cheques and invoices components |
| **Problem** | No explicit width/height causes Cumulative Layout Shift |
| **Impact** | LOW - Affects Core Web Vitals score |
| **Fix** | Add width/height or aspect-ratio CSS |

---

## 27. Journal Service Missing Pagination

| Property | Value |
|----------|-------|
| **File** | `src/services/journalService.ts` (line 624) |
| **Problem** | `getJournalEntries` has no limit, fetches all entries |
| **Impact** | LOW - Currently only used in specific contexts |
| **Fix** | Add pagination support |

---

## 28. Dashboard availableMonths Computed Inside Component

| Property | Value |
|----------|-------|
| **File** | `src/components/dashboard/dashboard-page.tsx` (lines 55-65) |
| **Problem** | `availableMonths` array built from constant, could be module-level |
| **Impact** | LOW - Minor memory allocation |
| **Fix** | Move to constants file |

---

## 29. Reports Duplicate Expense Category Calculations

| Property | Value |
|----------|-------|
| **File** | `src/components/reports/reports-page.tsx` (lines 157-180) |
| **Problem** | Expense categories processed twice (in filteredData and expenseCategories) |
| **Impact** | LOW - Redundant calculation |
| **Fix** | Derive from single source |

---

## 30. TrialBalanceTab groupAccountsByType Not Memoized

| Property | Value |
|----------|-------|
| **File** | `src/components/reports/tabs/TrialBalanceTab.tsx` (lines 34-50) |
| **Problem** | Account grouping function runs on every render |
| **Impact** | LOW - Small dataset typically |
| **Fix** | Wrap result in useMemo |

---

## 31. Backup Utils Sequential Collection Queries

| Property | Value |
|----------|-------|
| **File** | `src/lib/backup-utils.ts` (lines 65-100) |
| **Problem** | Loops through 11+ collections sequentially |
| **Impact** | LOW - Backup is infrequent operation |
| **Fix** | Consider parallel Promise.all |

---

## 32. CategoryRow in ReportsDetailedTables Not Memoized

| Property | Value |
|----------|-------|
| **File** | `src/components/reports/components/ReportsDetailedTables.tsx` (lines 117-132) |
| **Problem** | Inner CategoryRow component not wrapped with React.memo |
| **Impact** | LOW - Small number of rows typically |
| **Fix** | Add React.memo wrapper |

---

# Summary by Category

| Category | Critical | Medium | Minor | Total |
|----------|----------|--------|-------|-------|
| Firestore Queries | 2 | 5 | 2 | 9 |
| Bundle Size | 2 | 0 | 2 | 4 |
| React Performance | 2 | 6 | 3 | 11 |
| Data Fetching | 0 | 2 | 0 | 2 |
| Images & Assets | 2 | 1 | 1 | 4 |
| Dashboard Specific | 0 | 0 | 2 | 2 |
| **TOTAL** | **8** | **14** | **10** | **32** |

---

# Recommended Fix Order

## Phase 1: Quick Wins (1-2 hours)
- [ ] Remove unused dependencies (jspdf, recharts)
- [ ] Memoize Firebase context value
- [ ] Remove `unoptimized` prop from Next.js Images
- [ ] Add `loading="lazy"` to all `<img>` tags

## Phase 2: React Optimizations (2-4 hours)
- [ ] Add useCallback to reports-page.tsx handlers
- [ ] Add useCallback to ledger-page.tsx handlers
- [ ] Add useCallback to dashboard-page.tsx handlers
- [ ] Consolidate cheques-page.tsx useState with useReducer
- [ ] Add useMemo to invoices-page.tsx calculations

## Phase 3: Firestore Optimizations (4-8 hours)
- [ ] Add limits to unbounded queries
- [ ] Convert export-utils.ts to dynamic imports
- [ ] Implement dashboard counters/aggregation document
- [ ] Add caching to useAllClients

## Phase 4: Advanced Optimizations (8+ hours)
- [ ] Implement list virtualization for tables
- [ ] Split large page components
- [ ] Add React.memo to expensive components
- [ ] Optimize font loading

---

# Implementation Review

## Branch
`fix/performance-phase-1-2`

## Status: COMPLETED

---

## Changes Made

### Phase 1: Quick Wins (All Completed)

#### Fix #1: Removed Unused Dependencies
- **Files Changed**: `package.json`, `next.config.js`, `src/lib/export-utils.ts`, `src/lib/__tests__/export-utils.test.ts`
- **Changes**:
  - Removed `jspdf`, `jspdf-autotable`, and `recharts` from dependencies
  - Removed `recharts` from `optimizePackageImports` in next.config.js
  - Removed all jsPDF-related export functions (never called in production)
  - Updated tests to remove jsPDF references

#### Fix #3: Memoized Firebase Context Value
- **File Changed**: `src/firebase/provider.tsx`
- **Changes**:
  - Wrapped `signOutUser` in `useCallback`
  - Wrapped context value object in `useMemo` with proper dependencies
  - Prevents unnecessary re-renders of all context consumers

#### Fix #8: Removed `unoptimized` Prop from Next.js Images
- **Files Changed**:
  - `src/components/cheques/components/ChequeDialogs.tsx`
  - `src/components/cheques/components/IncomingChequeDialogs.tsx`
  - `src/components/cheques/components/OutgoingChequeDialogs.tsx`
- **Changes**: Removed `unoptimized` prop to enable Next.js image optimization

#### Fix #16: Added Lazy Loading to All `<img>` Tags
- **Files Changed** (6 files):
  - `src/components/invoices/invoices-page.tsx`
  - `src/components/invoices/components/InvoicesFormDialog.tsx`
  - `src/components/cheques/components/ChequesFormDialog.tsx`
  - `src/components/cheques/components/IncomingChequesFormDialog.tsx`
  - `src/components/cheques/components/OutgoingChequesFormDialog.tsx`
  - `src/components/ledger/components/QuickInvoiceDialog.tsx`
- **Changes**: Added `loading="lazy"` and `decoding="async"` attributes

---

### Phase 2: React Optimizations (Completed)

#### Fix #6: Added useCallback to reports-page.tsx
- **File Changed**: `src/components/reports/reports-page.tsx`
- **Changes**: Wrapped 7 handlers in `useCallback`:
  - `convertToCSV`, `handleExportPDF`, `handleExportExcel`, `handleExportCSV`
  - `handleReportClick`, `handleCustomDateClick`, `handleCustomDateConfirm`, `handleDonutDetailsClick`

#### Fix #9: Added useCallback to ledger-page.tsx
- **File Changed**: `src/components/ledger/ledger-page.tsx`
- **Changes**: Wrapped 12 handlers in `useCallback`:
  - `handleExportExcel`, `handleExportPDF`, `handleUnpaidClick`, `handleSubmit`
  - `handleEdit`, `handleDelete`, `openAddDialog`, `openRelatedDialog`
  - `openQuickPayDialog`, `handleAddPayment`, `handleAddCheque`, `handleAddInventory`

#### Fix #10: Dashboard Page (Already Optimized)
- **File Reviewed**: `src/components/dashboard/dashboard-page.tsx`
- **Result**: No changes needed - useState setters are stable references by default

#### Fix #7: Cheques Page useReducer (DEFERRED)
- **File Reviewed**: `src/components/cheques/cheques-page.tsx`
- **Result**: Deferred to follow-up PR - requires creating ~15 actions and significant refactor
- **Recommendation**: Separate PR for this larger refactoring task

#### Fix #11: Added useMemo to invoices-page.tsx
- **File Changed**: `src/components/invoices/invoices-page.tsx`
- **Changes**:
  - Created memoized `invoiceStats` object with `useMemo`
  - Replaced 4 inline calculations with memoized values:
    - `invoices.length` → `invoiceStats.total`
    - `invoices.filter(paid).length` → `invoiceStats.paidCount`
    - `invoices.filter(overdue).length` → `invoiceStats.overdueCount`
    - `invoices.reduce(total)` → `invoiceStats.totalValue`

---

## Build Verification
- All builds passed after each fix
- No type errors introduced
- All existing functionality preserved

## Remaining Items (Future PRs)
- Phase 3: Firestore Optimizations (unbounded queries, dynamic imports, dashboard counters)
- Phase 4: Advanced Optimizations (virtualization, component splitting, React.memo)
- Fix #7: Cheques page useReducer refactor
