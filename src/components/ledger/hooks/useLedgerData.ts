import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import {
    collection,
    onSnapshot,
    query,
    orderBy,
} from "firebase/firestore";
import { LedgerEntry } from "../utils/ledger-constants";

/**
 * Custom hook to fetch and manage ledger data
 * Handles real-time subscriptions to ledger entries, clients, and partners
 */
export function useLedgerData() {
    const { user } = useUser();
    const [entries, setEntries] = useState<LedgerEntry[]>([]);
    const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
    const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);

    // Load ledger entries
    useEffect(() => {
        if (!user) {return;}

        const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
        const q = query(ledgerRef, orderBy("date", "desc"));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const entriesData: LedgerEntry[] = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                entriesData.push({
                    id: doc.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(),
                    createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
                } as LedgerEntry);
            });
            setEntries(entriesData);
        });

        return () => unsubscribe();
    }, [user]);

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
    };
}
