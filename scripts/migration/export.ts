/**
 * Phase 6 — Firestore export.
 *
 * Reads every collection under a single user's namespace
 * (`users/{uid}/<collection>`) into an in-memory `MigrationExports` shape
 * ready to feed straight into `runMigrationFromExports`.
 *
 * Designed around a minimal `FirestoreReader` interface — the real CLI uses
 * a thin wrapper over `firebase-admin`'s Firestore, while tests supply an
 * in-memory implementation. The export logic itself is pure: no live
 * Firebase connection needed to unit-test it.
 *
 * Special-case handling:
 *  - `payments` documents have their `allocations` subcollection merged into
 *    the parent doc as an `allocations[]` array (this is what
 *    `flattenPaymentAllocations` in transform.ts expects to see).
 *  - `journal_entries` already store `lines` as a nested array, so no extra
 *    fetch is needed.
 *  - Anything we haven't wired (cheque attachments, activity logs, etc.) is
 *    simply omitted from the export — they'll either be re-attached on the
 *    local side later or aren't load-bearing for go-live.
 */

import type { MigrationExports } from './runner';

/**
 * A single Firestore document — `id` plus the `data()` payload. We keep this
 * loose (`Record<string, unknown>`) and let each mapper enforce the shape.
 */
export interface ExportedDoc {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Minimal Firestore surface the export needs. The real implementation reads
 * via `firebase-admin/firestore`; the test implementation returns canned
 * data. Both go through the same `getCollection` call.
 */
export interface FirestoreReader {
  /**
   * Returns every document in a collection path. Path is slash-separated,
   * Firestore-style: e.g. `users/abc123/clients` or
   * `users/abc123/payments/pay-5/allocations`.
   */
  getCollection(path: string): Promise<ExportedDoc[]>;
}

/** Collections that are a 1-to-1 dump (no subcollection merging). */
const SIMPLE_COLLECTIONS = [
  'clients',
  'partners',
  'employees',
  'inventory',
  'ledger',
  'cheques',
  'invoices',
  'journal_entries',
] as const;

export interface ExportOptions {
  /** The Firestore user document id whose data is being exported. */
  userId: string;
  /**
   * Optional progress callback — invoked once per collection with the
   * collection name and the number of documents fetched. The CLI uses this
   * to print a live status; tests pass it through to assert on order.
   */
  onProgress?: (collection: string, count: number) => void;
}

/**
 * Fetch every supported collection under `users/{userId}/...` and return
 * the merged result shaped for `runMigrationFromExports`.
 *
 * Note: this function does not write to disk. The CLI wrapper handles
 * serialisation; the unit tests only need to inspect the returned object.
 */
export async function exportAllCollections(
  reader: FirestoreReader,
  opts: ExportOptions,
): Promise<MigrationExports> {
  const { userId, onProgress } = opts;
  const out: MigrationExports = {};

  // 1. Simple collections in parallel — they don't depend on each other.
  const simpleResults = await Promise.all(
    SIMPLE_COLLECTIONS.map(async (collection) => {
      const docs = await reader.getCollection(`users/${userId}/${collection}`);
      return { collection, docs };
    }),
  );

  for (const { collection, docs } of simpleResults) {
    // Each mapper expects `id` to be inside the document, so we merge it in.
    (out as Record<string, unknown>)[collection] = docs.map((d) => ({ id: d.id, ...d.data }));
    onProgress?.(collection, docs.length);
  }

  // 2. Payments — fetch parent docs, then merge each payment's allocations
  //    subcollection into the parent's `allocations` field. Parallelism is
  //    bounded by per-payment requests; for a few hundred payments this is
  //    instantaneous, but if it ever needs throttling we can chunk here.
  const paymentParents = await reader.getCollection(`users/${userId}/payments`);
  const paymentsWithAllocations = await Promise.all(
    paymentParents.map(async (parent) => {
      const allocations = await reader.getCollection(
        `users/${userId}/payments/${parent.id}/allocations`,
      );
      return {
        id: parent.id,
        ...parent.data,
        allocations: allocations.map((a) => ({ id: a.id, ...a.data })),
      };
    }),
  );
  out.payments = paymentsWithAllocations as MigrationExports['payments'];
  onProgress?.('payments', paymentsWithAllocations.length);

  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// User discovery helper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Discover the user document id to export. If exactly one user exists under
 * the top-level `users/` collection we use it; otherwise we list and the
 * caller picks (the CLI prints them and asks for a flag).
 */
export async function listUsers(
  reader: FirestoreReader,
): Promise<Array<{ id: string; email?: string; displayName?: string }>> {
  const docs = await reader.getCollection('users');
  return docs.map((d) => ({
    id: d.id,
    email: typeof d.data.email === 'string' ? d.data.email : undefined,
    displayName: typeof d.data.displayName === 'string' ? d.data.displayName : undefined,
  }));
}
