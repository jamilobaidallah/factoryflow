# FactoryFlow: Settlement Discounts & Bad Debt Implementation

## Executive Summary

**Two Features, One Solution Pattern:**
Both settlement discounts and bad debt write-offs reduce the remaining balance without full cash payment. We implement them with proper accounting integrity.

**Key Design Decision:** Discounts are stored **per payment** (not just on ledger) to support multiple partial payments with discounts.

---

## Current State

```
remainingBalance = amount - totalPaid
```

**Limitations:**
- Payment MUST be <= remainingBalance
- No discount capability
- No write-off capability
- Multi-allocation has no discount support

---

## Target State

```
remainingBalance = amount - totalPaid - totalDiscount - writeoffAmount
```

**New Capabilities:**
- Accept partial payment + discount
- Multiple payments with individual discounts
- Multi-allocation with per-invoice discounts
- Bad debt write-off with audit trail
- Proper journal entries for all

---

## Data Model

### Payment Record (Each payment tracks its own discount)
```typescript
interface Payment {
  // ... existing fields
  amount: number;                    // Cash received
  discountAmount?: number;           // Discount given with THIS payment
  discountReason?: string;           // "خصم سداد مبكر", "خصم تسوية"
  isSettlementDiscount?: boolean;    // Flag for reporting
}
```

### Ledger Entry (Aggregated totals)
```typescript
interface LedgerEntry {
  // ... existing fields
  amount: number;                    // Original invoice amount
  totalPaid: number;                 // Sum of all payments
  totalDiscount: number;             // Sum of all payment discounts
  writeoffAmount?: number;           // Bad debt written off
  writeoffReason?: string;           // Required for writeoff
  writeoffDate?: Date;               // When written off
  writeoffBy?: string;               // User who authorized (audit)
  remainingBalance: number;          // Calculated field
  paymentStatus: 'paid' | 'partial' | 'unpaid';
}
```

### Payment Allocation (Multi-Allocation)
```typescript
interface PaymentAllocation {
  transactionId: string;
  allocatedAmount: number;
  discountAmount?: number;           // Per-invoice discount
  discountReason?: string;
}
```

### Status Calculation Logic
```typescript
function calculatePaymentStatus(totalPaid, totalDiscount, writeoffAmount, amount) {
  const effectiveSettled = totalPaid + totalDiscount + writeoffAmount;

  if (effectiveSettled >= amount) return 'paid';
  if (effectiveSettled > 0) return 'partial';
  return 'unpaid';
}
```

**Edge Case:** Partial writeoff does NOT mark as "paid":
```
Invoice: 1,000 | Paid: 300 | Writeoff: 200 | Remaining: 500 -> Status: "partial"
```

---

## Accounting Treatment

### Settlement Discount (خصم تسوية)
```
Example: Client owes 1000, pays 900, gets 100 discount

Journal Entry:
DR: Cash (1000)              900 JOD
DR: Sales Discount (4300)    100 JOD  <- Contra-Revenue
CR: Accounts Receivable      1000 JOD
```

### Bad Debt Write-off (ديون معدومة)
```
Example: Client owes 500, declared uncollectible

Journal Entry:
DR: Bad Debt Expense (5600)  500 JOD  <- Expense
CR: Accounts Receivable      500 JOD
```

### Purchase Discount Received (خصم مشتريات)
```
Example: You owe supplier 1000, pay 950, get 50 discount

Journal Entry:
DR: Accounts Payable         1000 JOD
CR: Cash                     950 JOD
CR: Purchase Discount (5050) 50 JOD   <- Contra-Expense (reduces your costs)
```

---

## Implementation Tasks

### Phase 1: Foundation (Data & Accounts)
- [ ] 1.1 Add new account codes to `src/types/accounting.ts`:
  - `SALES_DISCOUNT: '4300'` (contra-revenue)
  - `PURCHASE_DISCOUNT: '5050'` (contra-expense)
  - `BAD_DEBT_EXPENSE: '5600'` (expense)
- [ ] 1.2 Add account definitions to `src/lib/chart-of-accounts.ts`
- [ ] 1.3 Update ledger types in `src/components/ledger/types/ledger.ts`:
  - Add `totalDiscount?: number`
  - Add `writeoffAmount?: number`
  - Add `writeoffReason?: string`
  - Add `writeoffDate?: Date`
  - Add `writeoffBy?: string`
- [ ] 1.4 Update payment types:
  - Add `discountAmount?: number`
  - Add `discountReason?: string`
  - Add `isSettlementDiscount?: boolean`
- [ ] 1.5 Update `calculatePaymentStatus()` in `src/lib/arap-utils.ts`:
  ```typescript
  const effectiveSettled = totalPaid + (totalDiscount || 0) + (writeoffAmount || 0);
  ```

### Phase 2: Settlement Discount Feature
- [ ] 2.1 Update `src/lib/arap-utils.ts`:
  - Modify `calculateNewARAPValues()` to include discount
  - Add `applyDiscountToPayment()` helper
- [ ] 2.2 Update `src/services/ledger/LedgerService.ts`:
  - Modify `addQuickPayment()` to accept `discountAmount` and `discountReason`
  - Update ledger `totalDiscount` when payment has discount
- [ ] 2.3 Add discount journal entry creation to `src/services/journalService.ts`:
  - Create Sales Discount (4300) entry when AR discount given
  - Create Purchase Discount (5050) entry when AP discount received
- [ ] 2.4 Update `src/components/ledger/components/QuickPayDialog.tsx`:
  - Add "خصم تسوية" (Discount) input field
  - Add "سبب الخصم" (Discount Reason) dropdown/input
  - Add validation: `payment + discount <= remainingBalance`
  - Update "دفع الكل" to "تسوية كاملة" when discount entered
  - Show real-time calculation: `المدفوع + الخصم = المجموع`
- [ ] 2.5 Update `src/components/payments/MultiAllocationDialog.tsx`:
  - Add per-invoice discount field
  - Calculate totals including discounts
  - Validate each allocation: `payment + discount <= invoiceRemaining`
- [ ] 2.6 Update `src/components/payments/hooks/usePaymentAllocations.ts`:
  - Handle discount in allocation logic
  - Update remaining balances correctly

### Phase 3: Bad Debt Write-off Feature
- [ ] 3.1 Create `src/components/ledger/components/WriteOffDialog.tsx`:
  - Amount field (default: full remaining)
  - Reason field (required)
  - Warning message about irreversibility
  - Capture current user for `writeoffBy`
- [ ] 3.2 Add `writeOffBadDebt()` to `src/services/ledger/LedgerService.ts`:
  - Validate: `writeoffAmount <= remainingBalance`
  - Update ledger with writeoff fields
  - Recalculate status
- [ ] 3.3 Add bad debt journal entry to `src/services/journalService.ts`:
  - DR: Bad Debt Expense (5600)
  - CR: Accounts Receivable (1200)
- [ ] 3.4 Add "شطب كدين معدوم" action to ledger row actions menu
- [ ] 3.5 Add writeoff action to client detail page for unpaid entries

### Phase 4: Visibility & Exports
- [ ] 4.1 Update ledger table display:
  - Show discount/writeoff in row or tooltip
  - Color coding for entries with writeoffs
- [ ] 4.2 Update `src/components/clients/client-detail-page.tsx`:
  - Show discount history in payment list
  - Show writeoff entries clearly marked
  - Update balance calculation display
- [ ] 4.3 Update `src/lib/export-statement-excel.ts`:
  - Add "الخصم" (Discount) column
  - Add "المشطوب" (Written Off) column
- [ ] 4.4 Update `src/lib/export-statement-pdf.ts`:
  - Include discount/writeoff in statement
- [ ] 4.5 Dashboard widget: "Total Discounts This Month"

### Phase 5: Testing & Verification
- [ ] 5.1 Test: Pay 900 on 1000 invoice with 100 discount -> Status "paid"
- [ ] 5.2 Test: Pay 500 on 1000 invoice with 100 discount -> Status "partial", remaining 400
- [ ] 5.3 Test: Writeoff 300 of 1000 owed -> Status "partial", remaining 700
- [ ] 5.4 Test: Full writeoff of 1000 -> Status "paid"
- [ ] 5.5 Test: Multi-allocation with discounts on 3 invoices
- [ ] 5.6 Test: Journal entries created correctly
- [ ] 5.7 Test: Excel export shows discount/writeoff columns
- [ ] 5.8 Test: Client balance reflects all adjustments

### Phase 6: Authorization Controls (Future)
- [ ] 6.1 Create discount policy settings
- [ ] 6.2 Add `discountApprovedBy?: string` field
- [ ] 6.3 Create approval workflow UI
- [ ] 6.4 Add writeoff approval for amounts above threshold
- [ ] 6.5 Role-based permissions: Who can give discounts/writeoffs

### Phase 7: Bad Debt Recovery (Future)
- [ ] 7.1 Add `BAD_DEBT_RECOVERY: '4700'` account (Other Income)
- [ ] 7.2 Create recovery mechanism when written-off debt is later paid
- [ ] 7.3 Link recovery to original writeoff entry
- [ ] 7.4 Update reports to show recoveries

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/types/accounting.ts` | Add SALES_DISCOUNT, PURCHASE_DISCOUNT, BAD_DEBT_EXPENSE codes |
| `src/lib/chart-of-accounts.ts` | Add 3 new account definitions |
| `src/components/ledger/types/ledger.ts` | Add discount/writeoff fields to LedgerEntry |
| `src/lib/arap-utils.ts` | Update balance calculation, add discount helpers |
| `src/services/ledger/LedgerService.ts` | Handle discount in payments, add writeoff method |
| `src/services/journalService.ts` | Add discount/writeoff journal entries |
| `src/components/ledger/components/QuickPayDialog.tsx` | Add discount UI |
| `src/components/payments/MultiAllocationDialog.tsx` | Add per-invoice discount |
| `src/components/payments/hooks/usePaymentAllocations.ts` | Handle discount in allocations |
| `src/components/clients/client-detail-page.tsx` | Show discount/writeoff in statement |
| `src/lib/export-statement-excel.ts` | Add discount/writeoff columns |
| `src/lib/export-statement-pdf.ts` | Add discount/writeoff to PDF |

**New Files:**
| File | Purpose |
|------|---------|
| `src/components/ledger/components/WriteOffDialog.tsx` | Bad debt write-off UI |

---

## Account Codes

| Code | Name (EN) | Name (AR) | Type | Purpose |
|------|-----------|-----------|------|---------|
| 4300 | Sales Discount | خصم المبيعات | Contra-Revenue | Discounts given to clients |
| 5050 | Purchase Discount | خصم المشتريات | Contra-Expense | Discounts received from suppliers |
| 5600 | Bad Debt Expense | مصروف ديون معدومة | Expense | Uncollectible receivables |
| 4700 | Bad Debt Recovery | استرداد ديون معدومة | Revenue | Future: recovered bad debts |

---

## Validation Rules

### Discount Validation
```typescript
// Payment + Discount cannot exceed remaining
if (cashPayment + discountAmount > remainingBalance) {
  error = `المجموع (${cashPayment + discountAmount}) أكبر من المتبقي (${remainingBalance})`;
}

// Full discount (no cash) is valid - show warning
if (cashPayment === 0 && discountAmount > 0) {
  warning = "سيتم تسوية الفاتورة بالكامل كخصم بدون دفعة نقدية";
}

// Discount cannot be negative
if (discountAmount < 0) {
  error = "الخصم لا يمكن أن يكون سالباً";
}
```

### Writeoff Validation
```typescript
// Writeoff cannot exceed remaining
if (writeoffAmount > remainingBalance) {
  error = `المبلغ للشطب أكبر من المتبقي (${remainingBalance})`;
}

// Reason is required
if (!writeoffReason || writeoffReason.trim() === '') {
  error = "سبب الشطب مطلوب";
}

// Cannot writeoff already paid entry
if (remainingBalance <= 0) {
  error = "هذه الفاتورة مدفوعة بالكامل";
}
```

---

## Impact on Reports

| Report | Impact |
|--------|--------|
| **Income Statement** | Sales Discounts (4300) shown as contra-revenue, reducing gross revenue |
| | Bad Debt (5600) shown as operating expense |
| **Balance Sheet** | AR reduced by writeoffs |
| **Client Statement** | Shows payment + discount on each line |
| | Shows writeoff entries clearly marked |
| **Cash Flow** | Only actual cash receipts counted (discounts excluded) |
| **Aging Report** | Remaining balance considers discounts/writeoffs |

---

## Review Section

### Branch: `feat/settlement-discounts-bad-debt`
### Date Started: December 20, 2025

### Changes Made:
- TBD

### Testing Results:
- TBD

### Notes:
- TBD
