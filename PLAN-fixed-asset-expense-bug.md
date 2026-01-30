# Bug Fix Plan: Fixed Asset Treated as Expense

**Bug**: Fixed asset purchases are incorrectly included in Income Statement expenses, inflating expenses and lowering profitability.

**Status**: IMPLEMENTED ✅

---

## PHASE 1: EXPLORATION & CONTEXT SWEEP

### 1.1 Root Cause Identified

The system has **two parallel accounting pathways**:

| Pathway | Behavior | Status |
|---------|----------|--------|
| **Journal Entry System** | Uses `isFixedAssetCategory()` to route to Balance Sheet account 1500 | CORRECT |
| **P&L Reporting System** | Checks `entry.type === "مصروف"` and includes ALL in expenses | **BUG** |

**Why it happens:**
- In `ledger-constants.ts:133-141`, fixed assets category is defined with `type: "مصروف"` because they require cash outflow
- But fixed assets are **CapEx** (capital expenditure), not **OpEx** (operating expense)
- They should NOT appear on the Income Statement

### 1.2 Files Affected

| File | Role | Change Needed |
|------|------|---------------|
| `src/components/ledger/utils/ledger-helpers.ts` | P&L exclusion helpers | ADD `isFixedAssetTransaction()` |
| `src/components/reports/hooks/useReportsCalculations.ts` | Income statement calc | EXCLUDE fixed assets |
| `src/lib/client-balance.ts` | Client/supplier balances | **NO CHANGE** |
| `src/lib/account-mapping.ts` | Journal routing | **NO CHANGE** (already correct) |

### 1.3 Key Clarifications from Discussion

**Q: What about fixed assets bought on credit with post-dated cheques?**

**A: Per IAS 16 and best accounting practices:**
- Asset is recognized at **FULL COST** when control transfers (when you receive it)
- Payment method (cash, credit, PDC) does NOT affect asset recognition
- Supplier balance should still show full amount owed
- PDCs are tracked separately until maturity

**What this means for the fix:**
- `client-balance.ts` must NOT be changed - supplier balances are correct
- Only P&L calculation needs fixing
- Journal entries are already correct (DR Fixed Assets, CR AP/Cash)

---

## PHASE 2: THE FIX

### Step 1: Add Helper Function

**File:** `src/components/ledger/utils/ledger-helpers.ts`

```typescript
/**
 * Fixed asset category constant
 */
export const FIXED_ASSET_CATEGORY = 'أصول ثابتة';

/**
 * Check if a transaction is a fixed asset purchase
 * Fixed assets are Balance Sheet items (CapEx), NOT Income Statement expenses (OpEx)
 *
 * @param category - Transaction category
 * @returns true if this is a fixed asset transaction
 */
export function isFixedAssetTransaction(category?: string): boolean {
  return category === FIXED_ASSET_CATEGORY;
}
```

### Step 2: Update P&L Exclusion Helper

**File:** `src/components/ledger/utils/ledger-helpers.ts`

Update `isExcludedFromPL()` to include fixed assets:

```typescript
export function isExcludedFromPL(type?: string, category?: string): boolean {
  return isEquityTransaction(type, category) ||
         isAdvanceTransaction(category) ||
         isLoanTransaction(type, category) ||
         isFixedAssetTransaction(category);  // NEW
}
```

### Step 3: Update Income Statement Calculation

**File:** `src/components/reports/hooks/useReportsCalculations.ts`

Import and use the updated helper:

```typescript
import {
  isEquityTransaction,
  isAdvanceTransaction,
  isLoanTransaction,
  isFixedAssetTransaction,  // NEW
  // ... other imports
} from "@/components/ledger/utils/ledger-helpers";

// In incomeStatement useMemo:
ledgerEntries.forEach((entry) => {
  // EXCLUDE non-P&L transactions
  if (isEquityTransaction(entry.type, entry.category) ||
      isAdvanceTransaction(entry.category) ||
      isLoanTransaction(entry.type, entry.category) ||
      isFixedAssetTransaction(entry.category)) {  // NEW
    return; // Skip from P&L
  }
  // ... rest of calculation
});
```

---

## PHASE 3: VERIFICATION

### 3.1 Unit Tests to Add

**File:** `src/components/reports/hooks/__tests__/useReportsCalculations.test.ts`

```typescript
describe('Fixed Asset Exclusion from P&L', () => {
  it('should exclude fixed asset purchases from income statement expenses', () => {
    const entries = [{
      id: '1',
      transactionId: 'TX-001',
      description: 'شراء ماكينة',
      type: 'مصروف',
      category: 'أصول ثابتة',
      subCategory: 'معدات وآلات',
      amount: 50000,
      associatedParty: 'مورد المعدات',
      date: new Date(),
    }];

    const { result } = renderHook(() => useReportsCalculations({
      ledgerEntries: entries,
      payments: [],
      inventory: [],
      fixedAssets: [],
    }));

    expect(result.current.incomeStatement.totalExpenses).toBe(0);
  });

  it('should still include small equipment in expenses (not fixed assets)', () => {
    const entries = [{
      id: '1',
      transactionId: 'TX-001',
      description: 'أدوات صغيرة',
      type: 'مصروف',
      category: 'مصاريف تشغيلية',
      subCategory: 'أدوات ومعدات صغيرة',
      amount: 500,
      associatedParty: '',
      date: new Date(),
    }];

    const { result } = renderHook(() => useReportsCalculations({
      ledgerEntries: entries,
      payments: [],
      inventory: [],
      fixedAssets: [],
    }));

    expect(result.current.incomeStatement.totalExpenses).toBe(500);
  });
});
```

### 3.2 Manual Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| Fixed asset cash purchase | NOT in P&L expenses, supplier balance = 0 |
| Fixed asset on credit | NOT in P&L expenses, supplier balance = full amount |
| Fixed asset with PDC | NOT in P&L expenses, supplier balance = full amount, PDCs tracked |
| Small equipment purchase | IN P&L expenses (correct - it's OpEx) |
| Regular expense | IN P&L expenses (unchanged behavior) |

### 3.3 What Should NOT Change

- Supplier balances for fixed asset purchases (they're still owed money)
- Cash flow (payments still recorded when made)
- Journal entries (already correct)
- Balance Sheet (fixed assets shown correctly)

---

## PHASE 4: EDGE CASES

| Edge Case | Risk | Mitigation |
|-----------|------|------------|
| Small equipment (أدوات ومعدات صغيرة) | Could be confused with fixed assets | Check exact category `'أصول ثابتة'`, not pattern match |
| Fixed asset with supplier | Might incorrectly exclude from supplier balance | Only fix P&L, NOT client-balance.ts |
| Historical data | Old reports will now show different (correct) values | Expected - document this |

---

## IMPLEMENTATION CHECKLIST

- [x] Plan reviewed and approved by user
- [x] Implementation matches IAS 16 / GAAP standards
- [x] No changes to client/supplier balance calculation
- [x] Tests cover all scenarios (5 new tests added)
- [x] Self-review completed before marking done
- [x] All 1335 tests pass
- [x] Lint passes (no new errors)

---

## DEPRECIATION INVESTIGATION

### How Depreciation Works (CORRECTLY)

**Monthly depreciation run creates:**

1. **Ledger Entry** (lines 306-319 in `useFixedAssetsOperations.ts`):
   ```
   type: "مصروف"
   category: "مصاريف تشغيلية"      ← NOT "أصول ثابتة"
   subCategory: "استهلاك أصول ثابتة"
   ```

2. **Journal Entry** (lines 349-365):
   ```
   DR: Depreciation Expense (5400) - مصاريف الإهلاك
   CR: Accumulated Depreciation (1510) - مجمع الإهلاك
   ```

### Key Finding: Depreciation is CORRECTLY Treated

| Aspect | Status | Reason |
|--------|--------|--------|
| Ledger entry category | `"مصاريف تشغيلية"` | NOT `"أصول ثابتة"` - so it WILL be included in P&L |
| Journal entry | DR 5400, CR 1510 | Correct double-entry |
| P&L impact | Included as expense | Reduces net profit (correct) |
| Balance Sheet impact | Reduces fixed asset value | Via contra-asset 1510 |

### Why This Matters for Our Fix

Our fix to exclude `category === "أصول ثابتة"` will:
- ✅ Exclude fixed asset PURCHASES from P&L (correct - CapEx)
- ✅ Still include depreciation EXPENSE in P&L (correct - OpEx)

**The depreciation ledger entry uses `category: "مصاريف تشغيلية"`, NOT `"أصول ثابتة"`**, so it will correctly remain in the Income Statement expenses.

### Summary

| Transaction Type | Category | In P&L? | Correct? |
|------------------|----------|---------|----------|
| Fixed asset purchase | `أصول ثابتة` | Currently YES → Should be NO | BUG (our fix) |
| Depreciation expense | `مصاريف تشغيلية` | YES | ✅ Correct |
| Small equipment | `مصاريف تشغيلية` | YES | ✅ Correct |

---

**Last Updated:** Implementation complete

---

## IMPLEMENTATION SUMMARY

### Files Changed:

1. **`src/components/ledger/utils/ledger-helpers.ts`**
   - Added `FIXED_ASSET_CATEGORY` constant
   - Added `isFixedAssetTransaction()` helper function
   - Updated `isExcludedFromPL()` to include fixed asset check

2. **`src/components/reports/hooks/useReportsCalculations.ts`**
   - Imported `isFixedAssetTransaction` helper
   - Updated income statement calculation to exclude fixed assets

3. **`src/components/reports/hooks/__tests__/useReportsCalculations.test.ts`**
   - Added 5 new tests for fixed asset P&L exclusion:
     - Exclude fixed asset purchases from expenses
     - Include depreciation expense (different category)
     - Include small equipment (below capitalization threshold)
     - Correct profit calculation with mixed transactions
     - Category breakdown excludes fixed assets

### Test Results:
- All 1335 tests pass
- 5 new tests specifically for the fix
- No lint errors introduced
