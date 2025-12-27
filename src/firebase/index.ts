'use client';

import { useEffect, useState, useMemo, useRef, DependencyList, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  Query,
  DocumentReference,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  DocumentSnapshot,
  QueryDocumentSnapshot,
  getDocs,
  query as firestoreQuery,
  startAfter,
  limit,
} from 'firebase/firestore';

// Hook for real-time collection data
export function useCollection<T = DocumentData>(
  query: Query<DocumentData> | null
): {
  data: T[];
  isLoading: boolean;
  error: FirestoreError | null;
} {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!query) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const items: T[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(items);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        console.error('Collection error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query]);

  return { data, isLoading, error };
}

// Hook for real-time document data
export function useDoc<T = DocumentData>(
  docRef: DocumentReference<DocumentData> | null
): {
  data: T | null;
  isLoading: boolean;
  error: FirestoreError | null;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);

  useEffect(() => {
    if (!docRef) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      docRef,
      (doc: DocumentSnapshot<DocumentData>) => {
        if (doc.exists()) {
          setData({ id: doc.id, ...doc.data() } as T);
        } else {
          setData(null);
        }
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        console.error('Document error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [docRef]);

  return { data, isLoading, error };
}

// Custom useMemo for Firebase objects
export function useMemoFirebase<T>(
  factory: () => T,
  deps: DependencyList | undefined
): T {
  const ref = useRef<T>();
  const depsRef = useRef<DependencyList | undefined>();

  // Check if deps have changed
  const depsChanged = !deps || !depsRef.current || 
    deps.length !== depsRef.current.length ||
    deps.some((dep, i) => {
      if (depsRef.current === undefined) {return true;}
      return dep !== depsRef.current[i];
    });

  if (!ref.current || depsChanged) {
    ref.current = factory();
    depsRef.current = deps;
  }

  return ref.current;
}

/**
 * Hook for paginated collection data with cursor-based pagination.
 *
 * Features:
 * - First page uses onSnapshot for real-time updates
 * - Subsequent pages use getDocs (static) with startAfter cursor
 * - Supports loadMore() to fetch next page
 * - Supports reset() to clear and reload from start
 *
 * @param baseQuery - The base Firestore query (should NOT include limit)
 * @param pageSize - Number of documents per page (default: 10)
 */
export function usePaginatedCollection<T = DocumentData>(
  baseQuery: Query<DocumentData> | null,
  pageSize: number = 10
): {
  data: T[];
  isLoading: boolean;
  isLoadingMore: boolean;
  error: FirestoreError | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
} {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Track if first page has loaded (for real-time subscription)
  const isFirstPageLoaded = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Reset function to clear data and reload from start
  const reset = useCallback(() => {
    // Cleanup existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Reset all state
    setData([]);
    setLastDoc(null);
    setHasMore(true);
    setError(null);
    setIsLoading(true);
    setIsLoadingMore(false);
    isFirstPageLoaded.current = false;
  }, []);

  // Initial load with real-time subscription for first page
  useEffect(() => {
    if (!baseQuery) {
      setIsLoading(false);
      return;
    }

    // Apply limit for first page
    const firstPageQuery = firestoreQuery(baseQuery, limit(pageSize));

    setIsLoading(true);
    setError(null);

    unsubscribeRef.current = onSnapshot(
      firstPageQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const items: T[] = [];
        snapshot.forEach((docSnap) => {
          items.push({ id: docSnap.id, ...docSnap.data() } as T);
        });

        // For first page, replace all data
        // For subsequent updates to first page, only update first pageSize items
        if (!isFirstPageLoaded.current) {
          setData(items);
          isFirstPageLoaded.current = true;
        } else {
          // Update first page data while preserving loaded pages
          setData((prev) => {
            const loadedPages = prev.slice(pageSize);
            return [...items, ...loadedPages];
          });
        }

        setIsLoading(false);
        setHasMore(snapshot.size >= pageSize);

        // Update cursor to last document of first page
        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        } else {
          setLastDoc(null);
        }
      },
      (err: FirestoreError) => {
        console.error('Paginated collection error:', err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [baseQuery, pageSize]);

  // Load more function - fetches next page using cursor
  const loadMore = useCallback(async () => {
    if (!baseQuery || !lastDoc || isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      // Create query for next page starting after last document
      const nextPageQuery = firestoreQuery(
        baseQuery,
        startAfter(lastDoc),
        limit(pageSize)
      );

      const snapshot = await getDocs(nextPageQuery);

      const newItems: T[] = [];
      snapshot.forEach((docSnap) => {
        newItems.push({ id: docSnap.id, ...docSnap.data() } as T);
      });

      // Append new items to existing data
      setData((prev) => [...prev, ...newItems]);

      // Update cursor and hasMore
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.size >= pageSize);
    } catch (err) {
      console.error('Load more error:', err);
      setError(err as FirestoreError);
    } finally {
      setIsLoadingMore(false);
    }
  }, [baseQuery, lastDoc, isLoadingMore, hasMore, pageSize]);

  return {
    data,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    loadMore,
    reset,
  };
}

// Export Firebase services
export { FirebaseClientProvider, useUser } from './provider';
export { auth, firestore, storage } from './config';
