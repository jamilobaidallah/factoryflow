# Firestore Security Rules - RBAC Documentation

## Overview

FactoryFlow uses Role-Based Access Control (RBAC) to manage user permissions at both the frontend and backend levels. This document explains how Firestore security rules enforce RBAC.

## Role Hierarchy

| Role | Arabic | Description |
|------|--------|-------------|
| `owner` | مالك | Full access to all features and data |
| `accountant` | محاسب | Can read and write data, but cannot manage users |
| `viewer` | مشاهد | Read-only access to all data |

## Permission Matrix

| Operation | Owner | Accountant | Viewer |
|-----------|:-----:|:----------:|:------:|
| Read data | ✅ | ✅ | ✅ |
| Create data | ✅ | ✅ | ❌ |
| Update data | ✅ | ✅ | ❌ |
| Delete data | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Access settings | ✅ | ❌ | ❌ |

## How Role Checking Works

### Firestore Rules

The rules use a `getUserRole()` helper function to fetch the user's role:

```javascript
function getUserRole(userId) {
  let userDoc = get(/databases/$(database)/documents/users/$(userId));
  return userDoc.data.role != null ? userDoc.data.role : 'owner';
}
```

This function:
1. Fetches the user document from `users/{userId}`
2. Returns the `role` field if it exists
3. Defaults to `'owner'` for backwards compatibility

### Permission Helpers

```javascript
// Can write: owner or accountant
function canWrite(userId) {
  let role = getUserRole(userId);
  return role == 'owner' || role == 'accountant';
}

// Can read: any valid role
function canRead(userId) {
  let role = getUserRole(userId);
  return role == 'owner' || role == 'accountant' || role == 'viewer';
}
```

## Performance Considerations

### Document Reads from `get()` Calls

**Important:** Each call to `getUserRole()` results in a Firestore document read, which:
- Counts towards your Firestore read quota
- Adds latency to security rule evaluation

### Caching Behavior

Firestore security rules cache `get()` results within the same request:
- Multiple calls to `getUserRole(userId)` with the same `userId` in one request share a single read
- The cache does NOT persist across different requests

### Cost Implications

| Scenario | Additional Reads per Request |
|----------|------------------------------|
| Single read operation | 1 (for role check) |
| Single write operation | 1 (for role check) |
| Batch read (10 docs) | 1 (cached across batch) |
| Batch write (10 docs) | 1 (cached across batch) |

### Optimization Tips

1. **Batch operations**: Group reads/writes together to benefit from caching
2. **Consider Custom Claims**: For high-traffic apps, use Firebase Custom Claims instead of Firestore lookups
3. **Monitor usage**: Track Firestore reads in Firebase Console

## Data Structure

```
users/{userId}/
├── role: string          // 'owner' | 'accountant' | 'viewer'
├── email: string
├── displayName: string
├── clients/
├── ledger/
├── payments/
├── cheques/
├── inventory/
├── employees/
├── partners/
├── fixedAssets/
├── invoices/
└── production/

access_requests/{requestId}/
├── uid: string           // Requester's user ID
├── email: string
├── displayName: string
├── targetOwnerId: string // Owner who receives the request
├── requestedAt: timestamp
└── status: string        // 'pending' | 'approved' | 'rejected'
```

## Backwards Compatibility

For existing users without a `role` field:
- **Firestore rules**: Default to `'owner'`
- **Frontend code**: Default to `'owner'`

This ensures existing users continue to work without any migration.

## Deployment

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Storage Rules

```bash
firebase deploy --only storage:rules
```

### Deploy Both

```bash
firebase deploy --only firestore:rules,storage:rules
```

### Verify Deployment

```bash
firebase firestore:rules:get
```

## Testing Rules Locally

### Using Firebase Emulator

1. Start the emulator:
   ```bash
   firebase emulators:start --only firestore
   ```

2. Run tests against emulator:
   ```bash
   npm run test:firestore-rules
   ```

### Manual Testing in Firebase Console

1. Go to Firebase Console → Firestore → Rules Playground
2. Select operation type (get, list, create, update, delete)
3. Enter the path and authentication context
4. Click "Run" to test

### Test Scenarios

| Test Case | Path | Auth | Expected |
|-----------|------|------|----------|
| Owner reads ledger | `/users/{uid}/ledger/{id}` | `{ uid: "{uid}", role: "owner" }` | ✅ Allow |
| Viewer reads ledger | `/users/{uid}/ledger/{id}` | `{ uid: "{uid}", role: "viewer" }` | ✅ Allow |
| Viewer creates ledger | `/users/{uid}/ledger/{id}` | `{ uid: "{uid}", role: "viewer" }` | ❌ Deny |
| Accountant creates client | `/users/{uid}/clients/{id}` | `{ uid: "{uid}", role: "accountant" }` | ✅ Allow |
| Unauthenticated read | `/users/{uid}/ledger/{id}` | `null` | ❌ Deny |

## Storage Rules Limitation

**Note:** Firebase Storage rules cannot use `get()` to access Firestore documents. Therefore:
- Storage rules rely on data ownership (`request.auth.uid == userId`)
- RBAC for storage uploads is enforced at the application level
- For stricter control, consider using Firebase Custom Claims

## Troubleshooting

### "Permission Denied" Errors

1. Check if user is authenticated
2. Verify the user's `role` field exists in their document
3. Ensure the user is accessing their own data path
4. Check if the role has the required permission

### Debug with Logs

Add debug logging in Firebase Console:
1. Go to Firestore → Rules
2. Enable "Debug mode" in Rules Playground
3. Review the evaluation trace

## Future Improvements

1. **Custom Claims**: Move role to Firebase Auth custom claims for better performance
2. **Multi-tenancy**: Support multiple organizations per user
3. **Granular Permissions**: Per-collection permission overrides
