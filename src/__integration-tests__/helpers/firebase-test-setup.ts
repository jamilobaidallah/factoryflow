/**
 * Firebase Emulator Test Setup
 *
 * Configures the Firebase SDK to use the local emulator for testing.
 * This allows testing real service code (like LedgerService) against the emulator.
 */

// IMPORTANT: Set environment variable BEFORE importing Firebase
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';

const TEST_PROJECT_ID = 'test-project';

let isInitialized = false;

/**
 * Initialize Firebase for testing with emulator
 */
export async function setupFirebaseTest() {
  if (isInitialized) {return;}

  // Clear any existing apps
  const apps = getApps();
  for (const app of apps) {
    await deleteApp(app);
  }

  // Initialize with test project
  const app = initializeApp({
    projectId: TEST_PROJECT_ID,
    apiKey: 'fake-api-key-for-testing',
    authDomain: `${TEST_PROJECT_ID}.firebaseapp.com`,
  });

  // Connect to emulator
  const db = getFirestore(app);

  // Note: connectFirestoreEmulator should only be called once
  // The FIRESTORE_EMULATOR_HOST env var handles this automatically

  isInitialized = true;

  return { app, db };
}

/**
 * Clear all Firestore data using emulator REST API
 */
export async function clearFirestoreData() {
  try {
    const response = await fetch(
      `http://localhost:8080/emulator/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`,
      { method: 'DELETE' }
    );

    if (!response.ok) {
      console.warn('Failed to clear Firestore data:', response.statusText);
    }
  } catch (error) {
    console.warn('Could not clear Firestore data:', error);
  }
}

/**
 * Cleanup Firebase test environment
 */
export async function cleanupFirebaseTest() {
  const apps = getApps();
  for (const app of apps) {
    try {
      const db = getFirestore(app);
      await terminate(db);
      await deleteApp(app);
    } catch (error) {
      // Ignore cleanup errors
    }
  }
  isInitialized = false;
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
 * Helper to seed test data into Firestore via emulator REST API
 * This bypasses security rules for test setup
 */
export async function seedFirestoreData(
  dataOwnerId: string,
  collections: {
    ledger?: Array<{ id: string; [key: string]: unknown }>;
    payments?: Array<{ id: string; [key: string]: unknown }>;
    journal_entries?: Array<{ id: string; [key: string]: unknown }>;
    clients?: Array<{ id: string; [key: string]: unknown }>;
  }
) {
  const baseUrl = `http://localhost:8080/v1/projects/${TEST_PROJECT_ID}/databases/(default)/documents`;

  const seedCollection = async (collectionName: string, documents: Array<{ id: string; [key: string]: unknown }>) => {
    for (const doc of documents) {
      const { id, ...data } = doc;
      const docPath = `users/${dataOwnerId}/${collectionName}/${id}`;

      // Convert to Firestore REST format
      const fields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'string') {
          fields[key] = { stringValue: value };
        } else if (typeof value === 'number') {
          fields[key] = { doubleValue: value };
        } else if (typeof value === 'boolean') {
          fields[key] = { booleanValue: value };
        } else if (value instanceof Date) {
          fields[key] = { timestampValue: value.toISOString() };
        } else if (value === null) {
          fields[key] = { nullValue: null };
        }
      }

      try {
        await fetch(`${baseUrl}/${docPath}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields }),
        });
      } catch (error) {
        console.warn(`Failed to seed ${collectionName}/${id}:`, error);
      }
    }
  };

  if (collections.ledger) {
    await seedCollection('ledger', collections.ledger);
  }
  if (collections.payments) {
    await seedCollection('payments', collections.payments);
  }
  if (collections.journal_entries) {
    await seedCollection('journal_entries', collections.journal_entries);
  }
  if (collections.clients) {
    await seedCollection('clients', collections.clients);
  }
}
