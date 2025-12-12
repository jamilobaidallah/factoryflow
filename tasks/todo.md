# Task: RBAC Foundation (Phase 1)

## Branch
`feature/rbac-foundation`

---

## Context
Adding Role-Based Access Control to FactoryFlow. This is Phase 1 - creating type definitions and constants only. No changes to existing functionality.

### Design Decisions
- One user = one organization (simple model)
- Existing users auto-become "owner"
- New users self-register and request access

---

## Plan

### Task 1.1: Create `src/types/rbac.ts`
- [x] Create new file `src/types/rbac.ts`
- [x] Define `UserRole` union type: `'owner' | 'accountant' | 'viewer'`
- [x] Define `PermissionAction` union type: `'create' | 'read' | 'update' | 'delete' | 'export'`
- [x] Define `PermissionModule` union type for all 13 modules
- [x] Define `OrganizationMember` interface with required fields
- [x] Define `AccessRequest` interface for pending requests
- [x] Define `RolePermissions` Record type
- [x] Add JSDoc comments in Arabic

### Task 1.2: Update `src/lib/constants.ts`
- [x] Add `USER_ROLES` constant object
- [x] Add `USER_ROLE_LABELS` constant with Arabic labels
- [x] Add `UserRoleKey` type export

### Task 1.3: Create `src/lib/permissions.ts`
- [x] Create new file `src/lib/permissions.ts`
- [x] Define `ROLE_PERMISSIONS` matrix for all roles × modules
- [x] Implement `hasPermission(role, module, action)` function
- [x] Implement `getModulePermissions(role, module)` helper
- [x] Implement `hasAnyPermission(role, module)` helper
- [x] Add JSDoc comments in Arabic

### Verification
- [x] Run `npx tsc --noEmit` - PASSED
- [x] Run `npm run lint` - PASSED (pre-existing warnings only)
- [x] No existing functionality affected

---

## Review

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/types/rbac.ts` | **CREATE** | RBAC type definitions |
| `src/lib/constants.ts` | **MODIFY** | Added USER_ROLES constants |
| `src/lib/permissions.ts` | **CREATE** | Permission matrix and utilities |

### Summary of Changes

#### `src/types/rbac.ts` (NEW)
- `UserRole` - Union type: `'owner' | 'accountant' | 'viewer'`
- `PermissionAction` - Union type: `'create' | 'read' | 'update' | 'delete' | 'export'`
- `PermissionModule` - Union type for 13 modules
- `OrganizationMember` - Interface for org members with `uid`, `orgId`, `email`, `displayName`, `role`, `requestedAt`, `approvedAt`, `approvedBy`, `isActive`
- `AccessRequest` - Interface for pending requests with `id`, `uid`, `email`, `displayName`, `requestedAt`, `status`
- `RolePermissions` - Record type mapping roles to module permissions

#### `src/lib/constants.ts` (MODIFIED)
- Added `USER_ROLES` constant: `{ OWNER: 'owner', ACCOUNTANT: 'accountant', VIEWER: 'viewer' }`
- Added `USER_ROLE_LABELS` with Arabic labels
- Added `UserRoleKey` type export

#### `src/lib/permissions.ts` (NEW)
- `ROLE_PERMISSIONS` - Full permission matrix for all roles × modules
- `hasPermission(role, module, action)` - Check if role can perform action
- `getModulePermissions(role, module)` - Get all allowed actions for a role/module
- `hasAnyPermission(role, module)` - Check if role has any access to module

### Permission Matrix

| Module | Owner | Accountant | Viewer |
|--------|-------|------------|--------|
| dashboard | all | read | read |
| ledger | all | CRUD | read |
| clients | all | CRUD | read |
| payments | all | CRUD | read |
| cheques | all | CRUD | read |
| inventory | all | CRUD | read |
| employees | all | CRUD | read |
| partners | all | CRUD | read |
| fixed-assets | all | CRUD | read |
| invoices | all | CRUD + export | read |
| reports | all | read + export | read |
| users | all | none | none |
| settings | all | none | none |

### Test Results
```
TypeScript: PASSED (no errors)
ESLint: PASSED (pre-existing warnings only)
```

---

## Status: COMPLETED - READY FOR PR
