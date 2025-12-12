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
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Cheque } from "../types/cheques";
import { convertFirestoreDates } from "@/lib/firestore-utils";

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
    if (!user) return;

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    getCountFromServer(query(chequesRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Fetch client phone numbers
  useEffect(() => {
    if (!user) return;

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

  // Fetch cheques with pagination
  useEffect(() => {
    if (!user) return;

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const q = query(chequesRef, orderBy("dueDate", "desc"), limit(pageSize));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chequesData: Cheque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        chequesData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as Cheque);
      });
      setCheques(chequesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, pageSize, currentPage]);

  const refresh = async () => {
    if (!user) return;

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const q = query(chequesRef, orderBy("dueDate", "desc"), limit(pageSize));
    const snapshot = await getDocs(q);

    const chequesData: Cheque[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      chequesData.push({
        id: doc.id,
        ...convertFirestoreDates(data),
      } as Cheque);
    });

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
