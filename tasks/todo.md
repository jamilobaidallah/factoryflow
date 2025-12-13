# Task: RBAC Phase 6 - UI Polish for Roles

## Branch
`feature/rbac-ui-polish`

---

## Context
Most RBAC UI is already implemented. Need to polish role badge styling and add mobile visibility.

**Already Done:**
- `usePermissions` hook exists with `can`, `role`, `isOwner`, `canWrite`
- `PermissionGate` component wraps all Add/Edit/Delete buttons across all pages
- Role badge exists in header (desktop only)
- Admin nav group hidden for non-owners in sidebar

---

## Plan

### Task 1: Add Role-Specific Badge Colors
- [x] Update header.tsx with role-specific colors

### Task 2: Add Role Badge to Mobile Nav
- [x] Import usePermissions and USER_ROLE_LABELS
- [x] Add role badge in the Sheet header

### Task 3: Verify Changes
- [x] TypeScript check passes
- [x] Build succeeds

---

## Review

### Changes Made

| File | Change |
|------|--------|
| `src/components/layout/header.tsx` | Added `ROLE_BADGE_STYLES` constant with role-specific colors, updated badge to use `cn()` with dynamic styles |
| `src/components/layout/mobile-nav.tsx` | Added imports for usePermissions, USER_ROLE_LABELS, UserRole. Added ROLE_BADGE_STYLES. Added role badge to mobile menu Sheet header |

### Role Badge Styles
- **owner (مالك)**: `bg-primary/10 text-primary` (indigo)
- **accountant (محاسب)**: `bg-blue-100 text-blue-700` (blue)
- **viewer (مشاهد)**: `bg-slate-100 text-slate-600` (gray)

### Summary
- **2 files modified**
- Role badges now show on both desktop header and mobile menu
- Role-specific colors provide visual distinction between roles

---

## Status: COMPLETED
