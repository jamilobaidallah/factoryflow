# Task: Extract ChequeFormCard Component + Bug Fixes + UX Improvement

## Part 1: ChequeFormCard Extraction

Extracted duplicate cheque form code from `LedgerFormDialog.tsx` into a new reusable `ChequeFormCard` component.

- [x] Create `src/components/ledger/forms/ChequeFormCard.tsx`
- [x] Integrate into LedgerFormDialog.tsx
- [x] Line count reduction: 1,151 → 967 lines (16%)

---

## Part 2: Bug Fix - Cashed Cheques

### Bug Description
When creating a ledger entry with a "cashed" outgoing cheque:
1. Payment record was missing `category` and `subCategory` fields
2. Ledger entry's `paymentStatus` remained undefined instead of "paid"

### Fix Applied
- [x] Added `category` and `subCategory` to payment records in `chequeHandlers.ts`
- [x] Updated `LedgerService.ts` to track payment status for cashed cheques

---

## Part 3: UX Improvement - Payment Status Radio Buttons

### Problem
Users had to check "تتبع الذمم (AR/AP)" checkbox first before seeing payment options. This was backwards from how users think: "Is this paid or not?"

### Old Flow (Confusing)
```
☐ تتبع الذمم (AR/AP tracking)
  └── ☐ تسوية فورية (Instant Settlement)
  └── ☐ دفعة أولية (Initial Payment)
```

### New Flow (User-Friendly)
```
حالة الدفع: (Payment Status)
○ مدفوع بالكامل (Fully Paid)
○ آجل - سيتم تتبع الذمم (On Credit) ← DEFAULT
○ دفعة جزئية (Partial Payment): [____]
```

### Changes Made
- [x] Replaced nested checkboxes with radio button group in LedgerFormDialog.tsx
- [x] Added helper text that updates based on selection
- [x] Changed default from `trackARAP: false` to `trackARAP: true` ("آجل" selected by default)
- [x] Updated defaults in:
  - `useLedgerForm.ts`
  - `types/ledger.ts`
- [x] Updated related tests in `useLedgerForm.test.ts`

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ledger/forms/ChequeFormCard.tsx` | **NEW** - Reusable component |
| `src/components/ledger/components/LedgerFormDialog.tsx` | Radio buttons for payment status |
| `src/components/ledger/hooks/useLedgerForm.ts` | Default trackARAP: true |
| `src/components/ledger/types/ledger.ts` | Default trackARAP: true |
| `src/components/ledger/hooks/__tests__/useLedgerForm.test.ts` | Updated expected defaults |
| `src/services/ledger/handlers/chequeHandlers.ts` | Added category fields to payments |
| `src/services/ledger/LedgerService.ts` | Fixed paymentStatus for cashed cheques |

---

## Verification

| Check | Result |
|-------|--------|
| TypeScript | Compiles without errors |
| Radio buttons | 3 options working |
| Default selection | "آجل" selected by default |
| Helper text | Updates based on selection |

---

**Ready for PR**
