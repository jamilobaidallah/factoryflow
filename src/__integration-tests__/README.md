# Integration Tests

Integration tests for FactoryFlow that use **Firebase Emulator** to test real Firestore operations without mocking.

## Why Integration Tests?

For accounting systems, **integration tests are critical** because:

1. **Mocks can't catch accounting bugs**: Unit tests with mocks wouldn't have caught bugs like:
   - Capital entries not creating journal entries
   - Loan transactions creating incorrect journal entries
   - Trial Balance becoming unbalanced

2. **Real data flow validation**: Integration tests verify the entire data flow from service → Firestore → query results

3. **Debits = Credits validation**: Integration tests can verify Trial Balance is balanced after operations

## Setup

### Prerequisites

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Install Firebase testing tools** (already in package.json):
   ```bash
   npm install --save-dev @firebase/rules-unit-testing
   ```

3. **Start Firebase Emulator** (one-time per test session):
   ```bash
   firebase emulators:start --only firestore
   ```

   Leave this running in a separate terminal window.

## Running Tests

### Run all integration tests:
```bash
npm run test:integration
```

### Run in watch mode (for development):
```bash
npm run test:integration:watch
```

### Run both unit and integration tests:
```bash
npm run test:all
```

## Writing Integration Tests

### Basic Structure

```typescript
import {
  setupFirebaseTest,
  cleanupFirebaseTest,
  clearFirestoreData,
  getAuthenticatedFirestore,
  createTestUser,
  seedFirestoreData,
} from './helpers/firebase-test-setup';

describe('Feature Integration Tests', () => {
  const testUser = createTestUser();
  let db: any;

  beforeAll(async () => {
    // Start Firebase Emulator
    await setupFirebaseTest();
    db = getAuthenticatedFirestore(testUser.uid, testUser.dataOwnerId);
  });

  afterAll(async () => {
    // Stop Firebase Emulator
    await cleanupFirebaseTest();
  });

  beforeEach(async () => {
    // Clear all data between tests
    await clearFirestoreData();
  });

  it('should test actual behavior', async () => {
    // 1. Seed initial data
    await seedFirestoreData(db, testUser.dataOwnerId, {
      ledger: [{ /* data */ }],
    });

    // 2. Execute service operation
    const service = createLedgerService(testUser.dataOwnerId, testUser.email, 'owner');
    const result = await service.someOperation();

    // 3. Verify results in Firestore
    const snapshot = await getDocs(collection(db, 'users/...'));
    expect(snapshot.size).toBe(1);

    // 4. Verify Trial Balance
    // ... calculate debits and credits ...
    expect(totalDebits).toBeCloseTo(totalCredits, 2);
  });
});
```

### What to Test

✅ **DO test**:
- Complete workflows (create ledger → add payment → verify journal)
- Accounting correctness (debits = credits)
- Balance updates (client balances, account balances)
- Data relationships (linkedTransactionId, linkedPaymentId)
- Error scenarios (if possible to simulate)

❌ **DON'T test**:
- UI rendering (use component tests)
- Individual functions in isolation (use unit tests)
- External APIs (use mocks for those)

## Test Organization

```
src/__integration-tests__/
├── README.md                          # This file
├── helpers/
│   └── firebase-test-setup.ts         # Emulator setup utilities
├── payment-flow.integration.test.ts   # Payment workflow tests
├── capital-flow.integration.test.ts   # Capital transactions (future)
└── loan-flow.integration.test.ts      # Loan transactions (future)
```

## Debugging Integration Tests

### Check Firestore Emulator UI

While tests are running, open: http://localhost:4000

You can see:
- Collections created during tests
- Document contents
- Query results

### Enable Firebase Logging

```typescript
// In your test file
import { setLogLevel } from 'firebase/firestore';
setLogLevel('debug');
```

### Common Issues

**Issue**: Tests timeout
- **Solution**: Increase timeout in jest.integration.config.js (default: 30s)

**Issue**: "Error: Could not connect to emulator"
- **Solution**: Make sure Firebase Emulator is running: `firebase emulators:start --only firestore`

**Issue**: Tests pass individually but fail when run together
- **Solution**: Ensure `clearFirestoreData()` is called in `beforeEach`

## CI/CD Integration

Integration tests require Firebase Emulator to be running. For CI pipelines:

1. **GitHub Actions example**:
   ```yaml
   - name: Start Firebase Emulator
     run: firebase emulators:start --only firestore &

   - name: Wait for emulator
     run: sleep 5

   - name: Run integration tests
     run: npm run test:integration
   ```

2. **Local development**: Start emulator manually before running tests

## Performance

- Integration tests are **slower** than unit tests (Firebase operations take time)
- Run **serially** (`maxWorkers: 1` in jest.integration.config.js) to avoid conflicts
- Use integration tests for **critical accounting paths**, unit tests for everything else

## Migration Strategy

We're gradually replacing flaky unit tests with integration tests:

| Test File | Status | Approach |
|-----------|--------|----------|
| QuickPayDialog.test.tsx | ❌ Flaky (18 failures) | → Integration tests |
| payment-flow.integration.test.ts | ✅ Implemented | Integration tests |
| capital-flow.integration.test.ts | 📅 Planned | Integration tests |
| loan-flow.integration.test.ts | 📅 Planned | Integration tests |

---

**Last Updated**: 2026-02-02
