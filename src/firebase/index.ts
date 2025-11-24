'use client';

import { useEffect, useState, useMemo, useRef, DependencyList } from 'react';
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

// Hook for paginated data
export function usePaginatedCollection<T = DocumentData>(
  query: Query<DocumentData> | null,
  pageSize: number = 10
): {
  data: T[];
  isLoading: boolean;
  error: FirestoreError | null;
  hasMore: boolean;
  loadMore: () => void;
} {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<DocumentData | null>(null);

  // Initial load
  useEffect(() => {
    if (!query) {
      setIsLoading(false);
      return;
    }

    // Implementation would require additional Firestore query methods
    // This is a simplified version
    setIsLoading(true);
    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const items: T[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(items);
        setIsLoading(false);
        setHasMore(snapshot.size >= pageSize);
        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        }
      },
      (err: FirestoreError) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [query, pageSize]);

  const loadMore = () => {
    // Implementation would load next page
    // TODO: Implement pagination
  };

  return { data, isLoading, error, hasMore, loadMore };
}

// Export Firebase services
export { FirebaseClientProvider, useUser } from './provider';
export { auth, firestore, storage } from './config';
