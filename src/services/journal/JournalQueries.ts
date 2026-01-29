/**
 * Journal Queries
 *
 * Read operations for journal entries with cursor-based pagination.
 * Replaces the hardcoded 5000 limit with proper pagination.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  getCountFromServer,
  doc,
  type QueryConstraint,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import type {
  JournalEntryV2,
  JournalEntryV2Document,
  JournalSourceType,
  JournalQueryOptions,
  JournalCursor,
} from "./types";

/**
 * Default page size for queries
 */
const DEFAULT_PAGE_SIZE = 100;

/**
 * Maximum page size (safety limit)
 */
const MAX_PAGE_SIZE = 500;

/**
 * Safety limit for lookup queries (by source, transaction, etc.)
 * These are expected to return small result sets (1-10 typically)
 * but we add a safety limit to prevent unbounded queries.
 */
const LOOKUP_QUERY_LIMIT = 50;

/**
 * Get the journal entries collection reference
 */
function getJournalRef(userId: string) {
  return collection(firestore, `users/${userId}/journal_entries`);
}

/**
 * Convert Firestore document to JournalEntryV2
 */
function docToJournalEntry(
  docId: string,
  data: JournalEntryV2Document
): JournalEntryV2 {
  // Convert Firestore timestamps to Dates
  const toDate = (value: Date | { toDate: () => Date } | undefined): Date => {
    if (!value) return new Date();
    if (value instanceof Date) return value;
    if (typeof (value as { toDate?: () => Date }).toDate === "function") {
      return (value as { toDate: () => Date }).toDate();
    }
    return new Date(value as unknown as string);
  };

  return {
    id: docId,
    sequenceNumber: data.sequenceNumber,
    entryNumber: data.entryNumber,
    date: toDate(data.date),
    description: data.description,
    lines: data.lines,
    status: data.status,
    source: data.source,
    reversal: data.reversal
      ? {
          ...data.reversal,
          reversedAt: data.reversal.reversedAt
            ? toDate(data.reversal.reversedAt as Date)
            : undefined,
        }
      : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: data.updatedAt ? toDate(data.updatedAt) : undefined,

    // Legacy fields
    linkedTransactionId: data.linkedTransactionId,
    linkedPaymentId: data.linkedPaymentId,
    linkedDocumentType: data.linkedDocumentType as JournalEntryV2["linkedDocumentType"],
  };
}

/**
 * Get active (non-reversed) journal entries
 *
 * Use this for reports and calculations.
 *
 * @param userId - User/owner ID
 * @param options - Query options
 * @returns Array of active journal entries
 */
export async function getActiveJournalEntries(
  userId: string,
  options: JournalQueryOptions = {}
): Promise<{ entries: JournalEntryV2[]; cursor?: JournalCursor }> {
  return getJournalEntries(userId, { ...options, status: "posted" });
}

/**
 * Get journal entries with pagination
 *
 * @param userId - User/owner ID
 * @param options - Query options
 * @returns Paginated journal entries with cursor for next page
 */
export async function getJournalEntries(
  userId: string,
  options: JournalQueryOptions = {}
): Promise<{ entries: JournalEntryV2[]; cursor?: JournalCursor }> {
  const journalRef = getJournalRef(userId);
  const constraints: QueryConstraint[] = [];

  // Status filter
  if (options.status && options.status !== "all") {
    constraints.push(where("status", "==", options.status));
  }

  // Source type filter
  if (options.sourceType) {
    constraints.push(where("source.type", "==", options.sourceType));
  }

  // Transaction ID filter
  if (options.transactionId) {
    constraints.push(where("source.transactionId", "==", options.transactionId));
  }

  // Document ID filter
  if (options.documentId) {
    constraints.push(where("source.documentId", "==", options.documentId));
  }

  // Date range filters
  if (options.startDate) {
    constraints.push(where("date", ">=", options.startDate));
  }
  if (options.endDate) {
    constraints.push(where("date", "<=", options.endDate));
  }

  // Ordering
  const orderField = options.orderBy || "sequenceNumber";
  const orderDir = options.orderDirection || "desc";
  constraints.push(orderBy(orderField, orderDir));

  // Pagination
  const pageSize = Math.min(options.limit || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  constraints.push(limit(pageSize + 1)); // Fetch one extra to check for more

  // Cursor
  if (options.cursor) {
    // We need to get the document to use as cursor
    const cursorDoc = await getDoc(
      doc(firestore, `users/${userId}/journal_entries`, options.cursor.lastId)
    );
    if (cursorDoc.exists()) {
      constraints.push(startAfter(cursorDoc));
    }
  }

  // Execute query
  const q = query(journalRef, ...constraints);
  const snapshot = await getDocs(q);

  // Convert documents
  const entries: JournalEntryV2[] = [];
  let lastDoc: JournalEntryV2 | undefined;

  snapshot.docs.slice(0, pageSize).forEach((doc) => {
    const entry = docToJournalEntry(doc.id, doc.data() as JournalEntryV2Document);
    entries.push(entry);
    lastDoc = entry;
  });

  // Build cursor for next page
  const hasMore = snapshot.docs.length > pageSize;
  const cursor: JournalCursor | undefined = hasMore && lastDoc
    ? {
        lastId: lastDoc.id,
        lastSequence: lastDoc.sequenceNumber,
      }
    : undefined;

  return { entries, cursor };
}

/**
 * Get a single journal entry by ID
 *
 * @param userId - User/owner ID
 * @param entryId - Entry document ID
 * @returns Journal entry or null if not found
 */
export async function getJournalEntry(
  userId: string,
  entryId: string
): Promise<JournalEntryV2 | null> {
  const docRef = doc(firestore, `users/${userId}/journal_entries`, entryId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return docToJournalEntry(docSnap.id, docSnap.data() as JournalEntryV2Document);
}

/**
 * Get journal entries by source document
 *
 * @param userId - User/owner ID
 * @param sourceType - Type of source document
 * @param documentId - Primary document ID
 * @param includeReversed - Whether to include reversed entries
 * @returns Array of journal entries
 */
export async function getEntriesBySource(
  userId: string,
  sourceType: JournalSourceType,
  documentId: string,
  includeReversed: boolean = false
): Promise<JournalEntryV2[]> {
  const journalRef = getJournalRef(userId);
  const constraints: QueryConstraint[] = [
    where("source.type", "==", sourceType),
    where("source.documentId", "==", documentId),
  ];

  if (!includeReversed) {
    constraints.push(where("status", "==", "posted"));
  }

  // Safety limit - a single source document should have very few journals
  constraints.push(limit(LOOKUP_QUERY_LIMIT));

  const q = query(journalRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) =>
    docToJournalEntry(doc.id, doc.data() as JournalEntryV2Document)
  );
}

/**
 * Get journal entries by transaction ID
 *
 * This finds all journals linked to a specific ledger transaction,
 * including the main journal and any related payment journals.
 *
 * @param userId - User/owner ID
 * @param transactionId - Ledger transaction ID
 * @param includeReversed - Whether to include reversed entries
 * @returns Array of journal entries
 */
export async function getEntriesByTransactionId(
  userId: string,
  transactionId: string,
  includeReversed: boolean = false
): Promise<JournalEntryV2[]> {
  const journalRef = getJournalRef(userId);
  const constraints: QueryConstraint[] = [
    where("source.transactionId", "==", transactionId),
  ];

  if (!includeReversed) {
    constraints.push(where("status", "==", "posted"));
  }

  // Safety limit - a transaction typically has 1-5 journals (main + payments + discounts)
  constraints.push(limit(LOOKUP_QUERY_LIMIT));

  const q = query(journalRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) =>
    docToJournalEntry(doc.id, doc.data() as JournalEntryV2Document)
  );
}

/**
 * Get the reversal entry for a reversed journal
 *
 * @param userId - User/owner ID
 * @param originalEntryId - ID of the original (reversed) entry
 * @returns The reversal entry or null
 */
export async function getReversalEntry(
  userId: string,
  originalEntryId: string
): Promise<JournalEntryV2 | null> {
  const journalRef = getJournalRef(userId);
  const q = query(
    journalRef,
    where("reversal.reversesEntryId", "==", originalEntryId),
    where("reversal.isReversal", "==", true),
    limit(1)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return docToJournalEntry(doc.id, doc.data() as JournalEntryV2Document);
}

/**
 * Get journal entries within a date range
 *
 * Useful for period reports.
 *
 * @param userId - User/owner ID
 * @param startDate - Start of period
 * @param endDate - End of period
 * @param onlyActive - Whether to exclude reversed entries
 * @returns Array of journal entries
 */
export async function getEntriesInDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  onlyActive: boolean = true
): Promise<JournalEntryV2[]> {
  const result = await getJournalEntries(userId, {
    startDate,
    endDate,
    status: onlyActive ? "posted" : "all",
    limit: MAX_PAGE_SIZE,
    orderBy: "date",
    orderDirection: "asc",
  });

  // If we hit the limit, we need to paginate
  let allEntries = result.entries;
  let cursor = result.cursor;

  while (cursor) {
    const nextResult = await getJournalEntries(userId, {
      startDate,
      endDate,
      status: onlyActive ? "posted" : "all",
      limit: MAX_PAGE_SIZE,
      orderBy: "date",
      orderDirection: "asc",
      cursor,
    });

    allEntries = [...allEntries, ...nextResult.entries];
    cursor = nextResult.cursor;
  }

  return allEntries;
}

/**
 * Count journal entries by status
 *
 * Uses getCountFromServer for efficiency - does not download documents.
 *
 * @param userId - User/owner ID
 * @param status - Status to count ('posted' | 'reversed' | 'all')
 * @returns Count of entries
 */
export async function countEntriesByStatus(
  userId: string,
  status: "posted" | "reversed" | "all"
): Promise<number> {
  const journalRef = getJournalRef(userId);

  let q;
  if (status === "all") {
    q = query(journalRef);
  } else {
    q = query(journalRef, where("status", "==", status));
  }

  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

/**
 * Get journal entries by legacy linkedTransactionId
 *
 * For backward compatibility with old queries.
 *
 * @param userId - User/owner ID
 * @param linkedTransactionId - Legacy transaction ID
 * @param includeReversed - Whether to include reversed entries
 * @returns Array of journal entries
 */
export async function getEntriesByLinkedTransactionId(
  userId: string,
  linkedTransactionId: string,
  includeReversed: boolean = false
): Promise<JournalEntryV2[]> {
  const journalRef = getJournalRef(userId);
  const constraints: QueryConstraint[] = [
    where("linkedTransactionId", "==", linkedTransactionId),
  ];

  if (!includeReversed) {
    constraints.push(where("status", "==", "posted"));
  }

  // Safety limit
  constraints.push(limit(LOOKUP_QUERY_LIMIT));

  const q = query(journalRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) =>
    docToJournalEntry(doc.id, doc.data() as JournalEntryV2Document)
  );
}

/**
 * Get journal entries by legacy linkedPaymentId
 *
 * For backward compatibility with old queries.
 *
 * @param userId - User/owner ID
 * @param linkedPaymentId - Legacy payment ID (or cheque ID for endorsements)
 * @param includeReversed - Whether to include reversed entries
 * @returns Array of journal entries
 */
export async function getEntriesByLinkedPaymentId(
  userId: string,
  linkedPaymentId: string,
  includeReversed: boolean = false
): Promise<JournalEntryV2[]> {
  const journalRef = getJournalRef(userId);
  const constraints: QueryConstraint[] = [
    where("linkedPaymentId", "==", linkedPaymentId),
  ];

  if (!includeReversed) {
    constraints.push(where("status", "==", "posted"));
  }

  // Safety limit
  constraints.push(limit(LOOKUP_QUERY_LIMIT));

  const q = query(journalRef, ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) =>
    docToJournalEntry(doc.id, doc.data() as JournalEntryV2Document)
  );
}
