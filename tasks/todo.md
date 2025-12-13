# Task: Fix Role Change Error

## Branch
`fix/role-change-error`

---

## Problem
When owner changes a member's role on /users page:
1. Error toast appears: "حدث خطأ أثناء تحديث الدور"
2. But after refresh, role IS changed correctly

## Root Cause
In `userService.ts`, `updateUserRole` updates two locations:
1. `/users/{ownerId}/members/{memberUid}` - **succeeds** (owner can write to own subcollections)
2. `/users/{memberUid}` - **fails** (security rules block owner from updating another user's document)

**Firestore rule (line 102):**
```javascript
allow write: if isDataOwner(userId);
```
This only allows users to update their OWN document.

## Solution
Add a new rule to allow owners to update their team members' documents:
```javascript
allow update: if isAuthenticated()
  && resource.data.ownerId == request.auth.uid
  && isRoleOwner(request.auth.uid);
```

This allows:
- Owner to update user docs where `ownerId` matches the owner's uid
- Only if the current user has `owner` role

---

## Files Modified
| File | Change |
|------|--------|
| `firestore.rules` | Added rule for owners to update team member documents |

---

## Status: COMPLETED
