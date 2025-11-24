# Owner Equity Accounting Fix

## Problem Identified

The application was incorrectly counting owner investments and withdrawals as profit/loss, which is a critical accounting error.

### Before the Fix:
```
Profit = All Credits (دخل) - All Debits (مصروف)
```

This meant:
- ❌ Owner Investment → counted as PROFIT (incorrect!)
- ❌ Owner Withdrawal → counted as EXPENSE (incorrect!)

---

## Solution Implemented

Modified the system to **exclude owner equity transactions** from profit/loss calculations and display them separately.

### Changes Made:

#### 1. Reports Page (`src/components/reports/reports-page.tsx`)

**Added new function:**
```typescript
const calculateOwnerEquity = () => {
  let ownerInvestments = 0;
  let ownerWithdrawals = 0;

  ledgerEntries.forEach((entry) => {
    if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
      if (entry.type === "دخل") {
        ownerInvestments += entry.amount;
      } else if (entry.type === "مصروف") {
        ownerWithdrawals += entry.amount;
      }
    }
  });

  const netOwnerEquity = ownerInvestments - ownerWithdrawals;

  return {
    ownerInvestments,
    ownerWithdrawals,
    netOwnerEquity,
  };
};
```

**Modified income statement calculation:**
```typescript
const calculateIncomeStatement = () => {
  let totalRevenue = 0;
  let totalExpenses = 0;

  ledgerEntries.forEach((entry) => {
    // EXCLUDE owner equity transactions from profit/loss
    if (entry.category === "رأس المال" || entry.category === "Owner Equity") {
      return; // Skip owner equity transactions
    }

    // Rest of the calculation...
  });
}
```

**Added Owner Equity Display Section:**
- Blue highlighted section showing:
  - Owner Investments (استثمارات المالك)
  - Owner Withdrawals (سحوبات المالك)
  - Net Owner Equity (صافي رأس المال)
- Clear note: "ⓘ رأس المال لا يُحتسب ضمن الأرباح أو الخسائر التشغيلية"

#### 2. Dashboard Page (`src/components/dashboard/dashboard-page.tsx`)

**Modified revenue/expense calculation:**
```typescript
// Calculate totals (EXCLUDE owner equity from P&L)
const isOwnerEquity = entry.category === "رأس المال" || entry.category === "Owner Equity";

if (!isOwnerEquity) {
  if (entry.type === "دخل" || entry.type === "إيراد") {
    revenue += entry.amount;
    // ...
  } else if (entry.type === "مصروف") {
    expenses += entry.amount;
    // ...
  }
}
```

---

## How to Use

### Entering Owner Transactions

#### Owner Investment (استثمار المالك):
```
نوع الحركة:       دائن (CREDIT)
الفئة:            رأس المال          ← CRITICAL!
الفئة الفرعية:     استثمار مالك
اسم الشخص:        جميل - مالك
المبلغ:           50000
تسوية فورية:      ✅ YES
الوصف:           استثمار المالك في الشركة
```

#### Owner Withdrawal (سحب المالك):
```
نوع الحركة:       مدين (DEBIT)
الفئة:            رأس المال          ← CRITICAL!
الفئة الفرعية:     سحب مالك
اسم الشخص:        جميل - مالك
المبلغ:           10000
تسوية فورية:      ✅ YES
الوصف:           سحب شخصي من المالك
```

### Key Rule:
**ALWAYS use "رأس المال" as the category for owner equity transactions!**

This is the ONLY category that will be excluded from profit/loss calculations.

---

## What Changed

### Before:
| Transaction | Treatment | Effect on Profit |
|------------|-----------|------------------|
| Owner invests 50,000 | Counted as revenue | ❌ Profit +50,000 (wrong!) |
| Owner withdraws 10,000 | Counted as expense | ❌ Profit -10,000 (wrong!) |
| **Operating Profit** | 20,000 actual | **60,000 shown** (wrong!) |

### After:
| Transaction | Treatment | Effect on Profit |
|------------|-----------|------------------|
| Owner invests 50,000 | Excluded from P&L | ✅ No effect on profit |
| Owner withdraws 10,000 | Excluded from P&L | ✅ No effect on profit |
| **Operating Profit** | 20,000 actual | **20,000 shown** (correct!) |
| **Owner Equity** | Shown separately | Net: +40,000 |

---

## Reports Display

The Reports page now shows TWO separate sections:

### 1. Operating Profit/Loss (قائمة الدخل)
- Total Revenue (إجمالي الإيرادات)
- Total Expenses (إجمالي المصروفات)
- **Net Profit (صافي الربح)** ← Operating profit ONLY
- Profit Margin (هامش الربح)

### 2. Owner Equity (رأس المال)
Displayed in a blue highlighted box:
- Owner Investments (استثمارات المالك)
- Owner Withdrawals (سحوبات المالك)
- Net Owner Equity (صافي رأس المال)

This section ONLY appears if there are owner equity transactions.

---

## Dashboard Changes

The Dashboard cards now show:
- **Revenue** → Operating revenue ONLY (excludes owner investments)
- **Expenses** → Operating expenses ONLY (excludes owner withdrawals)
- **Net Profit** → Operating profit ONLY (correct calculation)

Monthly charts also exclude owner equity transactions.

---

## Important Notes

### Category Names
The system recognizes these category names as owner equity:
- `رأس المال` (Arabic)
- `Owner Equity` (English)

Use either name consistently.

### Instant Settlement
Always check "Instant Settlement" (تسوية فورية) for owner transactions because:
- ✅ Cash actually moves (in or out) immediately
- ✅ There's no "payment due later"
- ✅ Transaction completes immediately

### Why This Matters
**Owner equity is NOT profit:**
- Owner putting money IN ≠ Earning money
- Owner taking money OUT ≠ Spending money
- These are **capital transactions**, not **operating activities**

**Proper accounting separates:**
1. **Operating Profit** = Revenue - Expenses (business performance)
2. **Owner Equity** = Investments - Withdrawals (owner's capital)

---

## Verification

To verify the fix is working:

1. **Add an owner investment** (category: رأس المال)
2. **Check Dashboard** → Profit should NOT increase
3. **Check Reports** → Should show in separate "رأس المال" section
4. **Check Operating Profit** → Should only reflect business operations

---

## Summary

✅ Owner equity transactions now excluded from profit/loss
✅ Separate Owner Equity section in Reports
✅ Dashboard shows correct operating profit
✅ Monthly charts exclude owner equity
✅ Clear visual indication that owner equity is separate

**The accounting is now correct!**

---

## Files Modified

1. `src/components/reports/reports-page.tsx`
   - Added `calculateOwnerEquity()` function
   - Modified `calculateIncomeStatement()` to exclude owner equity
   - Added Owner Equity display section

2. `src/components/dashboard/dashboard-page.tsx`
   - Modified revenue/expense calculation to exclude owner equity
   - Updated monthly aggregation logic

---

**Status: ✅ FIXED**
**Date: 2025-11-22**
