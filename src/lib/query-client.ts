import { QueryClient } from '@tanstack/react-query';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Match existing 5-minute cache in useAllClients
        staleTime: 5 * 60 * 1000,
        // Keep unused data in cache for 30 minutes
        gcTime: 30 * 60 * 1000,
        // Single retry on failure
        retry: 1,
        // Don't refetch on window focus - accounting data should be stable
        refetchOnWindowFocus: false,
        // Don't refetch on reconnect - we use onSnapshot for real-time
        refetchOnReconnect: false,
      },
    },
  });
}
