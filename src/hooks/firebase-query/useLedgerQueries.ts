"use client";

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  getCountFromServer,
  type DocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import { convertFirestoreDates } from '@/lib/firestore-utils';
import { queryKeys } from './keys';
import { useReactiveQueryData } from './useReactiveQueryData';
import { QUERY_LIMITS } from '@/lib/constants';
import type { LedgerEntry } from '@/components/ledger/utils/ledger-constants';

// Simple name+id type for dropdowns
export interface NamedEntity {
  id: string;
  name: string;
}

/** Transform Firestore docs to LedgerEntry array */
function transformLedgerEntries(docs: DocumentData[]): LedgerEntry[] {
  return docs.map((data) => ({
    id: data.id,
    ...convertFirestoreDates(data),
  } as LedgerEntry));
}

/** Transform Firestore docs to NamedEntity array */
function transformNamedEntities(docs: DocumentData[]): NamedEntity[] {
  return docs.map((data) => ({
    id: data.id,
    name: data.name || '',
  }));
}

/** Transform partners (filter inactive) */
function transformPartners(docs: DocumentData[]): NamedEntity[] {
  return docs
    .filter((data) => data.active !== false)
    .map((data) => ({
      id: data.id,
      name: data.name || '',
    }));
}

/**
 * Hook for ledger clients dropdown with real-time subscription
 */
export function useLedgerClientsSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  // Use a more specific key to avoid conflict with clients page
  const queryKey = useMemo(
    () => [...queryKeys.clients.all(ownerId || ''), 'ledger-dropdown'] as const,
    [ownerId]
  );

  const transform = useCallback((docs: DocumentData[]) => transformNamedEntities(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const clientsRef = collection(firestore, `users/${ownerId}/clients`);
    const q = query(clientsRef, orderBy('name', 'asc'), limit(QUERY_LIMITS.CLIENTS));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Ledger clients subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  return useReactiveQueryData<NamedEntity[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });
}

/**
 * Hook for ledger partners dropdown with real-time subscription
 */
export function useLedgerPartnersSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  // Memoize queryKey to prevent subscription churn on re-renders
  const queryKey = useMemo(
    () => queryKeys.partners.all(ownerId || ''),
    [ownerId]
  );

  const transform = useCallback((docs: DocumentData[]) => transformPartners(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const partnersRef = collection(firestore, `users/${ownerId}/partners`);
    const q = query(partnersRef, orderBy('name', 'asc'), limit(QUERY_LIMITS.PARTNERS));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Ledger partners subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  return useReactiveQueryData<NamedEntity[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });
}

/**
 * Hook for ALL ledger entries (for stats calculation)
 * Uses a high limit to get most entries - same as existing implementation
 */
export function useLedgerStatsSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  // Memoize queryKey to prevent subscription churn on re-renders
  const queryKey = useMemo(
    () => queryKeys.ledger.stats(ownerId || ''),
    [ownerId]
  );

  const transform = useCallback((docs: DocumentData[]) => transformLedgerEntries(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const ledgerRef = collection(firestore, `users/${ownerId}/ledger`);
    const q = query(ledgerRef, orderBy('date', 'desc'), limit(QUERY_LIMITS.LEDGER_ENTRIES));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Ledger stats subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  return useReactiveQueryData<LedgerEntry[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });
}

/**
 * Singleton cursor store for ledger pagination
 * Cursors must be stored outside the hook to persist across re-renders and hook re-instantiations.
 * Using a ref inside the hook doesn't work because when currentPage changes, the cursor
 * for the previous page may not be available if the hook re-runs before the cursor was stored.
 *
 * Includes cleanup logic to prevent unbounded memory growth (max 20 cursors per user).
 */
const ledgerCursorStore = {
  cursors: new Map<string, Map<number, DocumentSnapshot>>(),
  MAX_CURSORS_PER_USER: 20,

  getCursors(ownerId: string): Map<number, DocumentSnapshot> {
    if (!this.cursors.has(ownerId)) {
      this.cursors.set(ownerId, new Map());
    }
    return this.cursors.get(ownerId)!;
  },

  setCursor(ownerId: string, page: number, doc: DocumentSnapshot) {
    const userCursors = this.getCursors(ownerId);
    userCursors.set(page, doc);

    // Cleanup old cursors if exceeding limit (keep most recent pages)
    if (userCursors.size > this.MAX_CURSORS_PER_USER) {
      const sortedPages = Array.from(userCursors.keys()).sort((a, b) => a - b);
      const toDelete = sortedPages.slice(0, sortedPages.length - this.MAX_CURSORS_PER_USER);
      toDelete.forEach((p) => userCursors.delete(p));
    }
  },

  getCursor(ownerId: string, page: number): DocumentSnapshot | undefined {
    return this.getCursors(ownerId).get(page);
  },

  clear(ownerId: string) {
    this.cursors.delete(ownerId);
  }
};

/**
 * Hook for paginated ledger entries with cursor-based pagination
 * Uses a singleton cursor store to ensure cursors persist across re-renders
 */
export function useLedgerEntriesSubscription(options: {
  pageSize?: number;
  currentPage?: number;
} = {}) {
  const { pageSize = 50, currentPage = 1 } = options;
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastDocRef = useRef<DocumentSnapshot | null>(null);

  const ownerId = user?.dataOwnerId;
  const queryKey = useMemo(
    () => queryKeys.ledger.paginated(ownerId || '', currentPage),
    [ownerId, currentPage]
  );

  const transform = useCallback((docs: DocumentData[]) => transformLedgerEntries(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const ledgerRef = collection(firestore, `users/${ownerId}/ledger`);

    // Get cursor for current page (from previous page's last document)
    // For page 2, we need the last document from page 1, etc.
    const startAfterDoc = currentPage > 1
      ? ledgerCursorStore.getCursor(ownerId, currentPage - 1)
      : undefined;

    // Build query with optional cursor
    // Only use startAfter if we have a valid cursor for the previous page
    const q = startAfterDoc
      ? query(ledgerRef, orderBy('date', 'desc'), startAfter(startAfterDoc), limit(pageSize))
      : query(ledgerRef, orderBy('date', 'desc'), limit(pageSize));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);

        // Store the last document of this page as the cursor for pagination
        // This cursor will be used as startAfter for the next page
        const lastVisible = snapshot.docs[snapshot.docs.length - 1];
        if (lastVisible) {
          ledgerCursorStore.setCursor(ownerId, currentPage, lastVisible);
          lastDocRef.current = lastVisible;
        }

        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Ledger entries subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, pageSize, currentPage, queryKey, queryClient, transform]);

  const { data, isLoading } = useReactiveQueryData<LedgerEntry[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });

  return {
    data,
    isLoading,
    lastDoc: lastDocRef.current,
  };
}

/**
 * Hook for total count of ledger entries
 * One-time query, not a subscription
 */
export function useLedgerTotalCount() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const fetchedRef = useRef(false);

  const ownerId = user?.dataOwnerId;
  const queryKey = useMemo(
    () => [...queryKeys.ledger.all(ownerId || ''), 'count'] as const,
    [ownerId]
  );

  useEffect(() => {
    if (!ownerId || fetchedRef.current) {
      return;
    }

    const fetchCount = async () => {
      try {
        const ledgerRef = collection(firestore, `users/${ownerId}/ledger`);
        const snapshot = await getCountFromServer(query(ledgerRef));
        const count = snapshot.data().count;
        queryClient.setQueryData(queryKey, count);
        fetchedRef.current = true;
      } catch (error) {
        console.error('Error fetching ledger count:', error);
      }
    };

    fetchCount();
  }, [ownerId, queryKey, queryClient]);

  // Reset fetched flag when ownerId changes
  useEffect(() => {
    fetchedRef.current = false;
  }, [ownerId]);

  const { data, isLoading } = useReactiveQueryData<number>({
    queryKey,
    defaultValue: 0,
    enabled: !!ownerId,
  });

  return {
    count: data,
    isLoading: isLoading && !!ownerId,
  };
}

/**
 * Combined hook for ledger page data
 * Fetches paginated entries, all entries for stats, clients, partners, and count
 */
export function useLedgerPageData(options: {
  pageSize?: number;
  currentPage?: number;
} = {}) {
  const { pageSize = 50, currentPage = 1 } = options;

  // Paginated entries for table display
  const {
    data: entries,
    isLoading: entriesLoading,
    lastDoc,
  } = useLedgerEntriesSubscription({ pageSize, currentPage });

  // All entries for stats calculation
  const {
    data: allEntriesForStats,
    isLoading: statsLoading,
  } = useLedgerStatsSubscription();

  // Clients for dropdown
  const {
    data: clients,
    isLoading: clientsLoading,
  } = useLedgerClientsSubscription();

  // Partners for dropdown
  const {
    data: partners,
    isLoading: partnersLoading,
  } = useLedgerPartnersSubscription();

  // Total count for pagination
  const {
    count: totalCount,
    isLoading: countLoading,
  } = useLedgerTotalCount();

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / pageSize);

  // Combined loading states
  const loading = entriesLoading;
  const statsLoadingState = statsLoading;

  return {
    entries,
    allEntriesForStats,
    clients,
    partners,
    totalCount,
    totalPages,
    lastDoc,
    loading,
    statsLoading: statsLoadingState,
  };
}
