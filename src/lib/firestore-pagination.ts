/**
 * Cursor pagination helpers for Firestore reads that must NOT silently truncate.
 *
 * Motivation: the app historically used `limit(5000)` or `limit(10000)` as a
 * safety cap on read queries that "should never really hit that many docs".
 * At real scale (10 000+ journal entries or ledger rows) these caps silently
 * cut off data — a trial balance or backup ends up incomplete without the
 * user knowing. See the Scale + Accounting Integrity Audit plan for details.
 *
 * These helpers replace those single-shot capped reads with cursor-paginated
 * loops. They pull every matching doc in fixed-size pages, with an optional
 * progress callback so the calling UI can render "loading page N…" instead of
 * hanging silently. There's also a hard safety ceiling to prevent an infinite
 * loop if a caller passes a broken query (defense in depth — Firestore's own
 * ordering guarantees make the loop terminate normally).
 *
 * Only the READ shape is here. Callers still choose what to do with each page
 * (accumulate, aggregate, transform).
 */

import {
  getDocs,
  query,
  startAfter,
  limit as fbLimit,
  type Query,
  type DocumentData,
  type QueryDocumentSnapshot,
  type QueryConstraint,
} from 'firebase/firestore';

/** Default page size — Firestore recommends batching around 500 for reads. */
const DEFAULT_PAGE_SIZE = 500;

/**
 * Absolute safety ceiling. If a caller reaches this many docs we bail out.
 * Set high enough (1 000 000) that a real business will never hit it in
 * practice, but low enough to catch an accidental infinite loop.
 */
const MAX_TOTAL_DOCS = 1_000_000;

export interface PaginateAllOptions {
  /** Docs per page. Defaults to 500. */
  pageSize?: number;
  /**
   * Called after each page arrives with the running total.
   * Use it to update a UI progress indicator.
   */
  onProgress?: (loadedSoFar: number) => void;
}

/**
 * Read every document matching `baseConstraints` from `collectionRef`, in
 * pages of `pageSize`, and return them all as an array.
 *
 * The `baseConstraints` argument is the ordering/filtering you want applied
 * to every page. It MUST include a stable `orderBy(...)` so `startAfter`
 * cursoring works correctly — pagination in Firestore is meaningless without
 * a deterministic sort order. The helper does not add its own orderBy so the
 * caller controls the sort direction.
 *
 * @throws if the total docs exceed MAX_TOTAL_DOCS (misuse guard).
 */
export async function paginateAll<T = DocumentData>(
  collectionRef: Query<DocumentData>,
  baseConstraints: QueryConstraint[],
  options: PaginateAllOptions = {},
): Promise<QueryDocumentSnapshot<T>[]> {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const results: QueryDocumentSnapshot<T>[] = [];

  let lastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  let hasMore = true;

  while (hasMore) {
    const constraints: QueryConstraint[] = lastDoc
      ? [...baseConstraints, startAfter(lastDoc), fbLimit(pageSize)]
      : [...baseConstraints, fbLimit(pageSize)];

    const pageQuery = query(collectionRef, ...constraints);
    const snapshot = await getDocs(pageQuery);

    if (snapshot.empty) { break; }

    for (const docSnap of snapshot.docs) {
      results.push(docSnap as QueryDocumentSnapshot<T>);
    }

    if (options.onProgress) { options.onProgress(results.length); }

    // The last page is the one that came back smaller than pageSize.
    hasMore = snapshot.docs.length === pageSize;
    lastDoc = snapshot.docs[snapshot.docs.length - 1];

    if (results.length > MAX_TOTAL_DOCS) {
      throw new Error(
        `paginateAll safety ceiling hit (${MAX_TOTAL_DOCS} docs). ` +
        `Check your query constraints — this should never happen for a real business.`
      );
    }
  }

  return results;
}

/**
 * Convenience wrapper that returns the parsed `.data()` payload of each doc
 * (not the snapshot). Use when the doc IDs aren't needed for downstream work.
 */
export async function paginateAllData<T extends DocumentData>(
  collectionRef: Query<DocumentData>,
  baseConstraints: QueryConstraint[],
  options: PaginateAllOptions = {},
): Promise<T[]> {
  const snaps = await paginateAll<T>(collectionRef, baseConstraints, options);
  return snaps.map((s) => s.data());
}
