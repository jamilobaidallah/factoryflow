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

## Status: COMPLETED - READY FOR PR
