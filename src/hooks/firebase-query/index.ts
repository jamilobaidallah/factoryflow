// Query key factory
export { queryKeys, type QueryKeys } from './keys';

// Base Firestore hooks
export {
  useFirestoreSubscription,
  useFirestoreQuery,
} from './useFirestoreSubscription';

// Dashboard hooks
export {
  useLedgerDashboardData,
  usePaymentsDashboardData,
  type LedgerDashboardData,
  type PaymentsDashboardData,
} from './useDashboardQueries';

// Clients hooks
export {
  useClientsPageData,
  useClientsSubscription,
  usePendingChequesSubscription,
  useLedgerEntriesSubscription as useClientsLedgerEntriesSubscription,
  usePaymentsSubscription,
  type Client,
  type Cheque,
  type LedgerEntry as ClientLedgerEntry,
  type Payment,
  type ClientBalance,
} from './useClientsQueries';

// Ledger page hooks
export {
  useLedgerPageData,
  useLedgerEntriesSubscription,
  useLedgerStatsSubscription,
  useLedgerClientsSubscription,
  useLedgerPartnersSubscription,
  useLedgerTotalCount,
  type NamedEntity,
} from './useLedgerQueries';

// Reactive query data utility
export { useReactiveQueryData } from './useReactiveQueryData';

// Re-export React Query utilities for convenience
export {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
} from '@tanstack/react-query';
