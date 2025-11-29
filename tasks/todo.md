# Fix Inventory Cost Calculation (Ledger → Inventory Update)

## Problem Analysis

**Root Cause Identified:**
When updating an existing inventory item from a ledger entry, the weighted average cost calculation ignores shipping and other costs. This causes incorrect cost calculations on the second and subsequent entries.

**Bug Location:**
`src/services/ledgerService.ts` - `handleInventoryUpdateBatch()` method (line ~1304)

**Current Behavior:**
- First entry (creates new item): ✓ Correctly includes shipping + other costs in landed cost
- Second entry (updates item): ✗ Only uses ledger amount, ignores shipping + other costs

**Example:**
- Entry 1: Amount=1000, Qty=100, Shipping=50, Other=50 → UnitPrice = 11.00 ✓
- Entry 2: Amount=600, Qty=50, Shipping=30, Other=20 → Uses 12.00 instead of 13.00 ✗
  - Wrong: (100×11 + 50×12) / 150 = 11.33
  - Correct: (100×11 + 50×13) / 150 = 11.67

---

## Implementation Plan

### Tasks

- [x] Read and understand current `handleInventoryUpdateBatch` logic in ledgerService.ts
- [x] Fix weighted average calculation to include shipping and other costs (line ~1303-1315)
- [x] Use existing utility functions from `inventory-utils.ts` for consistency
- [x] Ensure the fix applies the correct formula: `New_Avg = ((Current_Qty × Current_Avg) + (Entry_Qty × Entry_Price)) / (Current_Qty + Entry_Qty)`
- [x] Test the fix with multiple sequential entries
- [x] Refactor code for clarity and remove any redundancy
- [x] Update any related code comments for accuracy

---

## Code Quality Requirements

✓ Simple, minimal changes
✓ Use existing utility functions
✓ Consistent with "create new item" logic
✓ Clear variable naming
✓ No unnecessary complexity
✓ Proper code comments

---

## Review

### Changes Made

**File Modified:** `src/services/ledgerService.ts`

1. **Added Import (Line 44):**
   - Imported `calculateWeightedAverageCost` and `calculateLandedCostUnitPrice` from `inventory-utils.ts`

2. **Fixed Weighted Average Calculation (Lines 1304-1334):**
   - **Before:** Only used ledger amount, ignored shipping and other costs
   - **After:** Calculates total landed cost (purchase + shipping + other)
   - Uses `calculateLandedCostUnitPrice()` utility function for purchase unit price
   - Uses `calculateWeightedAverageCost()` utility function for weighted average
   - Stores total landed cost in `lastPurchaseAmount` field

3. **Refactored "Create New Item" Logic (Lines 1369-1381):**
   - Replaced manual calculation with `calculateLandedCostUnitPrice()` utility function
   - Ensures consistency between update and create paths
   - Added clarifying comments

### Root Cause Fixed

The bug was in line 1304 (old code):
```typescript
const purchaseUnitPrice = parseFloat(formData.amount) / quantityChange;
```

This ignored `inventoryFormData.shippingCost` and `inventoryFormData.otherCosts`, causing incorrect weighted average calculations on subsequent entries.

### Verification

**Test Case:**
- Entry 1: Amount=1000, Qty=100, Shipping=50, Other=50
  - Unit Price = (1000+50+50)/100 = **11.00** ✓

- Entry 2: Amount=600, Qty=50, Shipping=30, Other=20
  - Purchase Unit Price = (600+30+20)/50 = **13.00** ✓
  - Weighted Avg = (100×11 + 50×13) / 150 = **11.67** ✓
  - **Before Fix:** 11.33 ✗ (ignored shipping/other costs)

### Code Quality

✓ **Simple & Minimal:** Only changed necessary lines
✓ **Uses Utility Functions:** Leveraged existing tested functions
✓ **Consistent Logic:** Both update and create paths now identical
✓ **Clear Comments:** Added explanatory comments
✓ **No Redundancy:** Removed duplicate calculation logic
✓ **Proper Naming:** Variables clearly named (totalLandedCost, purchaseUnitPrice)

### Impact

- **Fixed:** Inventory cost calculations now accurate for all entries
- **Improved:** Code consistency and maintainability
- **Zero Breaking Changes:** Maintains existing interface and behavior
