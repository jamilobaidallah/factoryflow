'use client';

import { useEffect, useState, useRef, DependencyList } from 'react';
import {
  onSnapshot,
  DocumentReference,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';

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

// Export Firebase services
export { FirebaseClientProvider, useUser } from './provider';
export { auth, firestore, storage } from './config';
