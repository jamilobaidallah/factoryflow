# Task: RBAC Phase 3 - Firestore Security Rules

## Branch
`feature/rbac-firestore-rules`

---

## Context
Phase 1 & 2 complete. We have frontend RBAC. Now securing backend with Firestore rules.

---

## Plan

### Task 3.1: Update `firestore.rules` with RBAC
- [x] Add `getUserRole(userId)` helper function
- [x] Add `isRoleOwner(userId)` - checks if role is 'owner'
- [x] Add `canWrite(userId)` - owner OR accountant can write
- [x] Add `canRead(userId)` - any role can read (owner, accountant, viewer)
- [x] Update all collection rules to use role-based access
- [x] Keep all existing validation logic unchanged
- [x] Add `access_requests` collection for self-registration

### Task 3.2: Update `storage.rules` with RBAC
- [x] Document Storage rules limitation (cannot access Firestore)
- [x] Keep existing image validation
- [x] Note: RBAC for storage enforced at application level

### Task 3.3: Create `docs/firestore-rules.md`
- [x] Document RBAC rules structure
- [x] Explain role hierarchy
- [x] Include deployment instructions
- [x] Add testing guide
- [x] Document performance considerations (get() calls)

### Verification
- [x] Rules syntax reviewed
- [x] Backwards compatible (existing users without role = owner)
- [x] TypeScript check - PASSED
- [x] Lint check - PASSED

---

## Review

### Files Changed

| File | Action | Description |
|------|--------|-------------|
| `firestore.rules` | **MODIFY** | Added RBAC helper functions |
| `storage.rules` | **MODIFY** | Added comments about RBAC limitation |
| `docs/firestore-rules.md` | **CREATE** | Full documentation |

### Summary of Changes

#### `firestore.rules` (MODIFIED)
- **New Helper Functions:**
  - `getUserRole(userId)` - Fetches role from user doc, defaults to 'owner'
  - `isRoleOwner(userId)` - Checks if role is 'owner'
  - `canWrite(userId)` - Owner OR accountant
  - `canRead(userId)` - Owner, accountant, OR viewer
- **Updated Collections:** All subcollections now check `canRead()` for read and `canWrite()` for write
- **New Collection:** `access_requests` for self-registration flow
- **Preserved:** All existing validation logic (field requirements, type checks)

#### `storage.rules` (MODIFIED)
- Added comments explaining Storage rules cannot access Firestore
- RBAC for storage is enforced at application level
- Kept existing image validation (type and size)

#### `docs/firestore-rules.md` (NEW)
- Role hierarchy explanation
- Permission matrix
- How `getUserRole()` works
- **Performance section:** Explains `get()` call costs and caching behavior
- Data structure documentation
- Deployment commands
- Testing instructions
- Troubleshooting guide

### Key Design Decisions

1. **Backwards Compatibility:** Users without `role` field default to `'owner'`
2. **Storage Limitation:** Firebase Storage rules cannot use `get()` to access Firestore, so RBAC is enforced at app level
3. **Catch-all Rule:** Added `match /{collection}/{docId}` to handle any unlisted subcollections

### Verification Results
```
TypeScript: PASSED (no errors)
ESLint: PASSED (pre-existing warnings only)
Firebase CLI: Available (v14.26.0)
```

### Deployment Command
```bash
firebase deploy --only firestore:rules,storage:rules
```

---

## Status: COMPLETED - READY FOR PR
