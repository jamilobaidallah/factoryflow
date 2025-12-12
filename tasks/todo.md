# Task: RBAC Phase 2 - Auth Context & Permissions Hook

## Branch
`feature/rbac-auth-context`

---

## Context
Phase 1 complete. We have types, constants, and permission matrix. Now integrating RBAC into the auth system.

### Existing Auth Structure
- `src/firebase/provider.tsx` - FirebaseClientProvider with user state
- `useUser()` hook returns `{ user, loading, signOut }`
- `User` interface: `{ uid, email, displayName, photoURL }`

---

## Plan

### Task 2.1: Extend Auth Context (`src/firebase/provider.tsx`)
- [x] Import `UserRole` from `@/types/rbac`
- [x] Import `doc, getDoc` from `firebase/firestore`
- [x] Add `role: UserRole | null` to `FirebaseContextType`
- [x] Add `role` state to provider
- [x] Fetch role from Firestore on auth state change (`users/{uid}` document)
- [x] Default to `'owner'` if no role field exists (backwards compatible)
- [x] Clear role on logout
- [x] Export role in context value

### Task 2.2: Create `src/hooks/usePermissions.ts`
- [x] Create new file
- [x] Import `useUser` from `@/firebase/provider`
- [x] Import `hasPermission` from `@/lib/permissions`
- [x] Import types from `@/types/rbac`
- [x] Implement `usePermissions()` hook with:
  - `can(action, module)` function
  - `role` - current user role
  - `isOwner`, `isAccountant`, `isViewer` - boolean helpers
  - `canWrite` - true if role can write (not viewer)
- [x] Add JSDoc comments

### Task 2.3: Create `src/components/auth/PermissionGate.tsx`
- [x] Create `PermissionGate` component
- [x] Props: `action`, `module`, `children`, `fallback`
- [x] Use `usePermissions` to check access
- [x] Render children if allowed, fallback otherwise
- [x] Add JSDoc comments

### Task 2.4: Create barrel exports
- [x] Create `src/hooks/index.ts` with `usePermissions` export
- [x] Create `src/components/auth/index.ts` with `PermissionGate` export

### Verification
- [x] Run `npx tsc --noEmit` - PASSED
- [x] Run `npm run lint` - PASSED (pre-existing warnings only)
- [x] Run `npm test` - PASSED (1150 tests, 44 suites)

---

## Review

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/firebase/provider.tsx` | **MODIFY** | Added role to auth context |
| `src/hooks/usePermissions.ts` | **CREATE** | Permissions hook |
| `src/components/auth/PermissionGate.tsx` | **CREATE** | Permission gate component |
| `src/hooks/index.ts` | **CREATE** | Hooks barrel export |
| `src/components/auth/index.ts` | **CREATE** | Auth components barrel export |

### Summary of Changes

#### `src/firebase/provider.tsx` (MODIFIED)
- Added `UserRole` import from `@/types/rbac`
- Added `doc, getDoc` imports from `firebase/firestore`
- Extended `FirebaseContextType` with `role: UserRole | null`
- Added `role` state with `useState<UserRole | null>(null)`
- On auth state change:
  - Fetches user document from `users/{uid}`
  - Extracts role field, defaults to `'owner'` if missing
  - Handles errors gracefully (defaults to owner)
- Clears role on sign out
- Exports role in context value

#### `src/hooks/usePermissions.ts` (NEW)
- `usePermissions()` hook with:
  - `can(action, module)` - check specific permission
  - `role` - current user role
  - `isOwner` - boolean helper
  - `isAccountant` - boolean helper
  - `isViewer` - boolean helper
  - `canWrite` - true if not viewer and not null
- Full JSDoc documentation with Arabic comments
- TypeScript interface `UsePermissionsReturn`

#### `src/components/auth/PermissionGate.tsx` (NEW)
- React component for conditional rendering
- Props: `action`, `module`, `children`, `fallback`
- Uses `usePermissions` hook internally
- Returns children if permitted, fallback otherwise
- JSDoc with usage examples

#### Barrel Exports (NEW)
- `src/hooks/index.ts` - exports all hooks including `usePermissions`
- `src/components/auth/index.ts` - exports `PermissionGate`

### Test Results
```
TypeScript: PASSED (no errors)
ESLint: PASSED (pre-existing warnings only)
Tests: PASSED (1150 tests, 44 suites)
```

### Usage Examples

```tsx
// Check permission in component
const { can, isOwner, canWrite } = usePermissions();

if (can('delete', 'ledger')) {
  // Show delete button
}

// Conditional rendering
<PermissionGate action="create" module="clients">
  <CreateClientButton />
</PermissionGate>

// With fallback
<PermissionGate
  action="update"
  module="settings"
  fallback={<p>ليس لديك صلاحية</p>}
>
  <SettingsForm />
</PermissionGate>
```

---

## Status: COMPLETED - READY FOR PR
