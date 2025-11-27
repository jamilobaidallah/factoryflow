'use client';

import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  Timestamp,
  deleteDoc
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';

export interface BackupData {
  metadata: {
    createdAt: string;
    version: string;
    collections: string[];
    totalDocuments: number;
  };
  data: {
    ledger: any[];
    payments: any[];
    cheques: any[];
    inventory: any[];
    clients: any[];
    partners: any[];
    suppliers: any[];
    assets: any[];
  };
}

/**
 * Create a full backup of all Firestore collections
 * @param userId User ID to backup data for
 * @returns Backup data object
 */
export async function createBackup(userId: string): Promise<BackupData> {
  const collections = ['ledger', 'payments', 'cheques', 'inventory', 'clients', 'partners', 'fixedAssets', 'employees'];
  const collectionMapping: { [key: string]: string } = {
    'fixedAssets': 'assets',
    'employees': 'suppliers' // Keep 'suppliers' key for backward compatibility
  };

  const backupData: BackupData = {
    metadata: {
      createdAt: new Date().toISOString(),
      version: '1.0.0',
      collections: collections,
      totalDocuments: 0,
    },
    data: {
      ledger: [],
      payments: [],
      cheques: [],
      inventory: [],
      clients: [],
      partners: [],
      suppliers: [],
      assets: [],
    },
  };

  // Backup each collection
  for (const collectionName of collections) {
    try {
      // Use correct user-specific path
      const collectionRef = collection(firestore, `users/${userId}/${collectionName}`);
      const q = query(collectionRef);
      const snapshot = await getDocs(q);

      const documents = snapshot.docs.map((doc) => {
        const data = doc.data();

        // Convert Firestore Timestamps to ISO strings for JSON serialization
        const serializedData: any = { id: doc.id };

        Object.keys(data).forEach((key) => {
          if (data[key] instanceof Timestamp) {
            serializedData[key] = data[key].toDate().toISOString();
          } else if (data[key] instanceof Date) {
            serializedData[key] = data[key].toISOString();
          } else {
            serializedData[key] = data[key];
          }
        });

        return serializedData;
      });

      // Map collection names to backup data keys
      const dataKey = collectionMapping[collectionName] || collectionName;
      backupData.data[dataKey as keyof typeof backupData.data] = documents;
      backupData.metadata.totalDocuments += documents.length;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error backing up ${collectionName}:`, error);
      throw new Error(`Failed to backup ${collectionName}: ${error}`);
    }
  }

  return backupData;
}

/**
 * Download backup data as JSON file
 * @param backupData Backup data to download
 * @param filename Custom filename (optional)
 */
export function downloadBackup(backupData: BackupData, filename?: string): void {
  const defaultFilename = `factoryflow_backup_${new Date().toISOString().split('T')[0]}.json`;
  const json = JSON.stringify(backupData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Validate backup file structure
 * @param data Parsed backup data
 * @returns True if valid, throws error if invalid
 */
export function validateBackup(data: any): data is BackupData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file: Not a valid JSON object');
  }

  if (!data.metadata || !data.data) {
    throw new Error('Invalid backup file: Missing metadata or data sections');
  }

  const requiredCollections = ['ledger', 'payments', 'cheques', 'inventory', 'clients', 'partners', 'suppliers', 'assets'];

  for (const collection of requiredCollections) {
    if (!Array.isArray(data.data[collection])) {
      throw new Error(`Invalid backup file: Collection '${collection}' is missing or not an array`);
    }
  }

  return true;
}

/**
 * Restore data from backup
 * @param backupData Backup data to restore
 * @param userId User ID to restore data for
 * @param mode 'replace' to clear existing data, 'merge' to keep existing data
 * @param onProgress Callback for progress updates
 */
export async function restoreBackup(
  backupData: BackupData,
  userId: string,
  mode: 'replace' | 'merge' = 'merge',
  onProgress?: (progress: number, message: string) => void
): Promise<void> {
  // Validate backup first
  validateBackup(backupData);

  const collections = Object.keys(backupData.data) as Array<keyof typeof backupData.data>;
  const totalCollections = collections.length;
  let processedCollections = 0;

  // Reverse mapping from backup keys to Firestore collection names
  const reverseMapping: { [key: string]: string } = {
    'assets': 'fixedAssets',
    'suppliers': 'employees'
  };

  for (const collectionName of collections) {
    const documents = backupData.data[collectionName];

    if (documents.length === 0) {
      processedCollections++;
      continue;
    }

    try {
      // Map backup keys to actual Firestore collection names
      const actualCollectionName = reverseMapping[collectionName] || collectionName;
      const collectionRef = collection(firestore, `users/${userId}/${actualCollectionName}`);

      // If replace mode, delete existing documents first
      if (mode === 'replace') {
        if (onProgress) {
          onProgress(
            Math.round((processedCollections / totalCollections) * 100),
            `Clearing existing ${collectionName} data...`
          );
        }

        const existingDocs = await getDocs(query(collectionRef));
        const deletePromises = existingDocs.docs.map((docSnapshot) =>
          deleteDoc(docSnapshot.ref)
        );
        await Promise.all(deletePromises);
      }
      const batchSize = 500; // Firestore batch limit

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = writeBatch(firestore);
        const batchDocs = documents.slice(i, Math.min(i + batchSize, documents.length));

        for (const docData of batchDocs) {
          const { id, ...data } = docData;

          // Convert ISO strings back to Timestamps
          const firestoreData: any = {};
          Object.keys(data).forEach((key) => {
            if (typeof data[key] === 'string' && data[key].match(/^\d{4}-\d{2}-\d{2}T/)) {
              try {
                firestoreData[key] = Timestamp.fromDate(new Date(data[key]));
              } catch {
                firestoreData[key] = data[key];
              }
            } else {
              firestoreData[key] = data[key];
            }
          });

          const docRef = doc(collectionRef, id);
          batch.set(docRef, firestoreData, { merge: mode === 'merge' });
        }

        await batch.commit();

        if (onProgress) {
          const progress = Math.round(((processedCollections + (i / documents.length)) / totalCollections) * 100);
          onProgress(progress, `Restoring ${collectionName}... (${i + batchDocs.length}/${documents.length})`);
        }
      }

      processedCollections++;

      if (onProgress) {
        const progress = Math.round((processedCollections / totalCollections) * 100);
        onProgress(progress, `Completed ${collectionName}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error restoring ${collectionName}:`, error);
      throw new Error(`Failed to restore ${collectionName}: ${error}`);
    }
  }

  if (onProgress) {
    onProgress(100, 'Restore completed!');
  }
}

/**
 * Create an automatic backup before restore operation
 * This creates a safety backup of current data before restoring from a file
 * @param userId User ID to backup data for
 * @param download Whether to automatically download the backup (default: true)
 * @returns Backup data object
 */
export async function createAutoBackupBeforeRestore(
  userId: string,
  download: boolean = true
): Promise<BackupData> {
  const backupData = await createBackup(userId);

  if (download) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `factoryflow_auto_backup_before_restore_${timestamp}.json`;
    downloadBackup(backupData, filename);
  }

  return backupData;
}

/**
 * Parse uploaded backup file
 * @param file File object from input
 * @returns Parsed backup data
 */
export async function parseBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        // Validate before returning
        if (validateBackup(data)) {
          resolve(data);
        }
      } catch (error) {
        reject(new Error(`Failed to parse backup file: ${error}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
