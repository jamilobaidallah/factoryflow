# Task: RBAC Phase 4 - UI Integration

## Branch
`feature/rbac-ui-integration`

---

## Context
Phases 1-3 complete. Integrating RBAC into UI so viewers see read-only interface.

---

## Plan

### Task 4.1: Identify Action Buttons
- [x] Ledger page - Add button, Export buttons
- [x] Clients page - Add/Edit/Delete buttons
- [x] Payments page - Add/Multi-allocation/Export buttons, Edit/Delete in table
- [x] Incoming Cheques page - Add button, Endorse/Edit/Delete in table
- [x] Outgoing Cheques page - Add button, Edit/Delete/Link in table
- [x] Inventory page - Add/Export buttons, Movement/Edit/Delete in table
- [x] Employees page - Add button, Edit/Delete in table
- [x] Partners page - Add button, Edit/Delete in table
- [x] Fixed Assets page - Add/Depreciation buttons, Edit/Delete in table
- [x] Invoices page - Add button, Export/Edit/Status/Delete in table

### Task 4.2: Wrap Action Buttons with PermissionGate
- [x] All Add/Create buttons wrapped with `action="create"`
- [x] All Edit/Update buttons wrapped with `action="update"`
- [x] All Delete buttons wrapped with `action="delete"`
- [x] All Export buttons wrapped with `action="export"`

### Task 4.3: Hide Table Row Actions
- [x] LedgerTable - Desktop & Mobile views
- [x] EmployeesTable
- [x] FixedAssetsTable
- [x] IncomingChequesTable
- [x] OutgoingChequesTable
- [x] Clients, Payments, Partners, Inventory, Invoices tables (inline in pages)

### Task 4.4: Add Role Badge to Header
- [x] Import usePermissions and USER_ROLE_LABELS
- [x] Display role badge next to user email

### Verification
- [x] TypeScript check passes
- [x] Lint check passes (pre-existing warnings only)

---

## Files Modified

| File | Changes |
|------|---------|
| `src/components/clients/clients-page.tsx` | Added PermissionGate for Add/Edit/Delete |
| `src/components/payments/payments-page.tsx` | Added PermissionGate for Add/Multi/Export/Edit/Delete |
| `src/components/cheques/incoming-cheques-page.tsx` | Added PermissionGate for Add |
| `src/components/cheques/outgoing-cheques-page.tsx` | Added PermissionGate for Add |
| `src/components/inventory/inventory-page.tsx` | Added PermissionGate for Add/Export/Movement/Edit/Delete |
| `src/components/employees/employees-page.tsx` | Added PermissionGate for Add |
| `src/components/partners/partners-page.tsx` | Added PermissionGate for Add/Edit/Delete |
| `src/components/fixed-assets/fixed-assets-page.tsx` | Added PermissionGate for Add/Depreciation |
| `src/components/invoices/invoices-page.tsx` | Added PermissionGate for Add/Export/Edit/Status/Delete |
| `src/components/ledger/ledger-page.tsx` | Added PermissionGate for Add/Export |
| `src/components/ledger/components/LedgerTable.tsx` | Added PermissionGate for QuickPay/Edit/Delete (desktop & mobile) |
| `src/components/employees/components/EmployeesTable.tsx` | Added PermissionGate for Edit/Delete |
| `src/components/fixed-assets/components/FixedAssetsTable.tsx` | Added PermissionGate for Edit/Delete |
| `src/components/cheques/components/IncomingChequesTable.tsx` | Added PermissionGate for Endorse/Cancel/Edit/Delete |
| `src/components/cheques/components/OutgoingChequesTable.tsx` | Added PermissionGate for Edit/Delete/Link |
| `src/components/layout/header.tsx` | Added role badge display |

## Button Count
- **Create buttons wrapped**: 10
- **Update buttons wrapped**: 18
- **Delete buttons wrapped**: 14
- **Export buttons wrapped**: 5
- **Total buttons wrapped**: 47

---

## Bug Fix: Pending Access Requests Not Showing (Dec 2025)

### Problem
Owner could not see pending access requests in User Management page (showed 0).

### Root Cause
1. Firestore security rules blocked authenticated users from reading `access_requests`
2. Missing composite indexes for Firestore queries

### Solution Applied
1. ✅ **Firestore Rules Updated** - `access_requests` now allows read for authenticated users:
   ```javascript
   allow read: if isAuthenticated();
   ```

2. ✅ **Index 1 Created**: `access_requests` collection
   - Fields: `targetOwnerId` (Asc), `status` (Asc), `requestedAt` (Desc)

3. ✅ **Index 2 Created**: `members` subcollection
   - Fields: `isActive` (Asc), `approvedAt` (Desc)
   - Scope: Collection

### Files Cleaned Up
- `src/components/users/users-page.tsx` - Removed debug banner and console.logs
- `src/services/userService.ts` - Removed debug console.logs

### Status: ✅ FIXED

---

## Bug Fix: Duplicate Members on Approval (Dec 2025)

### Problem
When approving access requests:
1. Error toast appeared: "حدث خطأ أثناء قبول الطلب"
2. BUT the user WAS added - multiple times (duplicate entries)
3. Could not delete or change role of duplicate members

### Root Cause
1. `approveRequest` used `updateDoc().catch(() => addDoc())` pattern
   - `updateDoc` failed because document didn't exist
   - `addDoc` created document with random auto-generated ID (not user's UID)
   - Each retry created another duplicate
2. `updateUserRole` and `removeUserAccess` only updated first matching document

### Solution Applied
1. ✅ **approveRequest**: Changed to `setDoc(..., { merge: true })` with deterministic ID (`requestData.uid`)
2. ✅ **approveRequest**: Added idempotency check (`if (requestData.status !== 'pending')`)
3. ✅ **updateUserRole**: Now updates ALL matching documents with `Promise.all()`
4. ✅ **removeUserAccess**: Now deactivates ALL matching documents with `Promise.all()`

### Files Modified
- `src/services/userService.ts` - Added `setDoc` import, fixed all three functions

### Status: ✅ FIXED

---

## Quality Checks Passed

- ✅ TypeScript: `npx tsc --noEmit` - No errors
- ✅ ESLint: `npm run lint` - Only pre-existing warnings
- ✅ Build: `npm run build` - Success

---

## Status: COMPLETED - READY FOR PR
