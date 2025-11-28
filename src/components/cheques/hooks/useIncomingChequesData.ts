"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Cheque } from "../types/cheques";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";

interface UseIncomingChequesDataReturn {
  cheques: Cheque[];
  pendingCheques: Cheque[];
  clearedCheques: Cheque[];
  endorsedCheques: Cheque[];
  bouncedCheques: Cheque[];
  totalPendingValue: number;
  totalClearedValue: number;
  loading: boolean;
}

export function useIncomingChequesData(): UseIncomingChequesDataReturn {
  const { user } = useUser();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
    // Filter for incoming cheques only
    const q = query(
      chequesRef,
      where("type", "==", CHEQUE_TYPES.INCOMING),
      orderBy("dueDate", "desc"),
      limit(1000)
    );

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
  }, [user]);

  // Calculate summary statistics
  const pendingCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.PENDING);
  const clearedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.CASHED);
  const endorsedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.ENDORSED);
  const bouncedCheques = cheques.filter(c => c.status === CHEQUE_STATUS_AR.BOUNCED);

  const totalPendingValue = pendingCheques.reduce((sum, c) => sum + c.amount, 0);
  const totalClearedValue = clearedCheques.reduce((sum, c) => sum + c.amount, 0);

  return {
    cheques,
    pendingCheques,
    clearedCheques,
    endorsedCheques,
    bouncedCheques,
    totalPendingValue,
    totalClearedValue,
    loading,
  };
}
