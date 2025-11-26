import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
    limit,
    startAfter,
    DocumentSnapshot,
    getCountFromServer,
} from "firebase/firestore";
import { LedgerEntry } from "../utils/ledger-constants";

interface UseLedgerDataOptions {
    pageSize?: number;
    currentPage?: number;
}

/**
 * Custom hook to fetch and manage ledger data with pagination
 * Handles real-time subscriptions to ledger entries, clients, and partners
 */
export function useLedgerData(options: UseLedgerDataOptions = {}) {
    const { pageSize = 50, currentPage = 1 } = options;
    const { user } = useUser();
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
    const [totalCount, setTotalCount] = useState(0);
    const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

    // Load total count of entries
    useEffect(() => {
        if (!user) return;

        const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
        getCountFromServer(query(ledgerRef)).then((snapshot) => {
            setTotalCount(snapshot.data().count);
        });
    }, [user]);

    // Load ledger entries with pagination
    useEffect(() => {
        if (!user) {return;}

        const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
        let q = query(ledgerRef, orderBy("date", "desc"), limit(pageSize));

        // For pages after the first, we need to skip
        // Note: Firestore doesn't support offset, so we use limit for now
        // For true pagination, we'd need to track the last document of previous page

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData: LedgerEntry[] = [];
            let lastVisible: DocumentSnapshot | null = null;

            snapshot.forEach((doc) => {
                const data = doc.data();
                entriesData.push({
                    id: doc.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(),
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                } as LedgerEntry);
                lastVisible = doc;
            });

            setEntries(entriesData);
            setLastDoc(lastVisible);
        });

        return () => unsubscribe();
    }, [user, pageSize, currentPage]);

    // Load clients list for dropdown
    useEffect(() => {
        if (!user) {return;}

        const clientsRef = collection(firestore, `users/${user.uid}/clients`);
        const q = query(clientsRef, orderBy("name", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clientsData: { id: string; name: string }[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                clientsData.push({
                    id: doc.id,
                    name: data.name || "",
                });
            });
            setClients(clientsData);
        });

        return () => unsubscribe();
    }, [user]);

    // Load partners list for dropdown
    useEffect(() => {
        if (!user) {return;}

        const partnersRef = collection(firestore, `users/${user.uid}/partners`);
        const q = query(partnersRef, orderBy("name", "asc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const partnersData: { id: string; name: string }[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (data.active !== false) {  // Only include active partners
                    partnersData.push({
                        id: doc.id,
                        name: data.name || "",
                    });
                }
            });
            setPartners(partnersData);
        });

        return () => unsubscribe();
    }, [user]);

    return {
        entries,
        clients,
        partners,
        totalCount,
        lastDoc,
        totalPages: Math.ceil(totalCount / pageSize),
    };
}
