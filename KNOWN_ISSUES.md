# Known Issues & Roadmap

This document tracks known issues, technical debt, and the comprehensive improvement roadmap for FactoryFlow.

**Last Audit Date**: 2026-02-03
**Overall Health Score**: 68/100
**Roadmap Status**: Phase 1 - Not Started

---

# 🗺️ COMPREHENSIVE IMPROVEMENT ROADMAP

## Executive Summary

| Category | Score | Status |
|----------|-------|--------|
| Data Integrity | 55/100 | 🔴 Critical issues |
| Accounting Compliance | 95/100 | ✅ Excellent |
| Code Architecture | 60/100 | 🟡 Needs work |
| Security | 85/100 | ✅ Good |
| Performance | 70/100 | 🟡 Acceptable |
| Maintainability | 50/100 | 🔴 Technical debt |

## Codebase Metrics

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Total Lines of Code | 98,858 | ~85,000 | 🔴 |
| Average File Size | 249 lines | <200 lines | 🟡 |
| Code in Oversized Files | 62% | <30% | 🔴 |
| Unused Functions | ~10 | 0 | 🟡 |
| Duplicate Code | ~2,500 lines | <500 lines | 🔴 |
| `any` Types | 90 | 0 | 🟡 |

---

## Phase 1: Critical Fixes (Week 1-2) 🔴 HIGHEST PRIORITY

**Status**: 🔄 In Progress (1/4 tasks complete)
**Estimated Effort**: 40 hours
**Impact**: Fixes data integrity - users currently see inconsistent financial data

### 1.1 Unify Balance Calculations
- [ ] Delete `src/lib/calculations.ts` entirely (legacy, doesn't handle advances/loans)
- [ ] Update `src/hooks/firebase-query/useDashboardQueries.ts` to use `client-balance.ts`
- [ ] Add integration test `src/__tests__/balance-consistency.integration.test.ts`
- [ ] Verify all screens show identical balance for same client

**Problem**: 4 different balance calculation implementations showing different values:
- `calculations.ts:13-62` - Legacy, doesn't handle advances/loans, uses plain JS
- `client-balance.ts:193-220` - Current primary implementation
- `useClientsQueries.ts:210-274` - Frontend calculation
- `journalService.ts` - Journal-based for reports

**Files to Modify**:
- DELETE: `src/lib/calculations.ts`
- UPDATE: `src/hooks/firebase-query/useDashboardQueries.ts`
- ADD: `src/__tests__/balance-consistency.integration.test.ts`

### 1.2 Fix Dashboard Arithmetic
- [ ] Replace all `+=` operations with `safeAdd()` in `useDashboardQueries.ts`
- [ ] Lines 143-188: revenue, expenses, discounts accumulation
- [ ] Test: Dashboard totals match Income Statement exactly

**Problem**: Plain JavaScript arithmetic causes floating-point errors:
```typescript
// WRONG: 0.1 + 0.2 = 0.30000000000000004
revenue += entry.amount;

// CORRECT: Use Decimal.js
revenue = safeAdd(revenue, entry.amount);
```

**File**: `src/hooks/firebase-query/useDashboardQueries.ts` (lines 143-188)

### 1.3 Fix Security Issue (WriteOffDialog)
- [x] Change `user.uid` to `user.email || 'system'` in WriteOffDialog.tsx:157 ✅ 2026-02-03

**Problem**: Records wrong user ID for non-owner accountants
**File**: `src/components/ledger/components/WriteOffDialog.tsx:157`
**Status**: ✅ FIXED

### 1.4 Parallelize N+1 Queries
- [ ] Replace sequential `for` loop with `Promise.all()` in LedgerService.ts
- [ ] Test: Transaction deletion with 5+ cheques completes in <500ms

**Problem**: Sequential queries cause 2-3 second delays
**File**: `src/services/ledger/LedgerService.ts` (lines 1558-1581)

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

**Status**: ⏳ Not Started
**Estimated Effort**: 32 hours
**Impact**: ~1,500 lines consolidated, easier maintenance

### 3.1 Create ExcelReportBuilder
- [ ] Create `src/lib/excel/ExcelReportBuilder.ts` with reusable builder pattern
- [ ] Refactor `export-ledger-excel.ts` to use builder
- [ ] Refactor `export-cheques-excel.ts` to use builder
- [ ] Refactor `export-payments-excel.ts` to use builder
- [ ] Refactor `export-inventory-excel.ts` to use builder
- [ ] Refactor `export-reports-excel.ts` to use builder
- [ ] Refactor `export-payroll-excel.ts` to use builder
- [ ] Test: All Excel exports work correctly

**Problem**: 7 files have identical boilerplate (400-500 lines duplicated)

### 3.2 Parameterize Cheque Hooks
- [ ] Create parameterized `useChequesData(type?: 'incoming' | 'outgoing')`
- [ ] Create parameterized `useChequesOperations(type?: 'incoming' | 'outgoing')`
- [ ] Update all consumers to use parameterized hooks
- [ ] Delete `useIncomingChequesData.ts`
- [ ] Delete `useOutgoingChequesData.ts`
- [ ] Delete `useIncomingChequesOperations.ts`
- [ ] Delete `useOutgoingChequesOperations.ts`
- [ ] Test: Incoming and outgoing cheque pages still work

**Problem**: 6 nearly identical hooks with only type filter difference

### 3.3 Centralize Date/Currency Formatting
- [ ] Create `src/lib/formatting.ts` with unified formatters
- [ ] Move date functions from `utils.ts` and `date-utils.ts`
- [ ] Create locale-aware `formatDate(date, locale)`
- [ ] Create unified `formatCurrency(amount, options)`
- [ ] Update all consumers
- [ ] Test: Arabic and English formatting works correctly

**Problem**: Multiple incompatible implementations across files

---

## Phase 4: Architecture Refactoring (Week 5-8) 🟢 MAINTAINABILITY

**Status**: ⏳ Not Started
**Estimated Effort**: 80 hours
**Impact**: Dramatically improved maintainability and testability

### 4.1 Split LedgerService (2,528 lines → 5 services)
- [ ] Create `src/services/ledger/TransactionService.ts` (~400 lines)
- [ ] Create `src/services/ledger/PaymentService.ts` (~400 lines)
- [ ] Create `src/services/ledger/ChequePaymentService.ts` (~400 lines)
- [ ] Create `src/services/ledger/InventoryService.ts` (~300 lines)
- [ ] Refactor `LedgerService.ts` to orchestrator only (~300 lines)
- [ ] Update all imports
- [ ] Test: All ledger operations still work

**Problem**: God object with 25+ methods doing everything

### 4.2 Split useIncomingChequesOperations (1,655 lines → 4 hooks)
- [ ] Create `useChequeSubmission.ts` (~400 lines)
- [ ] Create `useChequeEndorsement.ts` (~400 lines)
- [ ] Create `useChequeReversal.ts` (~300 lines)
- [ ] Create `useChequeFileUpload.ts` (~200 lines)
- [ ] Update consumers
- [ ] Test: All cheque operations work

### 4.3 Split client-detail-page (1,605 lines → 5 components)
- [ ] Create `ClientDetailsCard.tsx` (~200 lines)
- [ ] Create `ClientTransactionsList.tsx` (~300 lines)
- [ ] Create `ClientPaymentsList.tsx` (~300 lines)
- [ ] Create `ClientMetricsPanel.tsx` (~200 lines)
- [ ] Refactor `client-detail-page.tsx` to orchestrator (~200 lines)
- [ ] Test: Client detail page renders correctly

### 4.4 Replace `any` Types (90 instances)
- [ ] Create `src/types/forms.ts` with PaymentFormData, ChequeFormData, etc.
- [ ] Create `src/types/api.ts` with BackupData, ExportOptions, etc.
- [ ] Replace all `any` types with proper interfaces
- [ ] Enable strict TypeScript checks
- [ ] Test: No TypeScript errors

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
| Phase 1: Critical Fixes | 🔄 In Progress | 1/4 tasks | - |
| Phase 2: Dead Code | ✅ Complete | 5/5 tasks | 2026-02-03 |
| Phase 3: Consolidation | ⏳ Not Started | 0/3 tasks | - |
| Phase 4: Architecture | ⏳ Not Started | 0/4 tasks | - |
| Phase 5: Data Integrity | ⏳ Not Started | 0/3 tasks | - |
| Phase 6: Performance | ⏳ Not Started | 0/3 tasks | - |
| Phase 7: Best-in-Class | ⏳ Planned | 0/4 tasks | - |

### Metrics Before/After
| Metric | Before | After Phase 1 | After Phase 2 | After Phase 3 | After Phase 4 | Final |
|--------|--------|---------------|---------------|---------------|---------------|-------|
| Lines of Code | 98,858 | - | - | - | - | ~85,000 |
| Avg File Size | 249 | - | - | - | - | ~180 |
| Duplicate Code | ~2,500 | - | - | - | - | <500 |
| Balance Calcs | 4 | 1 | - | - | - | 1 |
| `any` Types | 90 | - | - | - | 0 | 0 |
| Unused Functions | ~25 | - | ~10 | - | - | 0 |

---

# 🔴 CRITICAL ISSUES (Silent Errors)

## Client Balance Divergence
**Status**: 🔴 Active - Causes incorrect financial display
**Impact**: Users see different balances on different screens
**Resolution**: Phase 1.1

4 different implementations calculate balance differently:
- Legacy `calculations.ts` doesn't handle advances/loans
- Dashboard may show 50,000 IQD while Clients list shows 45,000 IQD

## Floating-Point Arithmetic
**Status**: 🔴 Active - Accumulates errors over time
**Impact**: Dashboard totals may drift from actual values
**Resolution**: Phase 1.2

Dashboard uses `+=` instead of `Decimal.js`, causing precision loss over thousands of transactions.

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
- ✅ 1335 tests passing (50 test suites)
- ✅ 100% pass rate
- ✅ All unit tests and integration tests working

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

**Last Updated**: 2026-02-03
**Last Reviewed**: Comprehensive forensic audit completed

**Change Log**:
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
