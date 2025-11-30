import { useState, useEffect, useRef } from "react";
import { useUser } from "@/firebase/provider";
import { LedgerEntry } from "../utils/ledger-constants";
import { createLedgerService } from "@/services/ledgerService";
import { DocumentSnapshot } from "firebase/firestore";

interface UseLedgerDataOptions {
    pageSize?: number;
    currentPage?: number;
}

/**
 * Custom hook to fetch and manage ledger data with cursor-based pagination
 * Uses LedgerService for all Firestore operations
 */
export function useLedgerData(options: UseLedgerDataOptions = {}) {
    const { pageSize = 50, currentPage = 1 } = options;
    const { user } = useUser();
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    // Store page cursors for cursor-based pagination (using ref to avoid re-renders)
    const pageCursorsRef = useRef<Map<number, DocumentSnapshot>>(new Map());

    // Load total count of entries
    useEffect(() => {
        if (!user) { return; }

        const service = createLedgerService(user.uid);
        service.getTotalCount().then((count) => {
            setTotalCount(count);
        });
    }, [user]);

    // Load ledger entries with cursor-based pagination
    useEffect(() => {
        if (!user) { return; }

        const service = createLedgerService(user.uid);

        // Get cursor for current page (from previous page)
        const startAfterDoc = currentPage > 1
            ? pageCursorsRef.current.get(currentPage - 1) || null
            : null;

        const unsubscribe = service.subscribeLedgerEntries(
            pageSize,
            (entriesData, lastVisible) => {
                setEntries(entriesData);
                setLastDoc(lastVisible);

                // Store cursor for this page (to enable navigating to next page)
                if (lastVisible) {
                    pageCursorsRef.current.set(currentPage, lastVisible);
                }

                setLoading(false);
            },
            (error) => {
                console.error("Error fetching ledger entries:", error);
                setLoading(false);
            },
            startAfterDoc
        );

        return () => unsubscribe();
    }, [user, pageSize, currentPage]);

    // Load clients list for dropdown
    useEffect(() => {
        if (!user) { return; }

        const service = createLedgerService(user.uid);

        const unsubscribe = service.subscribeClients(
            (clientsData) => {
                setClients(clientsData);
            },
            (error) => {
                console.error("Error fetching clients:", error);
            }
        );

        return () => unsubscribe();
    }, [user]);

    // Load partners list for dropdown
    useEffect(() => {
        if (!user) { return; }

        const service = createLedgerService(user.uid);

        const unsubscribe = service.subscribePartners(
            (partnersData) => {
                setPartners(partnersData);
            },
            (error) => {
                console.error("Error fetching partners:", error);
            }
        );

        return () => unsubscribe();
    }, [user]);

    return {
        entries,
        clients,
        partners,
        totalCount,
        lastDoc,
        totalPages: Math.ceil(totalCount / pageSize),
        loading,
    };
}
