"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  getCountFromServer,
  getDocs,
  startAfter,
  type DocumentSnapshot,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Cheque } from "../types/cheques";
import { convertFirestoreDates } from "@/lib/firestore-utils";

// Singleton cursor store for pagination (persists across re-renders)
// Cursors are cleared when:
// - User navigates to page 1 (natural refresh point)
// - Data changes are detected in the snapshot
const chequesCursorStore = {
  cursors: new Map<string, Map<number, DocumentSnapshot>>(),

  getCursors(ownerId: string): Map<number, DocumentSnapshot> {
    if (!this.cursors.has(ownerId)) {
      this.cursors.set(ownerId, new Map());
    }
    return this.cursors.get(ownerId)!;
  },

  setCursor(ownerId: string, page: number, doc: DocumentSnapshot) {
    this.getCursors(ownerId).set(page, doc);
  },

  getCursor(ownerId: string, page: number): DocumentSnapshot | undefined {
    return this.getCursors(ownerId).get(page);
  },

  clear(ownerId: string) {
    this.cursors.delete(ownerId);
  },
};

interface UseChequesDataOptions {
  pageSize: number;
  currentPage: number;
}

interface UseChequesDataReturn {
  cheques: Cheque[];
  clientPhones: Record<string, string>;
  totalCount: number;
  totalPages: number;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useChequesData({ pageSize, currentPage }: UseChequesDataOptions): UseChequesDataReturn {
  const { user } = useUser();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [clientPhones, setClientPhones] = useState<Record<string, string>>({});
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Fetch total count
  useEffect(() => {
    if (!user) {return;}

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    getCountFromServer(query(chequesRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Fetch client phone numbers
  useEffect(() => {
    if (!user) {return;}

    const clientsRef = collection(firestore, `users/${user.dataOwnerId}/clients`);
    const unsubscribe = onSnapshot(clientsRef, (snapshot) => {
      const phones: Record<string, string> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.phone) {
          phones[data.name] = data.phone;
        }
      });
      setClientPhones(phones);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch cheques with cursor-based pagination
  useEffect(() => {
    if (!user) {return;}

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);

    // Clear all cursors when navigating to page 1 (fresh start)
    if (currentPage === 1) {
      chequesCursorStore.clear(user.dataOwnerId);
    }

    // Get cursor for previous page (if not on page 1)
    const startAfterDoc = currentPage > 1
      ? chequesCursorStore.getCursor(user.dataOwnerId, currentPage - 1)
      : undefined;

    // Build query with or without cursor
    const q = startAfterDoc
      ? query(chequesRef, orderBy("dueDate", "desc"), startAfter(startAfterDoc), limit(pageSize))
      : query(chequesRef, orderBy("dueDate", "desc"), limit(pageSize));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Clear cursors for pages after current if data changed (prevents stale pagination)
      if (!snapshot.metadata.fromCache && snapshot.docChanges().length > 0) {
        const cursors = chequesCursorStore.getCursors(user.dataOwnerId);
        Array.from(cursors.keys()).forEach((page) => {
          if (page > currentPage) {
            cursors.delete(page);
          }
        });
      }

      const chequesData: Cheque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        chequesData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as Cheque);
      });

      // Store cursor for this page (last document)
      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      if (lastVisible) {
        chequesCursorStore.setCursor(user.dataOwnerId, currentPage, lastVisible);
      }

      setCheques(chequesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, pageSize, currentPage]);

  const refresh = async () => {
    if (!user) {return;}

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);

    // Get cursor for previous page (if not on page 1)
    const startAfterDoc = currentPage > 1
      ? chequesCursorStore.getCursor(user.dataOwnerId, currentPage - 1)
      : undefined;

    // Build query with or without cursor
    const q = startAfterDoc
      ? query(chequesRef, orderBy("dueDate", "desc"), startAfter(startAfterDoc), limit(pageSize))
      : query(chequesRef, orderBy("dueDate", "desc"), limit(pageSize));

    const snapshot = await getDocs(q);

    const chequesData: Cheque[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      chequesData.push({
        id: doc.id,
        ...convertFirestoreDates(data),
      } as Cheque);
    });

    // Update cursor for this page
    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
    if (lastVisible) {
      chequesCursorStore.setCursor(user.dataOwnerId, currentPage, lastVisible);
    }

    setCheques(chequesData);
  };

  return {
    cheques,
    clientPhones,
    totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    loading,
    refresh,
  };
}
