# Feature: QuickPayDialog "Pay Full Amount" Button

## Problem

User must manually type the remaining balance when making a quick payment. This is tedious and error-prone.

## Solution

Add a "دفع الكل" (Pay Full) button next to the amount input that auto-fills the remaining balance.

## Current Implementation

**File:** `src/components/ledger/components/QuickPayDialog.tsx`

The amount input (lines 143-151) is standalone. User sees the max amount as helper text but must type it manually.

```tsx
<Input
  id="quickPayAmount"
  type="number"
  step="0.01"
  placeholder="أدخل المبلغ"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  required
/>
```

## Proposed Change

Wrap input and button in a flex container:

```tsx
<div className="flex gap-2">
  <Input
    id="quickPayAmount"
    type="number"
    step="0.01"
    placeholder="أدخل المبلغ"
    value={amount}
    onChange={(e) => setAmount(e.target.value)}
    className="flex-1"
    required
  />
  {entry?.remainingBalance && (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setAmount(entry.remainingBalance!.toFixed(2))}
    >
      دفع الكل
    </Button>
  )}
</div>
```

---

## Todo List

- [ ] **1. Add flex container around amount input**
  - Wrap Input in `<div className="flex gap-2">`
  - Add `className="flex-1"` to Input for proper sizing

- [ ] **2. Add "دفع الكل" button**
  - Conditionally render when `entry?.remainingBalance` exists
  - onClick fills amount with `entry.remainingBalance.toFixed(2)`

- [ ] **3. Verify TypeScript compiles**
  - Run `npx tsc --noEmit`

- [ ] **4. Verify existing tests pass**
  - Run tests for QuickPayDialog

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/ledger/components/QuickPayDialog.tsx` | Add flex wrapper and "دفع الكل" button |

---

## Constraints

- Keep change minimal - only modify the amount input section
- Use existing Button component with `variant="outline"` and `size="sm"`
- Arabic text: "دفع الكل" (Pay All)
- No new dependencies

---

## Review

### Summary of Changes

Added a "دفع الكل" (Pay Full) button to the QuickPayDialog component. Users can now click this button to auto-fill the remaining balance instead of typing it manually.

### Files Modified

| File | Changes |
|------|---------|
| `src/components/ledger/components/QuickPayDialog.tsx` | Added flex container around amount input, added "دفع الكل" button |

### Implementation Details

- Wrapped amount Input in `<div className="flex gap-2">`
- Added `className="flex-1"` to Input for proper sizing
- Added Button with `variant="outline"` and `size="sm"`
- Button only renders when `entry?.remainingBalance` exists
- onClick fills amount with `entry.remainingBalance.toFixed(2)`

### Verification Results

| Check | Result |
|-------|--------|
| TypeScript | ✅ Compiles without errors |
| Tests | ✅ All 24 tests pass |
