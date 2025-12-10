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

## Part 4: Bug Fix - Double Payment with Cashed Cheques

### Problem
When user selected "مدفوع بالكامل" + added cashed cheque:
- System created TWO payments (cash + cheque)
- This double-counted the payment amount

### Root Cause
The immediate settlement logic only checked for incoming cheques and didn't:
1. Check for outgoing cheques
2. Account for multiple cheques in lists
3. Verify cheque `accountingType === "cashed"`

### Fix Applied
Updated `createLedgerEntryWithRelated` in `LedgerService.ts`:
- Now calculates total amount from ALL cashed cheques (incoming + outgoing)
- Supports both single cheque and multiple cheques in lists
- Only creates cash payment for remaining amount after cheques
- If cheques cover full amount → No cash payment created

### Test Scenarios
| Scenario | Expected Result |
|----------|-----------------|
| مدفوع بالكامل + cashed cheque = full amount | 1 payment (cheque only) |
| مدفوع بالكامل + cashed cheque < full amount | 2 payments (cheque + cash for diff) |
| مدفوع بالكامل + no cheque | 1 payment (cash) |
| مدفوع بالكامل + postponed cheque | 1 payment (cash - postponed doesn't count) |

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/forms/ChequeFormCard.tsx` | **NEW** |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Radio buttons, uses ChequeFormCard |
| `src/services/ledger/LedgerService.ts` | Fixed double payment + cashed cheque tracking |
| `src/services/ledger/handlers/chequeHandlers.ts` | Added category to payments |

---

**Ready for PR**
