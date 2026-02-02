# Known Issues

This document tracks known issues, technical debt, and planned improvements for FactoryFlow.

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

**Last Updated**: 2026-02-02
**Last Reviewed**: After test fixes - all tests now passing

**Change Log**:
- 2026-02-02: Fixed all 18 failing tests by adding proper service mocks
- 2026-02-02: Added Firebase Emulator integration test infrastructure
- 2026-02-02: Initial documentation of QuickPayDialog test failures
- 2026-02-02: Added Phase 2 atomicity improvement plan
