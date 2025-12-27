"use client";

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
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
    const q = query(clientsRef, orderBy('name', 'asc'), limit(500));

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

  // Use useQuery with enabled:false for reactive cache access
  // This ensures re-render when setQueryData is called
  const { data } = useQuery<NamedEntity[]>({
    queryKey,
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
  });

  return {
    data: data ?? [],
    isLoading: data === undefined && !!ownerId,
  };
}

/**
 * Hook for ledger partners dropdown with real-time subscription
 */
export function useLedgerPartnersSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  const queryKey = queryKeys.partners.all(ownerId || '');

  const transform = useCallback((docs: DocumentData[]) => transformPartners(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const partnersRef = collection(firestore, `users/${ownerId}/partners`);
    const q = query(partnersRef, orderBy('name', 'asc'), limit(100));

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

  // Use useQuery with enabled:false for reactive cache access
  const { data } = useQuery<NamedEntity[]>({
    queryKey,
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
  });

  return {
    data: data ?? [],
    isLoading: data === undefined && !!ownerId,
  };
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
  const queryKey = queryKeys.ledger.stats(ownerId || '');

  const transform = useCallback((docs: DocumentData[]) => transformLedgerEntries(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const ledgerRef = collection(firestore, `users/${ownerId}/ledger`);
    // Large limit to get all entries for stats (same as existing 10000 limit)
    const q = query(ledgerRef, orderBy('date', 'desc'), limit(10000));

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

  // Use useQuery with enabled:false for reactive cache access
  const { data } = useQuery<LedgerEntry[]>({
    queryKey,
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
  });

  return {
    data: data ?? [],
    isLoading: data === undefined && !!ownerId,
  };
}

/**
 * Hook for paginated ledger entries with cursor-based pagination
 * Maintains cursor map in ref to enable page navigation
 */
export function useLedgerEntriesSubscription(options: {
  pageSize?: number;
  currentPage?: number;
} = {}) {
  const { pageSize = 50, currentPage = 1 } = options;
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pageCursorsRef = useRef<Map<number, DocumentSnapshot>>(new Map());
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

    // Get cursor for current page (from previous page)
    const startAfterDoc = currentPage > 1
      ? pageCursorsRef.current.get(currentPage - 1) || null
      : null;

    // Build query with optional cursor
    const q = startAfterDoc
      ? query(ledgerRef, orderBy('date', 'desc'), limit(pageSize), startAfter(startAfterDoc))
      : query(ledgerRef, orderBy('date', 'desc'), limit(pageSize));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);

        // Store cursor for this page
        const lastVisible = snapshot.docs[snapshot.docs.length - 1] || null;
        if (lastVisible) {
          pageCursorsRef.current.set(currentPage, lastVisible);
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

  // Use useQuery with enabled:false for reactive cache access
  const { data } = useQuery<LedgerEntry[]>({
    queryKey,
    queryFn: () => Promise.resolve([]),
    enabled: false,
    staleTime: Infinity,
  });

  return {
    data: data ?? [],
    isLoading: data === undefined && !!ownerId,
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

  // Use useQuery with enabled:false for reactive cache access
  const { data } = useQuery<number>({
    queryKey,
    queryFn: () => Promise.resolve(0),
    enabled: false,
    staleTime: Infinity,
  });

  return {
    count: data ?? 0,
    isLoading: data === undefined && !!ownerId,
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
