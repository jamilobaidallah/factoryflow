# Endorsed Cheques - Client Page Testing & Bug Report

## Summary

After thorough analysis of the client page components and endorsed cheques implementation, I've identified **10 bugs** (6 display bugs + 4 calculation bugs) and created **18 test scenarios** for Vercel testing.

---

## Bugs Found

### BUG 1: Cheque Status Display Uses Wrong Value (HIGH PRIORITY)
**Location**: [client-detail-page.tsx:786](src/components/clients/client-detail-page.tsx#L786)

**Issue**: The cheques tab uses `"معلق"` (display label) instead of `"قيد الانتظار"` (database value) for pending status check.

```typescript
// Current (WRONG - line 786-788):
cheque.status === "معلق"       // Should be "قيد الانتظار"
cheque.status === "مصروف"      // Should be "تم الصرف"

// From constants.ts:
CHEQUE_STATUS_AR.PENDING = 'قيد الانتظار'  // Database value
CHEQUE_STATUS_AR.CASHED = 'تم الصرف'       // Database value
CHEQUE_STATUS_LABELS.pending = 'معلق'       // Display label only
```

**Impact**:
- Pending cheques won't show yellow highlighting - they appear gray
- Cashed cheques won't show green highlighting - they appear gray

---

### BUG 2: Endorsed Cheques Missing Purple Status Badge
**Location**: [client-detail-page.tsx:783-795](src/components/clients/client-detail-page.tsx#L783-L795)

**Issue**: The status badge only handles "معلق" and "مصروف". Endorsed cheques (status: "مجيّر") should have purple styling as defined in constants (`STATUS_COLORS.ENDORSED`).

**Current code**:
```typescript
cheque.status === "معلق"
  ? "bg-yellow-100 text-yellow-800"
  : cheque.status === "مصروف"
  ? "bg-green-100 text-green-800"
  : "bg-gray-100 text-gray-800"  // Endorsed cheques fall here!
```

**Missing condition**:
```typescript
cheque.status === "مجيّر" ? "bg-purple-100 text-purple-800"
```

---

### BUG 3: Endorsed Status Info Not Visible in Cheques Tab
**Location**: [client-detail-page.tsx:751-806](src/components/clients/client-detail-page.tsx#L751-L806)

**Issue**: When a cheque is endorsed, there's no visual indication of:
- Who it was endorsed to (`endorsedTo` field)
- When it was endorsed (`endorsedDate` field)
- That it's an endorsed cheque type

The table only shows the status badge but doesn't display endorsement details.

---

### BUG 4: Cheque Interface Missing Endorsement Fields
**Location**: [client-detail-page.tsx:98-108](src/components/clients/client-detail-page.tsx#L98-L108)

**Issue**: The local `Cheque` interface is incomplete:

```typescript
// Current interface (missing fields):
interface Cheque {
  id: string;
  chequeNumber: string;
  amount: number;
  issueDate: Date;
  dueDate?: Date;
  bankName: string;
  status: string;
  type: string;
  associatedParty?: string;
}

// Missing fields needed for endorsed cheques:
// - endorsedTo?: string;
// - endorsedDate?: Date;
// - chequeType?: string;  // "عادي" or "مجير"
// - isEndorsedCheque?: boolean;
// - endorsedFromId?: string;
```

**Impact**: TypeScript won't catch access to these fields, and UI can't display endorsement info.

---

### BUG 5: Statement Doesn't Distinguish Endorsement Payments
**Location**: [client-detail-page.tsx:872-891](src/components/clients/client-detail-page.tsx#L872-L891)

**Issue**: Endorsement payments appear as regular payments in the statement. While the notes field contains "تظهير شيك رقم X للمورد: Y", there's no visual differentiation (like a special badge or icon) to distinguish endorsement-based settlements from actual cash payments.

**User confusion**: Users might think this was a cash payment when it was actually a cheque endorsement (no cash movement occurred).

The payment interface loaded in client-detail-page also lacks the endorsement flags:
```typescript
// Missing from Payment interface:
// - isEndorsement?: boolean;
// - noCashMovement?: boolean;
// - endorsementChequeId?: string;
```

---

### BUG 6: Client Advances May Appear Confusing in Statement
**Location**: Statement tab aggregation logic

**Issue**: When a cheque is endorsed with unallocated amount (cheque value > client's debt), a client advance (سلفة عميل) is created as type "مصروف" (expense). This appears in the statement as:
- A regular expense row
- No indication it originated from an endorsement
- Category "سلفة عميل" may confuse users

---

## CALCULATION BUGS (Critical)

### BUG 7: Client Advance (سلفة عميل) Incorrectly Counted as Purchase (HIGH PRIORITY)
**Location**: [client-detail-page.tsx:236-240](src/components/clients/client-detail-page.tsx#L236-L240)

**Issue**: The code counts ALL "مصروف" type entries as purchases:
```typescript
if (entry.type === "دخل" || entry.type === "إيراد") {
  sales += entry.amount;
} else if (entry.type === "مصروف") {
  purchases += entry.amount;  // ❌ Includes سلفة عميل!
}
```

**Problem**: When endorsement creates a سلفة عميل (client advance), it's type "مصروف" with category "سلفة عميل". This is NOT a purchase - it's money we owe the client (a liability).

**Impact on Balance Calculation**:
```typescript
// Line 352:
balance = totalSales - totalPurchases - (totalPaymentsReceived - totalPaymentsMade) - totalDiscounts - totalWriteoffs
```

If client has:
- Sale: 500
- Endorsement payment: 800 (creates سلفة عميل of 300)

**Current (WRONG)**:
```
totalSales = 500
totalPurchases = 300 (سلفة عميل counted as purchase!)
totalPaymentsReceived = 800
Balance = 500 - 300 - 800 = -600 له  ❌ WRONG!
```

**Correct**:
```
totalSales = 500
totalPurchases = 0 (سلفة عميل should NOT be counted)
totalPaymentsReceived = 800
Balance = 500 - 0 - 800 = -300 له  ✓ Correct!
```

**Fix needed**: Exclude سلفة عميل and سلفة مورد from purchases calculation:
```typescript
else if (entry.type === "مصروف" && entry.category !== "سلفة عميل") {
  purchases += entry.amount;
}
```

---

### BUG 8: Export Functions Missing Discounts and Writeoffs
**Location**: [client-detail-page.tsx:360-378](src/components/clients/client-detail-page.tsx#L360-L378)

**Issue**: The Excel/PDF export functions only include:
- Invoice amounts (debit/credit based on type)
- Payment amounts

But they DON'T include:
- `totalDiscount` from ledger entries (خصم تسوية)
- `writeoffAmount` from ledger entries (ديون معدومة)

**The statement tab correctly shows these** (lines 847-866):
```typescript
// Row 2: Discount from ledger entry
if (e.totalDiscount && e.totalDiscount > 0) {
  rows.push({ ... credit: e.totalDiscount ... });
}
// Row 3: Writeoff from ledger entry
if (e.writeoffAmount && e.writeoffAmount > 0) {
  rows.push({ ... credit: e.writeoffAmount ... });
}
```

**Impact**: Exported statement will show DIFFERENT totals than on-screen statement.

---

### BUG 9: Export "Balance After Cheques" Uses Wrong Formula
**Location**: [client-detail-page.tsx:416](src/components/clients/client-detail-page.tsx#L416)

**Issue**: Export uses simplified formula:
```typescript
expectedBalanceAfterCheques: runningBalance - totalPendingCheques
```

This subtracts ALL pending cheques, but doesn't consider cheque TYPE!

**Statement tab correctly handles this** (line 1193):
```typescript
const balanceAfterCheques = finalBalance - incomingTotal + outgoingTotal;
```

**Example**:
- Current balance: 1000 عليه
- Pending incoming (وارد): 600
- Pending outgoing (صادر): 200

**Export (WRONG)**: 1000 - (600 + 200) = 200 عليه
**Statement (CORRECT)**: 1000 - 600 + 200 = 600 عليه

---

### BUG 10: Supplier Advance (سلفة مورد) May Incorrectly Affect Client Balance
**Location**: [client-detail-page.tsx:236-240](src/components/clients/client-detail-page.tsx#L236-L240)

**Issue**: When endorsing a cheque, a سلفة مورد entry is created with:
- `type: "دخل"` (income)
- `associatedParty: supplierName`

If the supplier is ALSO a client in the system, this entry would be fetched for the supplier's client page and counted as a SALE, which is incorrect.

**This is an edge case** but worth testing if suppliers can also be clients.

---

## Vercel Test Scenarios

### Test 1: Cheque Status Colors in Client Page
**Purpose**: Verify Bug 1 & 2 - status badges show correct colors

**Steps**:
1. Create client "Test Client A"
2. Add cheques with different statuses via Cheques page:
   - One pending cheque (قيد الانتظار)
   - One cashed cheque (تم الصرف)
   - One endorsed cheque (مجيّر)
   - One bounced cheque (مرفوض)
3. Navigate to Client A's page → Cheques tab
4. Observe status badge colors

**Expected Results**:
| Status | Expected Color | From Constants |
|--------|---------------|----------------|
| قيد الانتظار | Yellow | bg-yellow-100 |
| تم الصرف | Green | bg-green-100 |
| مجيّر | Purple | bg-purple-100 |
| مرفوض | Red | bg-red-100 |

**Actual Results**:
- [ ] Pending shows YELLOW
- [ ] Cashed shows GREEN
- [ ] Endorsed shows PURPLE
- [ ] Bounced shows RED

**Known Issue**: Due to Bug 1, pending/cashed will likely show gray.

---

### Test 2: Basic Endorsement Effect on Client Balance
**Purpose**: Verify endorsement correctly reduces client's receivable

**Setup**:
1. Create client "Client B" with balance 0
2. Create a sale (دخل) entry for 1000 JOD linked to Client B
3. Add incoming cheque for 1000 JOD from Client B, linked to the sale's transaction ID

**Before Endorsement**:
- [ ] Client balance = 1000 عليه (client owes us)

**Steps**:
1. Go to Cheques page
2. Endorse the cheque to "Supplier X" with a transaction ID
3. Return to Client B's page

**Expected After Endorsement**:
- [ ] Client balance = 0 (مسدد) or close to 0
- [ ] Statement tab shows a قبض (receipt) payment entry
- [ ] Payment description mentions "تظهير شيك رقم..."
- [ ] The receipt appears in دائن (credit) column
- [ ] Cheques tab shows status "مجيّر" for the cheque

**Document Actual Results**: ____________________

---

### Test 3: Endorsement Payment in Statement Tab
**Purpose**: Verify endorsement creates payment entry visible in statement

**Steps**:
1. Using Client B from Test 2 (after endorsement)
2. Go to Statement tab (كشف الحساب)
3. Find the endorsement payment entry

**Expected**:
- [ ] Payment row exists with badge "دفعة"
- [ ] Description shows endorsement info from notes
- [ ] Amount appears in دائن column
- [ ] Running balance decreases after this entry
- [ ] Clicking row opens detail modal

**Check**:
- [ ] Can you distinguish this from a regular cash payment? (Bug 5)

---

### Test 4: Pending Cheques Section After Endorsement
**Purpose**: Verify endorsed cheques are removed from pending section

**Setup**:
1. Create client "Client C"
2. Add 2 pending incoming cheques: 500 JOD each

**Before Endorsement**:
- [ ] Statement tab shows "شيكات قيد الانتظار" section
- [ ] Shows 2 cheques totaling 1000 JOD
- [ ] "الرصيد المتوقع بعد صرف الشيكات" is calculated

**Steps**:
1. Endorse one of the cheques
2. Return to Client C's page → Statement tab

**Expected After**:
- [ ] Pending section now shows only 1 cheque (500 JOD)
- [ ] The endorsed cheque is NOT in pending section
- [ ] Expected balance recalculated with only 1 pending cheque

---

### Test 5: Multi-Allocation Endorsement with Client Advance
**Purpose**: Test when cheque value exceeds client's total debt

**Setup**:
1. Create client "Client D" with balance 0
2. Create ONE sale entry for 500 JOD
3. Add incoming cheque for 800 JOD from Client D

**Client debt = 500, Cheque = 800, Unallocated = 300**

**Steps**:
1. Go to Cheques page
2. Click endorse on the cheque
3. Use multi-allocation dialog
4. Allocate 500 to the client's sale
5. Remaining 300 should create "سلفة عميل"
6. Complete endorsement
7. Check Client D's page

**Expected**:
- [ ] Statement shows receipt payment of 800
- [ ] Balance calculation: 500 (sale) - 800 (payment) = -300 له
- [ ] A new ledger entry "سلفة عميل" may appear (type: مصروف)
- [ ] Ledger tab shows the advance entry

---

### Test 6: Cancel Endorsement Effect
**Purpose**: Verify canceling endorsement reverts all changes

**Setup**: Use Client B from Test 2 (has endorsed cheque)

**Before Cancel**:
- [ ] Note current balance (should be 0 or near 0)
- [ ] Note payment count in Statement

**Steps**:
1. Go to Cheques page
2. Find the endorsed cheque
3. Click "إلغاء التظهير"
4. Confirm cancellation
5. Return to Client B's page

**Expected After Cancel**:
- [ ] Balance reverts to 1000 عليه
- [ ] The قبض payment is REMOVED from statement
- [ ] Cheques tab shows status back to "قيد الانتظار"
- [ ] Pending cheques section includes this cheque again

---

### Test 7: Balance After Postdated Cheques Calculation
**Purpose**: Verify mixed incoming/outgoing cheques calculate correctly

**Setup**:
1. Client has current balance: 2000 عليه
2. 2 pending incoming cheques (وارد): 500 JOD each
3. 1 pending outgoing cheque (صادر): 300 JOD

**Steps**:
1. Go to client's Statement tab
2. Check "الرصيد المتوقع بعد صرف الشيكات"

**Expected Calculation**:
```
Current balance: 2000 عليه
- Incoming cheques: -500 -500 = -1000 (we receive money)
+ Outgoing cheques: +300 (we pay money)
= Expected balance: 1300 عليه
```

- [ ] Displayed value matches: 1300 عليه

---

### Test 8: Statement Date Filter with Endorsement
**Purpose**: Verify date filtering handles endorsement payments correctly

**Setup**:
1. Client has endorsement payment dated December 15, 2024
2. Client has regular sale dated December 5, 2024

**Test A - Filter BEFORE endorsement date**:
- Filter: From 01/12/2024 To 10/12/2024
- [ ] Endorsement payment NOT in transactions list
- [ ] Only the Dec 5 sale appears
- [ ] Balance should not include the endorsement effect

**Test B - Filter AFTER endorsement date**:
- Filter: From 16/12/2024 To 31/12/2024
- [ ] Opening balance INCLUDES the endorsement effect (calculated from prior transactions)
- [ ] Transactions list is empty (no transactions in this range)

---

### Test 9: Export with Endorsement Payments
**Purpose**: Verify exports include endorsement data correctly

**Setup**: Client with:
- Regular cash payment
- Endorsement payment
- Pending cheques

**Steps**:
1. Click Excel export button
2. Check downloaded file
3. Click PDF export button
4. Check downloaded file

**Expected in Both**:
- [ ] Both payments appear in transactions list
- [ ] Endorsement payment shows its description
- [ ] Pending cheques section included
- [ ] Final balance correct

---

### Test 10: Endorsed Cheque Details in Cheques Tab
**Purpose**: Test if endorsement info is visible (Bug 3)

**Setup**: Client with one endorsed cheque

**Steps**:
1. Go to client's Cheques tab
2. Find the endorsed cheque row
3. Check what information is displayed

**Expected** (if bug is fixed):
- [ ] Status shows "مجيّر" with purple badge
- [ ] "Endorsed to: [Supplier Name]" is visible
- [ ] Endorsement date is visible

**Actual** (with current bugs):
- Status likely shows gray
- No endorsement info visible
- Only basic cheque data shown

---

## Quick Fixes Summary

### Fix Bug 1 & 2 (High Priority):
In [client-detail-page.tsx:783-795](src/components/clients/client-detail-page.tsx#L783-L795), replace:

```typescript
// FROM:
cheque.status === "معلق"
  ? "bg-yellow-100 text-yellow-800"
  : cheque.status === "مصروف"
  ? "bg-green-100 text-green-800"
  : "bg-gray-100 text-gray-800"

// TO:
cheque.status === "قيد الانتظار"
  ? "bg-yellow-100 text-yellow-800"
  : cheque.status === "تم الصرف"
  ? "bg-green-100 text-green-800"
  : cheque.status === "مجيّر"
  ? "bg-purple-100 text-purple-800"
  : cheque.status === "مرفوض"
  ? "bg-red-100 text-red-800"
  : "bg-gray-100 text-gray-800"
```

### Fix Bug 4 (Update Cheque Interface):
Add missing fields to the Cheque interface in client-detail-page.tsx.

### Fix Bug 3 (Show Endorsement Info):
Add conditional display in cheques table when `cheque.endorsedTo` exists.

---

## Status Values Reference

| Status | Database Value | Display Label | Color |
|--------|---------------|---------------|-------|
| Pending | قيد الانتظار | معلق | Yellow |
| Cashed | تم الصرف | تم الصرف | Green |
| Endorsed | مجيّر | مظهر | Purple |
| Bounced | مرفوض | مرفوض | Red |
| Returned | مرتجع | مرتجع | Orange |
| Cancelled | ملغي | ملغي | Gray |

---

---

## NUMERIC CALCULATION TESTS

These tests verify exact numbers to catch calculation bugs.

### Numeric Test A: Balance Calculation Formula Verification

**Purpose**: Verify the balance formula correctly handles endorsed cheques

**Formula under test** (line 341):
```typescript
balance = totalSales - totalPurchases - (totalPaymentsReceived - totalPaymentsMade) - totalDiscounts - totalWriteoffs
```

**Setup - Create exact data**:
| Entry | Type | Amount |
|-------|------|--------|
| Sale 1 | دخل | 1,000 |
| Sale 2 | دخل | 500 |
| Purchase 1 | مصروف | 200 |
| Cash Payment | قبض | 300 |
| **Endorsement Payment** | قبض | 500 |

**Expected Calculations**:
```
totalSales = 1000 + 500 = 1,500
totalPurchases = 200
totalPaymentsReceived = 300 + 500 = 800  (includes endorsement!)
totalPaymentsMade = 0

Balance = 1500 - 200 - (800 - 0) - 0 - 0 = 500 عليه
```

**Verification**:
- [ ] Header card shows: `الرصيد الحالي = 500.00 د.أ`
- [ ] Color is RED (عليه)
- [ ] Text shows "عليه"

**If endorsement NOT counted**: Balance would be 1000 (WRONG)

---

### Numeric Test B: Statement Running Balance

**Purpose**: Verify each row's running balance is calculated correctly

**Setup**: Same as Test A, transactions in chronological order:
1. Dec 1: Sale 1 (1000)
2. Dec 5: Sale 2 (500)
3. Dec 10: Purchase 1 (200)
4. Dec 15: Cash Payment (300)
5. Dec 20: Endorsement Payment (500)

**Assuming opening balance = 0**

| Date | Description | Debit | Credit | Expected Balance |
|------|-------------|-------|--------|------------------|
| - | رصيد افتتاحي | - | - | 0 |
| Dec 1 | Sale 1 | 1000 | - | 1000 عليه |
| Dec 5 | Sale 2 | 500 | - | 1500 عليه |
| Dec 10 | Purchase 1 | - | 200 | 1300 عليه |
| Dec 15 | Cash Payment | - | 300 | 1000 عليه |
| Dec 20 | Endorsement | - | 500 | **500 عليه** |

**Verification** - Check each row:
- [ ] Row 1 balance = 1000
- [ ] Row 2 balance = 1500
- [ ] Row 3 balance = 1300
- [ ] Row 4 balance = 1000
- [ ] Row 5 balance = 500 ← **Endorsement correctly reduces balance**

---

### Numeric Test C: Statement Totals Row

**Purpose**: Verify المجموع row shows correct totals

**Same setup as Test B**

**Expected Totals**:
```
Total Debit (مدين) = 1000 + 500 = 1,500
Total Credit (دائن) = 200 + 300 + 500 = 1,000
```

**Verification**:
- [ ] مدين column total = 1,500.00
- [ ] دائن column total = 1,000.00
- [ ] الرصيد المستحق = 500.00 عليه

---

### Numeric Test D: Pending Cheques Calculation

**Purpose**: Verify pending cheques section excludes endorsed cheques

**Setup**:
- Current balance: 2,000 عليه
- Cheque 1: 600 JOD, status = قيد الانتظار, type = وارد
- Cheque 2: 400 JOD, status = مجيّر (ENDORSED), type = وارد
- Cheque 3: 300 JOD, status = قيد الانتظار, type = صادر

**Expected in "شيكات قيد الانتظار" section**:
```
Pending incoming (وارد): 600 only (NOT 1000!)
Pending outgoing (صادر): 300
Total pending: 600 + 300 = 900

Balance after = 2000 - 600 + 300 = 1,700 عليه
```

**Verification**:
- [ ] Pending cheques table shows 2 rows (NOT 3)
- [ ] Endorsed cheque (400) is NOT in pending section
- [ ] إجمالي الشيكات المعلقة = 900.00 (NOT 1,300)
- [ ] الرصيد المتوقع بعد صرف الشيكات = 1,700.00 عليه

---

### Numeric Test E: Multi-Allocation with Advance

**Purpose**: Verify exact balance when cheque > client debt

**Setup**:
- Sale: 700 JOD (client owes 700)
- Cheque endorsed: 1,000 JOD
- Allocation: 700 to sale, 300 unallocated → سلفة عميل

**Expected**:
```
totalSales = 700
totalPaymentsReceived = 1000 (full cheque amount)
Balance = 700 - 0 - (1000 - 0) = -300 له
```

**Verification**:
- [ ] Current balance = 300.00 له (GREEN, negative = we owe client)
- [ ] Statement shows receipt of 1,000
- [ ] A سلفة عميل entry of 300 appears in ledger
- [ ] Running balance after endorsement = -300

---

### Numeric Test F: Cancel Endorsement Reversal

**Purpose**: Verify exact numbers after canceling endorsement

**Before Cancel** (from Test E):
- Balance: -300 له
- Payments received: 1,000
- Ledger has سلفة عميل of 300

**After Cancel**:
```
totalSales = 700
totalPaymentsReceived = 0 (endorsement removed)
Balance = 700 - 0 - 0 = 700 عليه
```

**Verification**:
- [ ] Balance changes from -300 له to 700 عليه
- [ ] Statement no longer shows the 1,000 receipt
- [ ] سلفة عميل entry is deleted
- [ ] Cheque status back to قيد الانتظار

---

### Numeric Test G: Date Filter Balance Calculation

**Purpose**: Verify opening balance adjusts correctly with date filter

**Setup** (transactions in order):
- Dec 1: Sale 1,000 (debit)
- Dec 10: Payment 400 (credit)
- Dec 20: Endorsement 300 (credit)

**Test 1: Filter Dec 1-31 (all transactions)**
- Opening balance: 0
- Final balance: 1000 - 400 - 300 = 300 عليه

**Test 2: Filter Dec 15-31**
- Opening balance should include Dec 1 & Dec 10: 0 + 1000 - 400 = 600 عليه
- Transactions shown: only endorsement (300 credit)
- Final balance: 600 - 300 = 300 عليه

**Verification**:
- [ ] Filter Dec 15-31 shows opening balance = 600.00
- [ ] Only 1 transaction in table (the endorsement)
- [ ] Final balance still = 300.00

---

### Numeric Test H: Export Totals Match Display

**Purpose**: Verify Excel/PDF exports match on-screen numbers

**Setup**: Client with mixed transactions

**Verification**:
1. Note these values from screen:
   - Total Debit: ________
   - Total Credit: ________
   - Final Balance: ________

2. Export to Excel, verify:
   - [ ] Excel Total Debit matches
   - [ ] Excel Total Credit matches
   - [ ] Excel Final Balance matches

3. Export to PDF, verify:
   - [ ] PDF Total Debit matches
   - [ ] PDF Total Credit matches
   - [ ] PDF Final Balance matches

---

## Calculation Formula Quick Reference

### Current Balance (Header Card)
```typescript
balance = totalSales - totalPurchases
        - (totalPaymentsReceived - totalPaymentsMade)
        - totalDiscounts - totalWriteoffs
```
- Endorsement payments ARE included in totalPaymentsReceived ✓

### Running Balance (Statement Table)
```typescript
runningBalance = openingBalance + debit - credit
```
- Each row adds debit and subtracts credit

### Balance After Pending Cheques
```typescript
balanceAfterCheques = finalBalance - incomingTotal + outgoingTotal
```
- Only includes cheques with status = "قيد الانتظار"
- Endorsed cheques (status = "مجيّر") are EXCLUDED ✓

---

## Test Execution Log

**Date**: _______________
**Tester**: _______________

| Test # | Pass/Fail | Notes |
|--------|-----------|-------|
| Test 1 | | |
| Test 2 | | |
| Test 3 | | |
| Test 4 | | |
| Test 5 | | |
| Test 6 | | |
| Test 7 | | |
| Test 8 | | |
| Test 9 | | |
| Test 10 | | |
| Numeric A | | |
| Numeric B | | |
| Numeric C | | |
| Numeric D | | |
| Numeric E | | |
| Numeric F | | |
| Numeric G | | |
| Numeric H | | |
