import { useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  collection,
  query,
  onSnapshot,
  type Query,
  type DocumentData,
  type QueryConstraint,
  type FirestoreError,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';

interface UseFirestoreSubscriptionOptions<T> {
  /** Query key for React Query cache */
  queryKey: QueryKey;
  /** Firestore collection path */
  collectionPath: string;
  /** Optional query constraints (where, orderBy, limit, etc.) */
  constraints?: QueryConstraint[];
  /** Transform function to convert Firestore documents to your type */
  transform: (docs: DocumentData[]) => T;
  /** Whether the subscription is enabled */
  enabled?: boolean;
}

interface UseFirestoreSubscriptionResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error: FirestoreError | null;
}

/**
 * Hook that combines Firestore onSnapshot with React Query caching.
 *
 * - Uses onSnapshot for real-time updates
 * - Pushes updates into React Query cache
 * - Handles cleanup on unmount
 * - Provides consistent loading/error states
 *
 * @example
 * const { data, isLoading } = useFirestoreSubscription({
 *   queryKey: queryKeys.clients.all(ownerId),
 *   collectionPath: `users/${ownerId}/clients`,
 *   transform: (docs) => docs.map(doc => ({ id: doc.id, ...doc.data() })),
 * });
 */
export function useFirestoreSubscription<T>({
  queryKey,
  collectionPath,
  constraints = [],
  transform,
  enabled = true,
}: UseFirestoreSubscriptionOptions<T>): UseFirestoreSubscriptionResult<T> {
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const errorRef = useRef<FirestoreError | null>(null);

  // Memoize constraints to avoid unnecessary re-subscriptions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const memoizedConstraints = useMemo(() => constraints, [JSON.stringify(constraints)]);

  // Use React Query for state management
  const { data, isLoading, isError } = useQuery<T>({
    queryKey,
    // Initial query function - returns undefined, onSnapshot will populate data
    queryFn: () => {
      // Return a promise that never resolves on its own
      // The onSnapshot will update the cache directly
      return new Promise<T>(() => {
        // This promise intentionally never resolves
        // Data comes from onSnapshot updating the cache
      });
    },
    enabled: false, // We manage our own subscription
    staleTime: Infinity, // Data is always fresh since we're using real-time subscription
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Build Firestore query
    const collectionRef = collection(firestore, collectionPath);
    const firestoreQuery: Query<DocumentData> = memoizedConstraints.length > 0
      ? query(collectionRef, ...memoizedConstraints)
      : query(collectionRef);

    // Subscribe to real-time updates
    unsubscribeRef.current = onSnapshot(
      firestoreQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Transform and update React Query cache
        const transformedData = transform(docs);
        queryClient.setQueryData(queryKey, transformedData);
        errorRef.current = null;
      },
      (error) => {
        errorRef.current = error;
        // Set error state in React Query
        queryClient.setQueryData(queryKey, undefined);
      }
    );

    // Cleanup on unmount or when dependencies change
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [queryKey, collectionPath, memoizedConstraints, enabled, queryClient, transform]);

  return {
    data,
    isLoading: enabled && data === undefined && !errorRef.current,
    isError: errorRef.current !== null,
    error: errorRef.current,
  };
}

/**
 * Simple hook for one-time Firestore queries (no real-time updates)
 * Uses React Query's built-in caching and refetching.
 */
export function useFirestoreQuery<T>({
  queryKey,
  collectionPath,
  constraints = [],
  transform,
  enabled = true,
}: UseFirestoreSubscriptionOptions<T>) {
  return useQuery<T>({
    queryKey,
    queryFn: async () => {
      const { getDocs } = await import('firebase/firestore');
      const collectionRef = collection(firestore, collectionPath);
      const firestoreQuery = constraints.length > 0
        ? query(collectionRef, ...constraints)
        : query(collectionRef);

      const snapshot = await getDocs(firestoreQuery);
      const docs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      return transform(docs);
    },
    enabled,
  });
}
