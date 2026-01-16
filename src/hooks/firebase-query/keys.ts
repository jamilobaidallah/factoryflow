/**
 * Query key factory for React Query
 *
 * Hierarchical structure allows for granular invalidation:
 * - queryClient.invalidateQueries({ queryKey: queryKeys.clients.all(ownerId) }) - all client queries
 * - queryClient.invalidateQueries({ queryKey: queryKeys.clients.balances(ownerId) }) - just balances
 */

export const queryKeys = {
  // Client queries
  clients: {
    all: (ownerId: string) => ['clients', ownerId] as const,
    detail: (ownerId: string, clientId: string) => ['clients', ownerId, clientId] as const,
    balances: (ownerId: string) => ['clients', ownerId, 'balances'] as const,
  },

  // Ledger queries
  ledger: {
    all: (ownerId: string) => ['ledger', ownerId] as const,
    list: (ownerId: string, filters?: Record<string, unknown>) =>
      ['ledger', ownerId, 'list', filters] as const,
    paginated: (ownerId: string, page: number) =>
      ['ledger', ownerId, 'page', page] as const,
    detail: (ownerId: string, entryId: string) =>
      ['ledger', ownerId, entryId] as const,
    stats: (ownerId: string) => ['ledger', ownerId, 'stats'] as const,
  },

  // Cheques queries
  cheques: {
    all: (ownerId: string) => ['cheques', ownerId] as const,
    pending: (ownerId: string) => ['cheques', ownerId, 'pending'] as const,
    alerts: (ownerId: string) => ['cheques', ownerId, 'alerts'] as const,
  },

  // Payments queries
  payments: {
    all: (ownerId: string) => ['payments', ownerId] as const,
    byClient: (ownerId: string, clientId: string) =>
      ['payments', ownerId, 'client', clientId] as const,
  },

  // Partners queries
  partners: {
    all: (ownerId: string) => ['partners', ownerId] as const,
    detail: (ownerId: string, partnerId: string) =>
      ['partners', ownerId, partnerId] as const,
  },

  // Dashboard queries
  dashboard: {
    all: (ownerId: string) => ['dashboard', ownerId] as const,
    stats: (ownerId: string) => ['dashboard', ownerId, 'stats'] as const,
    receivables: (ownerId: string) => ['dashboard', ownerId, 'receivables'] as const,
  },

  // Inventory queries
  inventory: {
    all: (ownerId: string) => ['inventory', ownerId] as const,
    items: (ownerId: string) => ['inventory', ownerId, 'items'] as const,
  },

  // Ledger Favorites queries
  favorites: {
    all: (ownerId: string) => ['favorites', ownerId] as const,
  },
} as const;

// Type helper for query keys
export type QueryKeys = typeof queryKeys;
