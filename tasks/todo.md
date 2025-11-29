# Refactor Invoice Modal: UX Overhaul & Logic Fixes

## Problem Analysis

The Invoice Modal (`InvoicesFormDialog.tsx`) needs UX improvements and logic fixes:

1. **Total field is read-only** - Users can't paste a ledger amount and have the price auto-adjust
2. **Validation too strict** - QuickInvoiceDialog shows mismatch for decimal differences
3. **No row type distinction** - Can't differentiate Material vs Service rows
4. **Missing metadata fields** - No manual invoice # or invoice image upload

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/invoices/types/invoices.ts` | Added `InvoiceItemType`, `itemType`, `manualInvoiceNumber`, `invoiceImageUrl` |
| `src/components/invoices/components/InvoicesFormDialog.tsx` | Editable Total, reverse calculation, row types, metadata fields |
| `src/components/invoices/hooks/useInvoicesOperations.ts` | Save new fields to Firestore |
| `src/components/invoices/invoices-page.tsx` | Load new fields when editing |
| `src/components/ledger/components/QuickInvoiceDialog.tsx` | Same changes + relaxed validation |

---

## Implementation Plan

### Tasks

- [x] **Task 1: Update Types** - Add `itemType` to `InvoiceItem`, add `manualInvoiceNumber` and `invoiceImageUrl` to `Invoice` and `InvoiceFormData`

- [x] **Task 2: Editable Total with Reverse Calculation** - Make Total editable. When Total changes, back-calculate `unitPrice = total / quantity`.

- [x] **Task 3: Row Type Dropdown (Material/Service)** - Add dropdown for each row. Hide dimension columns when type is "Service".

- [x] **Task 4: New Metadata Fields** - Add "Manual Invoice #" text input and file upload for invoice image in form header.

- [x] **Task 5: Relax Validation in QuickInvoiceDialog** - Change validation to `Math.round(InvoiceTotal) === Math.round(LedgerAmount)` for the match indicator.

- [x] **Task 6: Update Operations Hook** - Save new fields (`itemType`, `manualInvoiceNumber`, `invoiceImageUrl`) to Firestore.

- [x] **Task 7: Apply Same Changes to QuickInvoiceDialog** - Ensure consistency between both invoice dialogs.

- [x] **Task 8: Test & Verify** - Build passes with no TypeScript errors.

---

## Review

### Changes Made

#### 1. Types (`types/invoices.ts`)
- Added `InvoiceItemType = 'material' | 'service'`
- Added `itemType` field to `InvoiceItem` and `CleanInvoiceItem`
- Added `manualInvoiceNumber` and `invoiceImageUrl` to `Invoice` interface
- Added `manualInvoiceNumber` and `invoiceImageUrl` to `InvoiceFormData`
- Updated `initialFormData` and `initialInvoiceItem` with defaults

#### 2. Reverse Calculation (`InvoicesFormDialog.tsx`, `QuickInvoiceDialog.tsx`)
- `handleItemChange` now handles `total` field
- When Total is edited: `unitPrice = total / quantity`
- Total input is now editable (removed `disabled` attribute)

#### 3. Row Type Dropdown
- Added "النوع" (Type) column to table header
- Added dropdown with "مادة" (Material) / "خدمة" (Service) options
- Dimensions (Length/Width/Thickness) hidden when type is "Service"
- Shows "-" placeholder for service items

#### 4. Metadata Fields (`InvoicesFormDialog.tsx`)
- Added "رقم الفاتورة اليدوي" (Manual Invoice #) text input
- Added "صورة الفاتورة" (Invoice Image) file upload button
- Image stored as base64 string
- Upload button shows "تغيير الصورة" when image exists
- Delete button to remove uploaded image

#### 5. Relaxed Validation (`QuickInvoiceDialog.tsx`)
- Changed from: `Math.abs(totals.total - pendingData.amount) < 0.01`
- Changed to: `Math.round(totals.total) === Math.round(pendingData.amount)`
- Allows saving when rounded values match

#### 6. Operations Hook (`useInvoicesOperations.ts`)
- `cleanedItems` now includes `itemType`
- Dimensions only saved for materials (`itemType !== 'service'`)
- `updateDoc` and `addDoc` now save `manualInvoiceNumber` and `invoiceImageUrl` if provided

#### 7. Edit Page (`invoices-page.tsx`)
- `handleEdit` now loads `manualInvoiceNumber` and `invoiceImageUrl` from invoice

---

### Code Quality

- **Simple Changes**: Each modification is minimal and focused
- **No Breaking Changes**: All existing functionality preserved
- **No Infinite Loops**: Reverse calculation only triggers on direct `total` field edit
- **Consistent UX**: Both `InvoicesFormDialog` and `QuickInvoiceDialog` have identical behavior
- **Clean Data**: Optional fields only saved to Firestore when they have values

### Build Status

```
Compiled successfully
Linting and checking validity of types passed
```

All 8 tasks completed successfully.
