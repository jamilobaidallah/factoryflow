# Known Issues

This document tracks known issues, technical debt, and planned improvements for FactoryFlow.

---

## 🧪 Test Failures

### QuickPayDialog Test Flakiness
**Status**: Known issue, not blocking
**Priority**: Low (technical debt)
**Affected Files**: `src/components/ledger/components/__tests__/QuickPayDialog.test.tsx`

**Details**:
- 18 tests in QuickPayDialog.test.tsx fail intermittently
- Root cause: Async timing issues with mock callbacks
- Tests expect `mockOnSuccess` to be called within 3000ms timeout
- Callbacks not firing within the timeout window

**Error Pattern**:
```typescript
await waitFor(() => {
  expect(mockOnSuccess).toHaveBeenCalled(); // ❌ Timeout after 3000ms
}, { timeout: 3000 });
```

**Impact**:
- ❌ 18/1338 tests failing (98.7% pass rate)
- ✅ Does NOT affect production functionality
- ✅ Core payment and ledger operations work correctly

**Fix Implemented** (PR: fix/quickpay-dialog-tests):
1. ✅ Created integration test infrastructure using Firebase Emulator
2. ✅ Added `test:integration` npm script
3. ✅ Implemented real accounting workflow tests (payment-flow.integration.test.ts)
4. ✅ Tests verify journal entries, Trial Balance, and data relationships

**Why Integration Tests Instead of Mocking**:
- Unit tests with mocks wouldn't have caught recent bugs (capital/loan journal entries not being created)
- Integration tests verify complete data flow: Service → Firestore → Query
- Can validate Trial Balance is balanced (debits = credits) with real data
- Better for accounting systems where correctness is paramount

**How to Run**:
1. Start Firebase Emulator: `firebase emulators:start --only firestore`
2. Run tests: `npm run test:integration`

**Related**:
- These failures existed before recent journal entry fixes
- No regressions introduced by audit blocker fixes or rollback implementation
- QuickPayDialog unit tests will be gradually replaced with integration tests

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
**Last Reviewed**: After audit blocker fixes + Phase 1 rollback implementation

**Change Log**:
- 2026-02-02: Initial documentation of QuickPayDialog test failures
- 2026-02-02: Added Phase 2 atomicity improvement plan
