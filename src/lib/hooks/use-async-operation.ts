/**
 * Custom Hook for Async Operations
 *
 * Handles loading states, errors, and provides consistent pattern
 * for async operations throughout the application.
 */

import { useState, useCallback } from 'react';
import { handleFirebaseError, logError, ErrorResult } from '../error-handler';

interface UseAsyncOperationOptions {
  onSuccess?: (data?: any) => void;
  onError?: (error: ErrorResult) => void;
  context?: string;
}

interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: ErrorResult | null;
}

interface AsyncOperationReturn<T, Args extends any[]> {
  execute: (...args: Args) => Promise<T | undefined>;
  loading: boolean;
  error: ErrorResult | null;
  data: T | null;
  reset: () => void;
}

/**
 * Hook for managing async operations with loading, error, and data states
 *
 * @param asyncFunction - The async function to execute
 * @param options - Configuration options
 * @returns Object with execute function, loading state, error, data, and reset
 *
 * @example
 * const { execute, loading, error } = useAsyncOperation(
 *   async (id: string) => await deletePayment(id),
 *   {
 *     onSuccess: () => toast({ title: 'Deleted' }),
 *     context: 'DeletePayment'
 *   }
 * );
 */
export function useAsyncOperation<T, Args extends any[] = []>(
  asyncFunction: (...args: Args) => Promise<T>,
  options: UseAsyncOperationOptions = {}
): AsyncOperationReturn<T, Args> {
  const { onSuccess, onError, context = 'AsyncOperation' } = options;

  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      setState({ data: null, loading: true, error: null });

      try {
        const result = await asyncFunction(...args);
        setState({ data: result, loading: false, error: null });

        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        const errorResult = handleFirebaseError(error);
        setState({ data: null, loading: false, error: errorResult });

        logError(context, error);

        if (onError) {
          onError(errorResult);
        }

        return undefined;
      }
    },
    [asyncFunction, onSuccess, onError, context]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    execute,
    loading: state.loading,
    error: state.error,
    data: state.data,
    reset,
  };
}
