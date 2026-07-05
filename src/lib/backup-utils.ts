'use client';

import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
  Timestamp,
  deleteDoc,
  limit,
  orderBy,
  documentId,
  type WriteBatch,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { paginateAll } from './firestore-pagination';
import { getJournalEntries } from '@/services/journalService';
import { ACCOUNTING_TOLERANCE } from './constants';
import { safeAdd } from './currency';

/**
 * Commit a batch of Firestore writeBatches with a bounded concurrency
 * ceiling. Introduced for Tier-2 P5 — the previous sequential loop over
 * batches was the dominant latency in restore for large collections
 * (10 batches × ~2 s per commit ≈ 20 s total). With `concurrency = 5`
 * we get ~5× parallel speedup without bursting far past Firestore's
 * 500 writes/sec write-quota (5 concurrent × 500 writes = 2 500 writes
 * in flight; well below the 10 000-writes/sec hard cap).
 *
 * Uses `Promise.allSettled` so a single-batch failure does NOT abort
 * remaining commits — we WANT all the successful ones to land, and
 * then we surface any rejected batches so the caller can decide how
 * to handle partial state.
 *
 * Returns a { completed, failed, results } summary. The `onBatchDone`
 * callback is invoked after each individual batch settles (regardless
 * of order) so progress bars stay monotonic — this is the "completed
 * counter" the audit called out.
 */
async function commitBatchesWithCap(
  batches: WriteBatch[],
  concurrency: number,
  onBatchDone?: (completedSoFar: number, total: number) => void,
): Promise<{
  completed: number;
  failed: number;
  results: PromiseSettledResult<void>[];
}> {
  const total = batches.length;
  let completed = 0;
  const allResults: PromiseSettledResult<void>[] = [];

  for (let i = 0; i < batches.length; i += concurrency) {
    const chunk = batches.slice(i, i + concurrency);
    // Wrap each commit so onBatchDone fires as each settles, not after
    // the whole chunk. Progress stays smooth even if one commit in the
    // chunk is slow.
    const wrapped = chunk.map((b) =>
      b.commit().then(
        () => {
          completed++;
          onBatchDone?.(completed, total);
        },
        (err) => {
          completed++;
          onBatchDone?.(completed, total);
          throw err;
        },
      ),
    );
    const chunkResults = await Promise.allSettled(wrapped);
    allResults.push(...chunkResults);
  }

  const failed = allResults.filter((r) => r.status === 'rejected').length;
  return { completed: total, failed, results: allResults };
}

/** Backup document type - allows any valid Firestore data structure */
type BackupDocument = Record<string, unknown> & { id: string };

export interface BackupData {
  metadata: {
    createdAt: string;
    version: string;
    collections: string[];
    totalDocuments: number;
  };
  data: {
    ledger: BackupDocument[];
    payments: BackupDocument[];
    cheques: BackupDocument[];
    inventory: BackupDocument[];
    clients: BackupDocument[];
    partners: BackupDocument[];
    suppliers: BackupDocument[];
    assets: BackupDocument[];
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

  // Backup each collection.
  //
  // Scale-hardening Tier-1, Fix 3: the previous code used
  // `query(collectionRef, limit(10000))` as a "safety cap". Past 10 000 docs
  // per collection the backup silently truncated — restoring produced an
  // incomplete database with no warning. Replaced with cursor pagination
  // through `paginateAll` so we always get every doc.
  //
  // `orderBy(documentId())` gives us a stable sort so the cursor works, and
  // it doesn't require a composite index (documentId is always indexable).
  for (const collectionName of collections) {
    try {
      const collectionRef = collection(firestore, `users/${userId}/${collectionName}`);
      const allDocs = await paginateAll(
        collectionRef,
        [orderBy(documentId())],
      );

      const documents = allDocs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;

        // Convert Firestore Timestamps to ISO strings for JSON serialization
        const serializedData: BackupDocument = { id: doc.id };

        Object.keys(data).forEach((key) => {
          if (data[key] instanceof Timestamp) {
            serializedData[key] = (data[key] as Timestamp).toDate().toISOString();
          } else if (data[key] instanceof Date) {
            serializedData[key] = (data[key] as Date).toISOString();
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
export function validateBackup(data: unknown): data is BackupData {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid backup file: Not a valid JSON object');
  }

  // Type narrow using 'in' operator
  if (!('metadata' in data) || !('data' in data)) {
    throw new Error('Invalid backup file: Missing metadata or data sections');
  }

  const backupData = data as { metadata: unknown; data: Record<string, unknown> };

  const requiredCollections = ['ledger', 'payments', 'cheques', 'inventory', 'clients', 'partners', 'suppliers', 'assets'];

  for (const collectionName of requiredCollections) {
    if (!Array.isArray(backupData.data[collectionName])) {
      throw new Error(`Invalid backup file: Collection '${collectionName}' is missing or not an array`);
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
/**
 * Result of `restoreBackup`. Currently only carries an optional integrity
 * warning: if the post-restore trial-balance check finds the books unbalanced,
 * we return that here so the UI can surface a red toast without erroring out
 * the whole restore (data IS in the DB — user just needs to know it's broken).
 */
export interface RestoreResult {
  warning?: {
    kind: 'unbalanced-books';
    totalDebits: number;
    totalCredits: number;
    difference: number;
  };
}

export async function restoreBackup(
  backupData: BackupData,
  userId: string,
  mode: 'replace' | 'merge' = 'merge',
  onProgress?: (progress: number, message: string) => void
): Promise<RestoreResult> {
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

      const batchSize = 500; // Firestore batch-write cap

      // ── DELETE phase (mode='replace' only) ───────────────────────
      //
      // Tier-2 P5: parallelize with a concurrency cap of 5. Previously
      // this loop ran ONE getDocs+deleteBatch commit at a time and
      // depended on the "limit(500) returns the first 500 undeleted
      // docs" behaviour to walk through the collection. We now:
      //   1. Read all doc refs up-front via paginateAll (cursored).
      //   2. Chunk into 500-doc delete batches.
      //   3. Commit 5 concurrent batches at a time via allSettled.
      //   4. If any batch fails, throw a clear "restore incomplete"
      //      error so the caller surfaces a red toast. The DELETE
      //      side has no natural mid-flight rollback anyway — the
      //      alternative pre-Tier-2 code had the same partial-failure
      //      exposure, just with a smaller window because it was serial.
      if (mode === 'replace') {
        onProgress?.(
          Math.round((processedCollections / totalCollections) * 100),
          `Clearing existing ${collectionName} data...`,
        );

        const allExistingSnaps = await paginateAll(
          collectionRef,
          [orderBy(documentId())],
        );
        if (allExistingSnaps.length > 0) {
          const deleteBatches: WriteBatch[] = [];
          for (let i = 0; i < allExistingSnaps.length; i += batchSize) {
            const b = writeBatch(firestore);
            for (const snap of allExistingSnaps.slice(i, i + batchSize)) {
              b.delete(snap.ref);
            }
            deleteBatches.push(b);
          }
          const { failed } = await commitBatchesWithCap(deleteBatches, 5, (done, total) => {
            onProgress?.(
              Math.round((processedCollections / totalCollections) * 100),
              `Clearing ${collectionName}... (${done}/${total} batches)`,
            );
          });
          if (failed > 0) {
            throw new Error(
              `Delete phase incomplete for ${collectionName}: ${failed}/${deleteBatches.length} batches failed. ` +
              'Database is in an inconsistent state — please re-run the restore.',
            );
          }
        }
      }

      // ── WRITE phase (both merge and replace modes) ───────────────
      //
      // Tier-2 P5: same pattern as the delete phase. Build all
      // batches first, then commit up to 5 at a time. Progress is
      // reported off a completed-counter, so parallel completion is
      // still monotonic (never regresses).
      const writeBatches: WriteBatch[] = [];
      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = writeBatch(firestore);
        const batchDocs = documents.slice(i, Math.min(i + batchSize, documents.length));

        for (const docData of batchDocs) {
          const { id, ...data } = docData;

          // Convert ISO strings back to Timestamps
          const firestoreData: Record<string, unknown> = {};
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

        writeBatches.push(batch);
      }

      if (writeBatches.length > 0) {
        const { failed } = await commitBatchesWithCap(writeBatches, 5, (done, total) => {
          onProgress?.(
            Math.round(((processedCollections + (done / total)) / totalCollections) * 100),
            `Restoring ${collectionName}... (${done * batchSize}/${documents.length})`,
          );
        });
        if (failed > 0) {
          throw new Error(
            `Restore incomplete for ${collectionName}: ${failed}/${writeBatches.length} batches failed. ` +
            'Database is in an inconsistent state — please re-run the restore. ' +
            '(Post-restore trial-balance check will also warn if the resulting books do not balance.)',
          );
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
    onProgress(100, 'Restore completed! Verifying trial balance...');
  }

  // Scale-hardening Tier-1, Fix 3 (part 2): post-restore trial-balance check.
  //
  // Restore can succeed at the Firestore-write layer but still leave the
  // books unbalanced if the backup file was corrupted, hand-edited, or
  // truncated (from the old capped read). Without this check the user sees
  // a green "restored" toast and only discovers the books are broken when
  // they open the trial-balance report weeks later.
  //
  // We sum debits/credits directly from `getJournalEntries` instead of
  // calling `getTrialBalance` — the latter triggers `seedChartOfAccounts`,
  // which in `mode='replace'` would re-create default accounts the user
  // may have intentionally deleted (audit MINOR-1). For this check we
  // don't need per-account balances, just the two totals.
  //
  // Non-fatal: we return a warning rather than throwing. The DB is in the
  // state the file described; the user just needs to know it's off.
  let warning: RestoreResult['warning'];
  try {
    const entriesResult = await getJournalEntries(userId);
    if (entriesResult.success && entriesResult.data) {
      let totalDebits = 0;
      let totalCredits = 0;
      for (const entry of entriesResult.data) {
        for (const line of entry.lines) {
          totalDebits = safeAdd(totalDebits, line.debit || 0);
          totalCredits = safeAdd(totalCredits, line.credit || 0);
        }
      }
      const difference = Math.abs(totalDebits - totalCredits);
      if (difference > ACCOUNTING_TOLERANCE) {
        warning = {
          kind: 'unbalanced-books',
          totalDebits,
          totalCredits,
          difference,
        };
        // eslint-disable-next-line no-console
        console.error(
          `[backup] Post-restore trial balance UNBALANCED: DR=${totalDebits} CR=${totalCredits} diff=${difference}`
        );
      }
    }
  } catch (e) {
    // Not the caller's fault the check itself failed — log and move on so
    // we don't hide the fact that the restore itself succeeded.
    // eslint-disable-next-line no-console
    console.error('[backup] Post-restore trial-balance check failed to run:', e);
  }

  if (onProgress) {
    onProgress(100, warning ? 'Restore completed with warnings.' : 'Restore completed!');
  }

  return { warning };
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
