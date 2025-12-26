import { useLedgerPageData } from "@/hooks/firebase-query";

interface UseLedgerDataOptions {
    pageSize?: number;
    currentPage?: number;
}

/**
 * Custom hook to fetch and manage ledger data with cursor-based pagination
 * Uses React Query with Firestore subscriptions for real-time updates
 *
 * Returns both paginated entries (for table display) and all entries (for stats calculation)
 */
export function useLedgerData(options: UseLedgerDataOptions = {}) {
    const { pageSize = 50, currentPage = 1 } = options;

    // Use the combined React Query hook for all ledger page data
    const {
        entries,
        allEntriesForStats,
        clients,
        partners,
        totalCount,
        totalPages,
        lastDoc,
        loading,
        statsLoading,
    } = useLedgerPageData({ pageSize, currentPage });

    return {
        entries,
        allEntriesForStats,
        clients,
        partners,
        totalCount,
        lastDoc,
        totalPages,
        loading,
        statsLoading,
    };
}
