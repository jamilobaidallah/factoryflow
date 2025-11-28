"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Cheque } from "../types/cheques";

interface UseOutgoingChequesDataReturn {
  cheques: Cheque[];
  loading: boolean;
  refresh: () => void;
}

export function useOutgoingChequesData(): UseOutgoingChequesDataReturn {
  const { user } = useUser();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch outgoing cheques with real-time updates
  useEffect(() => {
    if (!user) return;

    const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
    // Filter for outgoing cheques only
    const q = query(
      chequesRef,
      where("type", "==", "صادر"),
      orderBy("dueDate", "desc"),
      limit(1000)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chequesData: Cheque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        chequesData.push({
          id: doc.id,
          ...data,
          issueDate: data.issueDate?.toDate ? data.issueDate.toDate() : new Date(),
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          endorsedDate: data.endorsedDate?.toDate?.() || undefined,
        } as Cheque);
      });
      setCheques(chequesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, refreshKey]);

  const refresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return {
    cheques,
    loading,
    refresh,
  };
}
