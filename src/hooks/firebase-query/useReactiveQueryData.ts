"use client";

import { useQuery, type QueryKey } from '@tanstack/react-query';

/**
 * Hook that provides reactive access to React Query cache data.
 *
 * This hook solves the problem where `queryClient.getQueryData()` is not reactive -
 * it's a synchronous snapshot that doesn't trigger re-renders when cache is updated.
 *
 * By using `useQuery` with `enabled: false`, we subscribe to cache changes and
 * automatically re-render when `setQueryData()` is called elsewhere.
 *
 * @example
 * // In your subscription hook:
 * queryClient.setQueryData(queryKey, transformedData);
 *
 * // To read reactively:
 * const { data, isLoading } = useReactiveQueryData<Client[]>({
 *   queryKey,
 *   defaultValue: [],
 *   enabled: !!ownerId,
 * });
 */

interface UseReactiveQueryDataOptions<T> {
  /** The React Query cache key to subscribe to */
  queryKey: QueryKey;
  /** Default value when cache is empty */
  defaultValue: T;
  /** Whether the hook should be considered "enabled" for loading state calculation */
  enabled?: boolean;
}

interface UseReactiveQueryDataResult<T> {
  /** The cached data or default value */
  data: T;
  /** True when enabled but data hasn't been set yet */
  isLoading: boolean;
}

/**
 * Provides reactive access to React Query cache with proper loading states.
 * Use this when you're populating the cache via `setQueryData()` from onSnapshot listeners.
 */
export function useReactiveQueryData<T>({
  queryKey,
  defaultValue,
  enabled = true,
}: UseReactiveQueryDataOptions<T>): UseReactiveQueryDataResult<T> {
  const { data } = useQuery<T>({
    queryKey,
    // This queryFn is never called because enabled is false
    // It just satisfies TypeScript and provides a fallback type
    queryFn: () => Promise.resolve(defaultValue),
    enabled: false, // We manage data via setQueryData, not queryFn
    staleTime: Infinity, // Data is managed externally, never stale
  });

  return {
    data: data ?? defaultValue,
    isLoading: data === undefined && enabled,
  };
}
