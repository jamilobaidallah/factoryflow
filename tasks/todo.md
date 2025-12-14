# Task: Add Payables Alert to Dashboard

## Branch
`feature/payables-alert`

---

## Status: COMPLETED

---

## Plan

### Problem
The dashboard "يحتاج انتباهك" section currently only shows:
- ✅ شيكات تستحق قريباً (cheques due soon)
- ✅ ذمم غير محصلة (receivables - money owed TO us)
- ❌ Missing: ذمم مستحقة علينا (payables - money WE owe to suppliers)

### Solution
Add a third alert for **payables** - unpaid expense entries where we owe money to suppliers/vendors.

### Alert Priority Order (top to bottom)
| Alert | Type | Color | Priority |
|-------|------|-------|----------|
| شيكات تستحق قريباً | Cheques | rose (pulsing) | Highest |
| ذمم مستحقة علينا | Payables | orange | High |
| ذمم غير محصلة | Receivables | amber | Medium |

---

## Todo Items

### 1. Update Constants
- [x] Add new labels to `DASHBOARD_LABELS` in `dashboard.constants.ts`:
  - `unpaidPayables: "ذمم مستحقة علينا"`
  - `dueInvoices: "فاتورة مستحقة"`

### 2. Update Types
- [x] Update `DashboardAlertsProps` in `dashboard.types.ts` to include `unpaidPayables: AlertData`
- [x] Update `UseReceivablesAlertsReturn` to include `unpaidPayables: AlertData`

### 3. Update Hook
- [x] Modify `useReceivablesAlerts.ts` to:
  - Add state for payables: `unpaidPayables`
  - Query expense entries (`type === 'مصروف'`) with `paymentStatus` in `['unpaid', 'partial']`
  - Add helper function `isOutstandingPayable()` similar to `isOutstandingReceivable()`
  - Return both `unpaidReceivables` and `unpaidPayables`

### 4. Update DashboardAlerts Component
- [x] Create `PayablesAlert` component (similar to `ReceivablesAlert`) with:
  - Orange color scheme (`bg-orange-50`, `border-orange-100`, `text-orange-700`)
  - Link to `/ledger?paymentStatus=outstanding&type=expense`
  - Use new labels
- [x] Update `hasAnyAlert` logic to include payables
- [x] Render alerts in priority order: cheques → payables → receivables
- [x] Update "All good" indicator logic to check all 3 alert types

### 5. Update Dashboard Page
- [x] Destructure `unpaidPayables` from `useReceivablesAlerts()` hook
- [x] Pass `unpaidPayables` to `DashboardAlerts` component

### 6. Verification
- [x] Run `npm run build` to verify no TypeScript errors

---

## Files Modified

1. `src/components/dashboard/constants/dashboard.constants.ts` - Add new labels
2. `src/components/dashboard/types/dashboard.types.ts` - Update interfaces
3. `src/components/dashboard/hooks/useReceivablesAlerts.ts` - Add payables query
4. `src/components/dashboard/components/DashboardAlerts.tsx` - Add payables alert UI
5. `src/components/dashboard/dashboard-page.tsx` - Pass payables data to component

---

## Review

### Summary of Changes

Added a new "Payables" alert to the dashboard's "يحتاج انتباهك" (Needs Attention) section. This alert shows unpaid expense entries where the business owes money to suppliers/vendors.

### Files Modified

1. **`src/components/dashboard/constants/dashboard.constants.ts`**
   - Added `unpaidPayables: "ذمم مستحقة علينا"` label
   - Added `dueInvoices: "فاتورة مستحقة"` label for count text

2. **`src/components/dashboard/types/dashboard.types.ts`**
   - Added `unpaidPayables: AlertData` to `DashboardAlertsProps` interface
   - Added `unpaidPayables: AlertData` to `UseReceivablesAlertsReturn` interface

3. **`src/components/dashboard/hooks/useReceivablesAlerts.ts`**
   - Imported `EXPENSE_TYPE` constant
   - Added `unpaidPayables` state
   - Updated snapshot listener to count both receivables and payables
   - Added `isOutstandingPayable()` helper function (mirrors `isOutstandingReceivable()` but checks for expense type)
   - Hook now returns both `unpaidReceivables` and `unpaidPayables`

4. **`src/components/dashboard/components/DashboardAlerts.tsx`**
   - Added `hasPayablesAlert` boolean check
   - Updated `hasAnyAlert` to include payables
   - Added `PayablesAlert` component with orange color scheme
   - Updated `ReceivablesAlert` link to include `&type=income` for precise filtering
   - Removed unused `NoOverdueIndicator` component (simplified logic)
   - Alert render order: Cheques (rose) → Payables (orange) → Receivables (amber)

5. **`src/components/dashboard/dashboard-page.tsx`**
   - Destructure `unpaidPayables` from `useReceivablesAlerts()` hook
   - Pass `unpaidPayables` prop to `DashboardAlerts` component

### New Feature Behavior

- **Payables Alert**: Shows when there are unpaid/partial expense entries
- **Color**: Orange (`bg-orange-50`, `border-orange-100`, `text-orange-700`)
- **Link**: Navigates to `/ledger?paymentStatus=outstanding&type=expense`
- **Label**: "ذمم مستحقة علينا" with count "X فاتورة مستحقة"
- **Priority**: Displayed between cheques (highest) and receivables (lowest)

### Build Status
- ✅ TypeScript compilation passes
- ✅ No breaking changes
- ✅ Dashboard bundle size: 10.8kB (unchanged)

