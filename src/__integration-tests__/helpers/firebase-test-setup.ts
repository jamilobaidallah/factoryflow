/**
 * Firebase Emulator Test Setup
 *
 * Provides utilities for integration testing with Firebase Emulator.
 * Used to test real Firestore operations without mocking.
 */

import {
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { Firestore } from 'firebase/firestore';

let testEnv: RulesTestEnvironment | null = null;

/**
 * Initialize Firebase Emulator for testing
 */
export async function setupFirebaseTest(projectId: string = 'test-project') {
  // Read Firestore rules
  const rulesPath = resolve(__dirname, '../../../firestore.rules');
  const rules = readFileSync(rulesPath, 'utf8');

  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: 'localhost',
      port: 8080,
      rules,
    },
  });

  return testEnv;
}

/**
 * Get authenticated Firestore instance for testing
 */
export function getAuthenticatedFirestore(userId: string, dataOwnerId?: string): Firestore {
  if (!testEnv) {
    throw new Error('Test environment not initialized. Call setupFirebaseTest() first.');
  }

  return testEnv.authenticatedContext(userId, {
    dataOwnerId: dataOwnerId || userId,
    email: `${userId}@test.com`,
  }).firestore() as unknown as Firestore;
}

/**
 * Get unauthenticated Firestore instance for testing
 */
export function getUnauthenticatedFirestore(): Firestore {
  if (!testEnv) {
    throw new Error('Test environment not initialized. Call setupFirebaseTest() first.');
  }

  return testEnv.unauthenticatedContext().firestore() as unknown as Firestore;
}

/**
 * Clear all Firestore data (run between tests)
 */
export async function clearFirestoreData() {
  if (!testEnv) {
    throw new Error('Test environment not initialized.');
  }

  await testEnv.clearFirestore();
}

/**
 * Cleanup and destroy test environment
 */
export async function cleanupFirebaseTest() {
  if (testEnv) {
    await testEnv.cleanup();
    testEnv = null;
  }
}

/**
 * Helper to create test user data
 */
export function createTestUser(userId: string = 'test-user-123') {
  return {
    uid: userId,
    dataOwnerId: userId,
    email: `${userId}@test.com`,
    role: 'owner' as const,
  };
}

/**
 * Helper to seed test data into Firestore
 */
export async function seedFirestoreData(
  db: Firestore,
  dataOwnerId: string,
  collections: {
    ledger?: any[];
    payments?: any[];
    journal_entries?: any[];
    clients?: any[];
  }
) {
  const { collection, doc, setDoc } = await import('firebase/firestore');

  // Seed ledger entries
  if (collections.ledger) {
    for (const entry of collections.ledger) {
      const ref = doc(collection(db, `users/${dataOwnerId}/ledger`));
      await setDoc(ref, { ...entry, id: ref.id });
    }
  }

  // Seed payments
  if (collections.payments) {
    for (const payment of collections.payments) {
      const ref = doc(collection(db, `users/${dataOwnerId}/payments`));
      await setDoc(ref, { ...payment, id: ref.id });
    }
  }

  // Seed journal entries
  if (collections.journal_entries) {
    for (const entry of collections.journal_entries) {
      const ref = doc(collection(db, `users/${dataOwnerId}/journal_entries`));
      await setDoc(ref, { ...entry, id: ref.id });
    }
  }

  // Seed clients
  if (collections.clients) {
    for (const client of collections.clients) {
      const ref = doc(collection(db, `users/${dataOwnerId}/clients`));
      await setDoc(ref, { ...client, id: ref.id });
    }
  }
}
