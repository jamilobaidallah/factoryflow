# Task: Extract ChequeFormCard + Bug Fixes + UX Improvement

## Part 1: ChequeFormCard Extraction
- [x] Created reusable `ChequeFormCard.tsx` component
- [x] Reduced LedgerFormDialog from 1,151 to 967 lines (16%)

## Part 2: Bug Fix - Cashed Cheques Missing Category
- [x] Added `category` and `subCategory` to payment records in `chequeHandlers.ts`
- [x] Updated `LedgerService.ts` to track payment status for cashed cheques

## Part 3: UX Improvement - Payment Status Radio Buttons
- [x] Replaced nested checkboxes with intuitive radio button group
- [x] Default changed to "آجل" (credit) selected by default

## Part 4: Bug Fix - Double Payment with Cashed Cheques (v2)

### Problem
When user selected "مدفوع بالكامل" + added cashed cheque:
- System created TWO payments (cash + cheque)
- This double-counted the payment amount

### Root Cause (Previous Fix Did Not Work)
Previous fix tried to subtract cheque amounts from cash payment, but still had edge cases.

The actual issue was that **both** handlers were creating payments:
1. `chequeHandlers.ts` - Created payment for cashed cheques
2. `handleImmediateSettlementBatch` - Created cash payment for immediate settlement

### Final Fix Applied (Option B)
Updated `chequeHandlers.ts` to **skip payment creation** when:
- `formData.immediateSettlement === true` AND
- `accountingType === "cashed"`

Updated `paymentHandlers.ts`:
- Added `method` parameter ("cash" | "cheque")
- Notes reflect payment method appropriately

Updated `LedgerService.ts`:
- Immediate settlement now detects if cashed cheques exist
- Creates ONE payment with correct `method` ("cheque" if paid by cheque)

### Test Scenarios
| Scenario | Expected Result |
|----------|-----------------|
| مدفوع بالكامل + cashed cheque | 1 payment (method: "cheque") |
| مدفوع بالكامل + no cheque | 1 payment (method: "cash") |
| مدفوع بالكامل + postponed cheque | 1 payment (method: "cash") |
| آجل + cashed cheque | 1 payment (method: "cheque") - created by cheque handler |
| آجل + postponed cheque | 0 payments - cheque only tracked |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/forms/ChequeFormCard.tsx` | **NEW** |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Radio buttons, uses ChequeFormCard |
| `src/services/ledger/LedgerService.ts` | Fixed double payment, detects cheque method |
| `src/services/ledger/handlers/chequeHandlers.ts` | Skip payment when immediateSettlement + cashed |
| `src/services/ledger/handlers/paymentHandlers.ts` | Added method param to settlement |

---

**Ready for PR**
