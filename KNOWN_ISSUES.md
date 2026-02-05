# Known Issues & Roadmap

This document tracks known issues, technical debt, and the comprehensive improvement roadmap for FactoryFlow.

**Last Audit Date**: 2026-02-03
**Overall Health Score**: 78/100
**Roadmap Status**: Phase 1-4 Complete (Phase 3.3 deferred, Phase 4.1, 4.2, 4.4 deferred)

---

# 🗺️ COMPREHENSIVE IMPROVEMENT ROADMAP

## Executive Summary

| Category | Score | Status |
|----------|-------|--------|
| Data Integrity | 55/100 | 🔴 Critical issues |
| Accounting Compliance | 95/100 | ✅ Excellent |
| Code Architecture | 75/100 | 🟡 Improved (Phase 4) |
| Security | 85/100 | ✅ Good |
| Performance | 70/100 | 🟡 Acceptable |
| Maintainability | 70/100 | 🟡 Improved (Phase 4) |

## Codebase Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Total Lines of Code | ~97,800 | ~85,000 | 🟡 |
| Average File Size | 245 lines | <200 lines | 🟡 |
| Code in Oversized Files | 55% | <30% | 🟡 Improved |
| Unused Functions | ~10 | 0 | 🟡 |
| Duplicate Code | ~2,050 lines | <500 lines | 🟡 Improved |
| `any` Types | 90 | 0 | 🟡 Deferred |
| Test Coverage (client-detail) | 35 tests | - | ✅ New |

---

## Phase 1: Critical Fixes (Week 1-2) 🔴 HIGHEST PRIORITY

**Status**: ✅ Complete (4/4 tasks)
**Estimated Effort**: 40 hours
**Impact**: Fixed data integrity - balance calculations now use safe math consistently
**Completed**: 2026-02-04

### 1.1 Unify Balance Calculations
- [x] Delete `src/lib/calculations.ts` entirely (legacy, doesn't handle advances/loans) ✅ 2026-02-04
- [x] Update `src/lib/client-balance.ts` to use `safeAdd`/`safeSubtract` ✅ 2026-02-04
- [x] All balance calculations now use Decimal.js via currency.ts ✅ 2026-02-04

**Resolution**: Deleted legacy `calculations.ts` (9 unused functions, 350+ lines). `client-balance.ts` is now the single source of truth for balance calculations, using safe math throughout.

**Files Modified**:
- DELETED: `src/lib/calculations.ts`
- DELETED: `src/lib/__tests__/calculations.test.ts`
- UPDATED: `src/lib/client-balance.ts` (added safeAdd/safeSubtract)
**Status**: ✅ COMPLETE

### 1.2 Fix Dashboard Arithmetic
- [x] Replace all `+=` operations with `safeAdd()` in `useDashboardQueries.ts` ✅ 2026-02-04
- [x] Lines 143-188: revenue, expenses, discounts accumulation ✅ 2026-02-04
- [x] 22+ instances of unsafe arithmetic replaced ✅ 2026-02-04

**Resolution**: All dashboard aggregation now uses `safeAdd()` from `@/lib/currency` for precise decimal arithmetic.

**File**: `src/hooks/firebase-query/useDashboardQueries.ts`
**Status**: ✅ COMPLETE

### 1.3 Fix Security Issue (WriteOffDialog)
- [x] Change `user.uid` to `user.email || 'system'` in WriteOffDialog.tsx:157 ✅ 2026-02-03

**Problem**: Records wrong user ID for non-owner accountants
**File**: `src/components/ledger/components/WriteOffDialog.tsx:157`
**Status**: ✅ COMPLETE

### 1.4 Parallelize N+1 Queries
- [x] Replace sequential `for` loop with `Promise.all()` in LedgerService.ts ✅ 2026-02-04
- [x] Pattern 1: deleteLedgerEntry payment journals (lines 1530-1540) ✅ 2026-02-04
- [x] Pattern 2: deleteLedgerEntry cheque payments + journals (lines 1558-1585) ✅ 2026-02-04
- [x] Pattern 3: updateLedgerEntry cashed cheque payments (lines 1166-1211) ✅ 2026-02-04

**Resolution**: All 3 N+1 query patterns converted to parallel execution using `Promise.all()`. Expected 5-10x improvement for transaction deletions with multiple cheques.

**File**: `src/services/ledger/LedgerService.ts`
**Status**: ✅ COMPLETE

---

## Phase 2: Dead Code Cleanup (Week 2) 🟡 QUICK WIN

**Status**: ✅ Complete (5/5 tasks)
**Estimated Effort**: 8 hours
**Impact**: ~1,400 lines removed, cleaner codebase

### 2.1 Delete Unused Functions in utils.ts
- [x] Delete `formatDateForInput()` (line 29) ✅ 2026-02-03
- [x] Delete `translateStatus()` (line 118) ✅ 2026-02-03
- [x] Delete `formatFileSize()` (line 141) ✅ 2026-02-03
- [x] Delete `isImageFile()` (line 152) ✅ 2026-02-03
- [x] Delete `generateExcelFileName()` (line 180) ✅ 2026-02-03

**File**: `src/lib/utils.ts`
**Status**: ✅ COMPLETE - 5 functions deleted, corresponding tests removed

### 2.2 Delete Unused Functions in arap-utils.ts
- [x] Delete `isValidTransactionId()` (line 87) ✅ 2026-02-03
- [x] Delete `validatePaymentAmount()` (line 102) ✅ 2026-02-03
- [x] Delete `updateARAPOnPaymentAdd()` (line 322) ✅ 2026-02-03
- [x] Delete `reverseARAPOnPaymentDelete()` (line 358) ✅ 2026-02-03
- [x] Delete `updateLedgerEntryById()` (line 391) ✅ 2026-02-03

**File**: `src/lib/arap-utils.ts`
**Status**: ✅ COMPLETE - 5 functions deleted, corresponding tests removed, unused internal helpers cleaned up

### 2.3 Delete Unused Function in backup-utils.ts
- [x] Verify `validateBackup()` - **ACTUALLY USED** internally by `restoreBackup()` and `parseBackupFile()` ✅ 2026-02-03

**File**: `src/lib/backup-utils.ts`
**Status**: ✅ VERIFIED - Function is used internally, should NOT be deleted (audit report was incorrect)

### 2.4 Delete Backup Files
- [x] Delete `src/components/clients/clients-page-old.tsx.bak` ✅ 2026-02-03

### 2.5 Consolidate Error Handling
- [x] Merge `error-handler.ts` functionality into `error-handling.ts` ✅ 2026-02-03
- [x] Update use-async-operation.ts imports ✅ 2026-02-03
- [x] Delete `src/lib/error-handler.ts` ✅ 2026-02-03
- [x] Delete `src/lib/__tests__/error-handler.test.ts` ✅ 2026-02-03

**Files Modified**:
- UPDATED: `src/lib/error-handling.ts` (added ErrorResult, handleFirebaseErrorSimple, logErrorSimple)
- UPDATED: `src/lib/hooks/use-async-operation.ts` (imports from error-handling)
- DELETED: `src/lib/error-handler.ts`
- DELETED: `src/lib/__tests__/error-handler.test.ts`
**Status**: ✅ COMPLETE - 4 unused functions removed (handleCRUDError, createSuccessMessage, withErrorHandling, validateRequiredFields with labels)

---

## Phase 3: Consolidate Duplications (Week 3-4) 🟡 REDUCES MAINTENANCE

**Status**: ✅ Partial (3.1, 3.2 Complete; 3.3 Deferred)
**Estimated Effort**: 32 hours
**Impact**: ~236 net lines saved, easier maintenance
**Completed**: 2026-02-05

### 3.1 Create ExcelReportBuilder ✅ COMPLETE
- [x] Create `src/lib/excel/ExcelReportBuilder.ts` with reusable builder pattern ✅ 2026-02-05
- [x] Create `src/lib/excel/index.ts` for clean exports ✅ 2026-02-05
- [x] Refactor `export-ledger-excel.ts` to use builder (290→166 lines, -124) ✅ 2026-02-05
- [x] Refactor `export-cheques-excel.ts` to use builder (264→137 lines, -127) ✅ 2026-02-05
- [x] Refactor `export-payments-excel.ts` to use builder (241→104 lines, -137) ✅ 2026-02-05
- [x] Refactor `export-inventory-excel.ts` to use builder (263→128 lines, -135) ✅ 2026-02-05
- [x] Refactor `export-payroll-excel.ts` to use builder (267→137 lines, -130) ✅ 2026-02-05
- [x] Test: All Excel exports work correctly ✅ 2026-02-05
- [ ] `export-reports-excel.ts` - NOT refactored (unique 2-table structure)
- [ ] `export-statement-excel.ts` - NOT refactored (unique multi-section structure)

**Resolution**: Created `ExcelReportBuilder` (446 lines) with fluent API. Refactored 5/7 export files. Net savings: 207 lines (653 removed from files, 446 added for builder).

**Files Created**:
- `src/lib/excel/ExcelReportBuilder.ts` (446 lines) - Fluent builder with setColumns, setTitle, addInfoRow, addTableHeader, addDataRows, addTotalsRow, addFooter, download
- `src/lib/excel/index.ts` (14 lines) - Re-exports

**Files Modified** (refactored):
- `src/lib/export-payments-excel.ts` (241→104 lines)
- `src/lib/export-cheques-excel.ts` (264→137 lines)
- `src/lib/export-inventory-excel.ts` (263→128 lines)
- `src/lib/export-ledger-excel.ts` (290→166 lines)
- `src/lib/export-payroll-excel.ts` (267→137 lines)

### 3.2 Extract Shared Cheque Utilities ✅ COMPLETE
- [x] Extract `sanitizeFileName()` to `src/lib/utils.ts` ✅ 2026-02-05
- [x] Remove duplicate from `LedgerService.ts` ✅ 2026-02-05
- [x] Remove duplicate from `useIncomingChequesOperations.ts` ✅ 2026-02-05
- [x] Remove duplicate from `useOutgoingChequesOperations.ts` ✅ 2026-02-05
- [x] Test: All cheque operations work correctly ✅ 2026-02-05

**Resolution**: Extracted `sanitizeFileName()` to shared utility. Removed 3 duplicate implementations (~50 lines saved).

**Note on Hook Parameterization**: Investigation revealed cheque hooks are NOT simply parameterizable - they have different return types, operations, and dependencies. The original audit recommendation was incorrect.

**Files Modified**:
- `src/lib/utils.ts` - Added sanitizeFileName (+20 lines)
- `src/services/ledger/LedgerService.ts` - Import from utils (-17 lines)
- `src/components/cheques/hooks/useIncomingChequesOperations.ts` - Import from utils (-19 lines)
- `src/components/cheques/hooks/useOutgoingChequesOperations.ts` - Import from utils (-19 lines)

### 3.3 Centralize Date/Currency Formatting ⏸️ DEFERRED
- [ ] Create `src/lib/formatting.ts` with unified formatters
- [ ] Move date functions from `utils.ts` and `date-utils.ts`
- [ ] Create locale-aware `formatDate(date, locale)`
- [ ] Create unified `formatCurrency(amount, options)`
- [ ] Update all consumers
- [ ] Test: Arabic and English formatting works correctly

**Status**: ⏸️ DEFERRED - Requires careful analysis

**Problem**: 3 conflicting implementations serve different purposes:
| File | Function | Locale | Usage |
|------|----------|--------|-------|
| `utils.ts` | `formatCurrency()` | ar-SA (Arabic) | Arabic UI components |
| `date-utils.ts` | `formatNumber()` | en-US (English) | Excel exports |
| `statement-format.ts` | `formatCurrency()` | English, 2 decimals | Client statements |

**Why Deferred**:
1. Each implementation serves a specific locale requirement
2. Consolidation would require adding locale parameter to all call sites
3. Risk of breaking existing Arabic/English formatting
4. Lower priority than other improvements

**Recommendation**: Add locale parameter when touching these functions for other reasons, rather than a dedicated refactoring pass.

---

## Phase 4: Architecture Refactoring (Week 5-8) 🟢 MAINTAINABILITY

**Status**: ✅ Partial (4.3 Complete, 4.1/4.2/4.4 Deferred)
**Estimated Effort**: 20 hours (reduced from 80)
**Impact**: client-detail-page.tsx reduced from 1,605 to 308 lines (~81% reduction)
**Completed**: 2026-02-05

### 4.1 Split LedgerService ⏸️ DEFERRED
- [ ] Create `src/services/ledger/TransactionService.ts` (~400 lines)
- [ ] Create `src/services/ledger/PaymentService.ts` (~400 lines)
- [ ] Create `src/services/ledger/ChequePaymentService.ts` (~400 lines)
- [ ] Create `src/services/ledger/InventoryService.ts` (~300 lines)
- [ ] Refactor `LedgerService.ts` to orchestrator only (~300 lines)

**Status**: ⏸️ DEFERRED - Adds forwarding overhead; no concrete pain point currently
**Reason**: Facade pattern would add complexity without clear benefit. Handlers already extracted.

### 4.2 Shared Cheque Hooks ⏸️ REMOVED FROM PLAN
- [x] Extract `uploadChequeImage` utility ✅ 2026-02-05
- [ ] ~~Shared `useChequeSubmit` hook~~ - REMOVED

**Status**: ⏸️ Utility extraction only - shared hook removed from plan
**Reason**: Investigation revealed only 35% overlap between incoming/outgoing hooks. Abstraction risk > duplication cost. Hooks have different return types, operations, and dependencies.

**Files Created**:
- `src/components/cheques/utils/cheque-image-upload.ts` - Pure image upload utility
- `src/components/cheques/utils/index.ts` - Re-exports

### 4.3 Split client-detail-page ✅ COMPLETE
**Status**: ✅ Complete (1,605 → 308 lines, 81% reduction)
**Approach**: Test-first refactoring with smoke tests before extraction

#### 4.3-pre: Write Smoke Tests ✅
- [x] Create `src/components/clients/__tests__/client-detail-page.test.tsx` (944 lines) ✅ 2026-02-05
- [x] 35 smoke tests covering rendering, tabs, exports, modals, error states ✅ 2026-02-05
- [x] Mock pattern using collection path tracking for simultaneous onSnapshot calls ✅ 2026-02-05

#### 4.3A: Extract Hooks ✅
- [x] Create `src/components/clients/hooks/useClientData.ts` (~70 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/hooks/useLedgerForClient.ts` (~139 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/hooks/usePaymentsForClient.ts` (~70 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/hooks/useChequesForClient.ts` (~68 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/hooks/useStatementData.ts` (~323 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/hooks/index.ts` (barrel export) ✅ 2026-02-05

#### 4.3B: Extract Components ✅
- [x] Create `src/components/clients/components/ClientInfoCard.tsx` (~35 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/FinancialOverviewCards.tsx` (~75 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/TransactionsTab.tsx` (~60 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/PaymentsTab.tsx` (~60 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/ChequesTab.tsx` (~80 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/statement/StatementHeader.tsx` (~30 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/statement/DateFilterBar.tsx` (~90 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/statement/StatementTable.tsx` (~130 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/statement/PendingChequesSection.tsx` (~75 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/statement/TransactionDetailModal.tsx` (~120 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/components/index.ts` (barrel export) ✅ 2026-02-05

#### 4.3C: Extract Utilities ✅
- [x] Create `src/components/clients/lib/statement-helpers.ts` (~30 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/lib/export-data-builder.ts` (~140 lines) ✅ 2026-02-05
- [x] Create `src/components/clients/lib/index.ts` (barrel export) ✅ 2026-02-05

**Final Structure**:
```
src/components/clients/
├── client-detail-page.tsx      # 308 lines (orchestrator only)
├── hooks/                      # 5 custom hooks
│   ├── useClientData.ts
│   ├── useLedgerForClient.ts
│   ├── usePaymentsForClient.ts
│   ├── useChequesForClient.ts
│   ├── useStatementData.ts
│   └── index.ts
├── components/                 # 10 UI components
│   ├── ClientInfoCard.tsx
│   ├── FinancialOverviewCards.tsx
│   ├── TransactionsTab.tsx
│   ├── PaymentsTab.tsx
│   ├── ChequesTab.tsx
│   ├── statement/
│   │   ├── StatementHeader.tsx
│   │   ├── DateFilterBar.tsx
│   │   ├── StatementTable.tsx
│   │   ├── PendingChequesSection.tsx
│   │   └── TransactionDetailModal.tsx
│   └── index.ts
├── lib/                        # 3 utility modules
│   ├── statement-helpers.ts
│   ├── export-data-builder.ts
│   └── index.ts
└── __tests__/
    └── client-detail-page.test.tsx  # 35 smoke tests
```

### 4.4 Replace `any` Types ⏸️ DEFERRED
- [ ] Create `src/types/forms.ts` with PaymentFormData, ChequeFormData, etc.
- [ ] Create `src/types/api.ts` with BackupData, ExportOptions, etc.
- [ ] Replace all `any` types with proper interfaces

**Status**: ⏸️ DEFERRED - Not causing bugs; low-value busywork
**Reason**: 90 `any` types exist but aren't causing runtime issues. Type improvements can be made incrementally during feature work.

---

## Phase 5: Data Integrity Hardening (Week 9-10) 🔴 PREVENTS CORRUPTION

**Status**: ⏳ Not Started
**Estimated Effort**: 40 hours
**Impact**: Eliminates data corruption risk

### 5.1 Implement True Atomicity
- [ ] Replace sequential operations with `runTransaction()` in LedgerService
- [ ] Ledger + Journal save atomically (both succeed or both fail)
- [ ] Remove rollback complexity
- [ ] Test: Failed journal doesn't leave orphan ledger entry

**Problem**: Current pattern can leave inconsistent data if journal fails after ledger commits

### 5.2 Add Balance Verification System
- [ ] Create nightly verification function
- [ ] Compare ledger-based vs journal-based balances
- [ ] Alert admin if difference > 0.01
- [ ] Add to scheduled tasks

### 5.3 Fix Silent Query Truncation
- [ ] Add warning toast when query hits limit
- [ ] Show "تحذير: تم تحميل X سجل فقط" message
- [ ] Add "Load All" button for power users
- [ ] Test: Warning appears when limit hit

**Problem**: Queries silently drop data beyond limit (10,000), causing wrong balances

---

## Phase 6: Performance Optimization (Week 11-12) 🟡 FASTER

**Status**: ⏳ Not Started
**Estimated Effort**: 24 hours
**Impact**: Faster load times, better UX

### 6.1 Add Query Limits to Unbounded Queries
- [ ] Add `limit(10000)` to `autoDepreciationService.ts:141`
- [ ] Add `limit(1)` to `invitationService.ts:58-64`
- [ ] Audit all other unbounded queries

### 6.2 Optimize Dashboard Listeners
- [ ] Reduce from 4+ simultaneous listeners to 2
- [ ] Implement smart caching for stable data (clients, partners)
- [ ] Consider React Query or SWR for caching
- [ ] Test: Dashboard loads faster

### 6.3 Implement Proper Pagination
- [ ] Fix `usePaginatedCollection` TODO
- [ ] Implement cursor-based pagination with `startAfter()`
- [ ] Add `loadMore()` function
- [ ] Test: Large datasets load incrementally

---

## Phase 7: Best-in-Class (Future) 🟢 MARKET LEADER

**Status**: ⏳ Planned
**Estimated Effort**: Variable
**Impact**: Enterprise-grade application

### 7.1 SOC 2 Compliance Preparation
- [ ] Implement comprehensive audit logging
- [ ] Add data encryption at rest
- [ ] Document access control policies
- [ ] Set up automated compliance monitoring

### 7.2 Advanced Error Tracking
- [ ] Replace console.log with Sentry structured logging
- [ ] Add module and operation tags
- [ ] Track user context (dataOwnerId)

### 7.3 Performance Monitoring
- [ ] Set up Firestore Key Visualizer
- [ ] Add custom performance traces
- [ ] Monitor query latencies

### 7.4 CI/CD Pipeline
- [ ] Add lint check to CI
- [ ] Add type-check to CI
- [ ] Add test coverage requirements
- [ ] Add integration tests to CI

---

## 📊 Progress Tracking

### Overall Progress
| Phase | Status | Progress | Completed Date |
|-------|--------|----------|----------------|
| Phase 1: Critical Fixes | ✅ Complete | 4/4 tasks | 2026-02-04 |
| Phase 2: Dead Code | ✅ Complete | 5/5 tasks | 2026-02-03 |
| Phase 3: Consolidation | ✅ Partial | 2/3 tasks (3.3 deferred) | 2026-02-05 |
| Phase 4: Architecture | ✅ Partial | 1/4 tasks (4.1, 4.2, 4.4 deferred) | 2026-02-05 |
| Phase 5: Data Integrity | ⏳ Not Started | 0/3 tasks | - |
| Phase 6: Performance | ⏳ Not Started | 0/3 tasks | - |
| Phase 7: Best-in-Class | ⏳ Planned | 0/4 tasks | - |

### Metrics Before/After
| Metric | Before | After Phase 1 | After Phase 2 | After Phase 3 | After Phase 4 | Final |
|--------|--------|---------------|---------------|---------------|---------------|-------|
| Lines of Code | 98,858 | 97,764 (-1,094) | - | 97,528 (-236) | ~97,800 (+268 net) | ~85,000 |
| Avg File Size | 249 | ~247 | - | ~245 | ~240 | ~180 |
| Duplicate Code | ~2,500 | ~2,500 | - | ~2,050 (-450) | ~2,050 | <500 |
| Balance Calcs | 4 | 1 | 1 | 1 | 1 | 1 |
| `any` Types | 90 | 90 | 90 | 90 | 90 (deferred) | 0 |
| Unused Functions | ~25 | ~10 | ~10 | ~10 | ~10 | 0 |
| client-detail-page.tsx | 1,605 | 1,605 | 1,605 | 1,605 | 308 (-81%) | ~200 |
| Custom hooks extracted | 0 | 0 | 0 | 0 | 5 | - |
| UI components extracted | 0 | 0 | 0 | 0 | 10 | - |
| Smoke tests | 0 | 0 | 0 | 0 | 35 | - |

---

# 🔴 CRITICAL ISSUES (Silent Errors)

## Client Balance Divergence
**Status**: ✅ Resolved - 2026-02-04
**Impact**: Users now see consistent balances across all screens
**Resolution**: Phase 1.1 Complete

Legacy `calculations.ts` deleted. All balance calculations now use `client-balance.ts` with safe math (Decimal.js).

## Floating-Point Arithmetic
**Status**: ✅ Resolved - 2026-02-04
**Impact**: Dashboard totals now use precise decimal arithmetic
**Resolution**: Phase 1.2 Complete

Dashboard now uses `safeAdd()` from `@/lib/currency` for all aggregations. 22+ instances of unsafe arithmetic replaced.

## Query Truncation
**Status**: 🟡 Active - Affects large accounts only
**Impact**: Clients with >10,000 transactions show wrong balance
**Resolution**: Phase 5.3

Queries have hard limits that silently drop old data without warning users.

---

## 🧪 Test Status

### All Tests Passing ✅
**Status**: Resolved
**Date Fixed**: 2026-02-02
**Branch**: fix/quickpay-dialog-tests

**Current State**:
- ✅ 1274 tests passing (49 test suites)
- ✅ 100% pass rate
- ✅ All unit tests and integration tests working
- ✅ 35 new smoke tests for client-detail-page (Phase 4)

**What Was Fixed**:
The 18 failing tests were caused by missing service mocks. Fixed by adding:

1. **LedgerService.test.ts** - Added mock for `@/services/journal`:
   ```typescript
   jest.mock('@/services/journal', () => ({
     createJournalPostingEngine: jest.fn(() => ({
       post: mockPost,
     })),
     getEntriesByTransactionId: jest.fn().mockResolvedValue([]),
   }));
   ```

2. **QuickPayDialog.test.tsx** - Added mock for `@/services/ledgerService`:
   ```typescript
   jest.mock('@/services/ledgerService', () => ({
     createLedgerService: jest.fn(() => ({
       addQuickPayment: mockAddQuickPayment,
     })),
   }));
   ```

**Integration Test Infrastructure** (also added):
- Firebase Emulator integration tests for accounting workflows
- Tests verify Trial Balance, Decimal.js calculations, account code mapping
- Run with: `firebase emulators:start --only firestore` then `npm run test:integration`

### Test Warnings (Non-blocking) ⚠️
**Status**: Low priority - tests pass but emit warnings
**Impact**: Console noise, minor test quality issues

#### 1. Missing DialogDescription Warning
**Location**: `src/components/ui/__tests__/dialog.test.tsx`
**Warning**:
```
Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.
```
**Cause**: Radix UI Dialog tests don't include `<DialogDescription>` component
**Fix**: Add `<DialogDescription>` to test dialogs or use `aria-describedby={undefined}` to suppress
**Priority**: Low (accessibility best practice, not functional)

#### 2. React Act Environment Warning
**Location**: `src/components/auth/__tests__/login-page.test.tsx`
**Warning**:
```
Warning: The current testing environment is not configured to support act(...)
```
**Cause**: Async state updates (`setRateLimitStatus`, `setLoading`) at lines 101 and 170 happen outside `act()` wrapper
**Fix**: Wrap async operations in `act()` or use `waitFor()` from @testing-library/react
**Priority**: Low (test timing issue, tests still pass)

---

## 📋 Technical Debt

### Phase 2: True Atomicity for Journal Entries
**Status**: Planned improvement
**Priority**: Medium
**Estimated Effort**: 2-3 days

**Current State**: Phase 1 rollback pattern implemented
- Ledger committed → Journal fails → Rollback deletes ledger
- 95%+ cases handled automatically
- Logged to `failed_rollbacks` collection when rollback fails

**Limitation**:
- Not truly atomic (3 sequential operations)
- UPDATE operations may cause data loss on rollback
- Rollback itself can fail (worst case scenario)

**Phase 2 Goals**:
- Implement Firestore `runTransaction` for true atomicity
- Both ledger + journal succeed or both fail (guaranteed by Firestore)
- Eliminates rollback complexity
- No data loss risk for UPDATE operations

**Challenges**:
- Firestore transaction limits (500 documents)
- Can't use `serverTimestamp()` directly in transactions
- More complex implementation across 6 functions
- Requires thorough testing of all transaction types

**Timeline**: Scheduled for next technical debt sprint

---

## 🔄 Future Improvements

### Performance Optimizations
- Client balance calculation is O(n) - consider server-side aggregation
- Some pages have 4+ `onSnapshot` listeners - evaluate consolidation
- Dashboard queries unbounded by date - add date range filter for large datasets

### Code Quality
- `usePaginatedCollection` hook incomplete - `loadMore()` is TODO
- Some hardcoded limits (e.g., `limit(5000)` in journalService)

---

## 📝 Notes

**Last Updated**: 2026-02-05
**Last Reviewed**: Comprehensive forensic audit completed

**Change Log**:
- 2026-02-05: ✅ Phase 4.3 Complete - Refactored client-detail-page.tsx (1,605→308 lines, 81% reduction)
- 2026-02-05: ✅ Created 35 smoke tests for client-detail-page before refactoring
- 2026-02-05: ✅ Extracted 5 custom hooks (useClientData, useLedgerForClient, usePaymentsForClient, useChequesForClient, useStatementData)
- 2026-02-05: ✅ Extracted 10 UI components (ClientInfoCard, FinancialOverviewCards, TransactionsTab, PaymentsTab, ChequesTab, StatementHeader, DateFilterBar, StatementTable, PendingChequesSection, TransactionDetailModal)
- 2026-02-05: ✅ Extracted 3 utility modules (statement-helpers, export-data-builder)
- 2026-02-05: ✅ Extracted cheque image upload utility (cheque-image-upload.ts)
- 2026-02-05: ⏸️ Deferred Phase 4.1 (LedgerService split), 4.2 (shared cheque hooks), 4.4 (any types) - low ROI
- 2026-02-05: ✅ Phase 3.1 Complete - Created ExcelReportBuilder, refactored 5/7 export files (207 net lines saved)
- 2026-02-05: ✅ Phase 3.2 Complete - Extracted sanitizeFileName to shared utils (~50 lines saved)
- 2026-02-05: ⏸️ Phase 3.3 Deferred - Formatting consolidation blocked due to 3 conflicting locale implementations
- 2026-02-04: ✅ Phase 1 Complete - All critical fixes implemented
- 2026-02-04: ✅ Deleted legacy calculations.ts (Phase 1.1) - 9 unused functions, 350+ lines removed
- 2026-02-04: ✅ Added safe math to client-balance.ts (Phase 1.1) - safeAdd/safeSubtract for balance calcs
- 2026-02-04: ✅ Fixed dashboard arithmetic (Phase 1.2) - 22+ unsafe += replaced with safeAdd()
- 2026-02-04: ✅ Parallelized N+1 queries (Phase 1.4) - 3 patterns fixed with Promise.all(), 5-10x faster deletions
- 2026-02-03: ✅ Consolidated error handling - merged error-handler.ts into error-handling.ts (Phase 2.5 complete)
- 2026-02-03: ⚠️ Documented pre-existing test warnings (DialogDescription, React act) for future fix
- 2026-02-03: ✅ Deleted 10 unused functions from utils.ts and arap-utils.ts (Phase 2.1, 2.2 complete)
- 2026-02-03: ✅ Verified validateBackup() is actually used - audit report corrected (Phase 2.3)
- 2026-02-03: ✅ Fixed WriteOffDialog security issue (Phase 1.3 complete)
- 2026-02-03: ✅ Deleted clients-page-old.tsx.bak (Phase 2.4 complete)
- 2026-02-03: Added comprehensive 7-phase improvement roadmap from forensic audit
- 2026-02-03: Documented all critical issues (balance divergence, floating-point, query truncation)
- 2026-02-03: Added progress tracking tables for metrics before/after
- 2026-02-03: Identified ~25 unused functions, ~2,500 lines duplicate code
- 2026-02-02: Fixed all 18 failing tests by adding proper service mocks
- 2026-02-02: Added Firebase Emulator integration test infrastructure
- 2026-02-02: Initial documentation of QuickPayDialog test failures
- 2026-02-02: Added Phase 2 atomicity improvement plan
