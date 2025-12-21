# Endorsed Cheques - Client Page Testing & Bug Report

## Summary

After thorough analysis of the client page components and endorsed cheques implementation, I've identified **6 bugs** and created **10 test scenarios** for Vercel testing.

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
