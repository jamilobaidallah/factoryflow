# Implement Double-Entry Bookkeeping System

## Problem Summary

The current system uses **single-entry bookkeeping** with category-based tracking. This creates several critical gaps:

| Issue | Impact |
|-------|--------|
| No Chart of Accounts | Cannot properly classify accounts by type |
| No debit/credit enforcement | No self-balancing mechanism |
| COGS doesn't reduce inventory | Asset values incorrect |
| No automatic contra-entries | Manual work, error-prone |
| No Balance Sheet | Cannot show financial position |

## Current State Analysis

**What exists:**
- Category-based ledger entries (income/expense)
- AR/AP tracking with payment allocations
- Inventory with weighted average costing
- Fixed assets with depreciation
- Reports: Income Statement, Trial Balance (approximate), Cash Flow

**What's missing:**
- Formal Chart of Accounts with account codes
- Account types (Asset, Liability, Equity, Revenue, Expense)
- Journal entries with debit/credit pairs
- Automatic contra-entries
- Balance Sheet report
- Self-balancing verification (Debits = Credits)

---

## Design Approach

### Principle: Minimal Disruption

Rather than rebuilding from scratch, we'll **layer double-entry on top** of the existing system:

1. **Add** Chart of Accounts alongside existing categories
2. **Add** Journal Entry layer that creates paired entries
3. **Extend** existing ledger entries with account references
4. **Keep** existing UI flows working (backward compatible)

### Account Type Rules

| Account Type | Normal Balance | Debit Increases | Credit Increases |
|--------------|----------------|-----------------|------------------|
| Asset | Debit | Yes | No |
| Liability | Credit | No | Yes |
| Equity | Credit | No | Yes |
| Revenue | Credit | No | Yes |
| Expense | Debit | Yes | No |

### Standard Chart of Accounts (Arabic)

```
1000-1999: Assets (أصول)
  1000 - Cash (النقدية)
  1100 - Bank (البنك)
  1200 - Accounts Receivable (ذمم مدينة)
  1300 - Inventory (المخزون)
  1400 - Prepaid Expenses (مصاريف مدفوعة مقدماً)
  1500 - Fixed Assets (الأصول الثابتة)
  1510 - Accumulated Depreciation (مجمع الإهلاك) [contra-asset]

2000-2999: Liabilities (التزامات)
  2000 - Accounts Payable (ذمم دائنة)
  2100 - Accrued Expenses (مصاريف مستحقة)
  2200 - Notes Payable (أوراق دفع)

3000-3999: Equity (حقوق الملكية)
  3000 - Owner's Capital (رأس المال)
  3100 - Owner's Drawings (سحوبات المالك)
  3200 - Retained Earnings (الأرباح المحتجزة)

4000-4999: Revenue (الإيرادات)
  4000 - Sales Revenue (إيرادات المبيعات)
  4100 - Service Revenue (إيرادات الخدمات)
  4200 - Other Income (إيرادات أخرى)

5000-5999: Expenses (المصروفات)
  5000 - Cost of Goods Sold (تكلفة البضاعة المباعة)
  5100 - Salaries Expense (مصاريف الرواتب)
  5200 - Rent Expense (مصاريف الإيجار)
  5300 - Utilities Expense (مصاريف المرافق)
  5400 - Depreciation Expense (مصاريف الإهلاك)
  5500 - Other Expenses (مصاريف أخرى)
```

---

## Implementation Plan

### Phase 1: Data Model & Types

- [x] **Task 1.1: Create Account types**
  - File: `src/types/accounting.ts` (new file)
  - Define: `AccountType`, `Account`, `JournalEntry`, `JournalLine`
  - Include account codes, types, normal balances

- [x] **Task 1.2: Create default Chart of Accounts**
  - File: `src/lib/chart-of-accounts.ts` (new file)
  - Default accounts matching Arabic categories
  - Mapping from existing categories to accounts

- [x] **Task 1.3: Add category-to-account mapping**
  - File: `src/lib/account-mapping.ts` (new file)
  - Maps existing categories to new account codes
  - Enables backward compatibility

### Phase 2: Database & Service Layer

- [x] **Task 2.1: Create accounts Firestore collection**
  - Collection: `users/{userId}/accounts`
  - Fields: code, name, nameAr, type, normalBalance, isActive, parentCode
  - Included in journalService.ts

- [x] **Task 2.2: Create journal_entries collection**
  - Collection: `users/{userId}/journal_entries`
  - Fields: entryNumber, date, description, lines[], isPosted, linkedTransactionId
  - Each line: accountCode, debit, credit, description

- [x] **Task 2.3: Create journalService.ts**
  - File: `src/services/journalService.ts` (new file)
  - createJournalEntry() - validates debits = credits
  - reverseJournalEntry() - creates reversing entry
  - getAccountBalance() - sum of debits - credits
  - getTrialBalance() - all account balances
  - getBalanceSheet() - Assets = Liabilities + Equity

- [x] **Task 2.4: Seed default Chart of Accounts**
  - On first use, create default accounts for user
  - Check if accounts collection empty, then seed

### Phase 3: Integration with Existing Flows

- [x] **Task 3.1: Auto-create journal entries for payments**
  - When payment created:
    - Receipt (قبض): DR Cash, CR Accounts Receivable
    - Disbursement (صرف): DR Accounts Payable, CR Cash
  - Modified `usePaymentAllocations.ts`

- [x] **Task 3.2: Auto-create journal entries for ledger entries**
  - Income entry: DR Accounts Receivable, CR Revenue
  - Expense entry: DR Expense, CR Accounts Payable
  - Modified `ledgerService.ts` createSimpleLedgerEntry() and createLedgerEntryWithRelated()

- [x] **Task 3.3: Link COGS to inventory reduction**
  - When inventory exits for sale:
    - DR Cost of Goods Sold
    - CR Inventory
  - Modified handleInventoryUpdateBatch() to return COGS data
  - Journal entry created after batch commit

- [x] **Task 3.4: Auto-create depreciation journal entries**
  - When depreciation recorded:
    - DR Depreciation Expense
    - CR Accumulated Depreciation
  - Modified `useFixedAssetsOperations.ts` runDepreciation()

### Phase 4: Balance Sheet Report

- [x] **Task 4.1: Create useBalanceSheet hook**
  - File: `src/components/reports/hooks/useBalanceSheet.ts`
  - Calculate account balances by type
  - Assets = Liabilities + Equity verification

- [x] **Task 4.2: Create BalanceSheetTab component**
  - File: `src/components/reports/tabs/BalanceSheetTab.tsx`
  - Display: Assets, Liabilities, Equity sections
  - Show verification (balanced or not)
  - Net Income calculated from Revenue - Expenses

- [x] **Task 4.3: Add Balance Sheet to reports page**
  - Added new tab to reports-page.tsx
  - Shows "الميزانية" tab with full balance sheet

### Phase 5: Trial Balance Enhancement

- [ ] **Task 5.1: Update Trial Balance calculation** (Future enhancement)
  - Use journal entries instead of approximation
  - Sum debits and credits by account
  - Show difference if unbalanced

- [ ] **Task 5.2: Add self-balancing verification** (Future enhancement)
  - Display warning if Debits ≠ Credits
  - Show which accounts may have issues

### Phase 6: Testing & Verification

- [x] **Task 6.1: TypeScript compilation**
  - All files compile without errors

- [x] **Task 6.2: Run full test suite**
  - All 986 existing tests pass
  - No regressions introduced

- [x] **Task 6.3: Run production build**
  - Build completes successfully
  - No blocking errors

### Phase 7: Migration (Optional - Future)

- [ ] **Task 7.1: Migration script for existing data**
  - Generate journal entries from existing ledger entries
  - Calculate opening balances
  - One-time migration utility

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/types/accounting.ts` | Account, JournalEntry, JournalLine types |
| `src/lib/chart-of-accounts.ts` | Default CoA with Arabic names |
| `src/lib/account-mapping.ts` | Category → Account mapping |
| `src/services/journalService.ts` | Journal entry CRUD operations |
| `src/components/reports/hooks/useBalanceSheet.ts` | Balance sheet calculations |
| `src/components/reports/tabs/BalanceSheetTab.tsx` | Balance sheet UI |

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/ledgerService.ts` | Add journal entry creation on ledger save |
| `src/components/payments/hooks/usePaymentAllocations.ts` | Add journal entry for payments |
| `src/lib/constants.ts` | Add account-related constants |
| `src/components/reports/reports-page.tsx` | Add Balance Sheet tab |
| `src/components/reports/tabs/TrialBalanceTab.tsx` | Use journal entries for accuracy |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Layer on top, don't replace. All existing flows continue working |
| Data migration complexity | Phase 7 is optional. New entries get journal entries automatically |
| Performance with dual writes | Journal entries are lightweight. Firestore handles scale |
| User confusion | UI changes minimal. Reports improve transparently |

---

## Success Criteria

1. Every financial transaction creates balanced journal entries (Debits = Credits)
2. Balance Sheet report shows accurate Assets, Liabilities, Equity
3. Trial Balance calculated from journal entries, not approximations
4. COGS entries automatically reduce inventory asset
5. All existing tests pass + new accounting tests
6. Existing UI flows unchanged (backward compatible)

---

## Verification Checkpoints

After each phase, verify:
- [ ] TypeScript builds without errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] No console errors in browser
- [ ] Existing functionality still works

---

## Notes

- Journal entries use atomic Firestore transactions (like existing ARAP)
- Account codes follow standard accounting conventions
- Arabic names provided for all accounts
- System remains functional even if journal entries disabled

---

**STOP: Awaiting plan approval before proceeding with implementation.**
