"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { toDate, type FirestoreDateValue } from "@/lib/firestore-utils";
import type { AlertData, UseChequesAlertsReturn } from "../types/dashboard.types";
import { DASHBOARD_CONFIG, CHEQUE_PENDING_STATUS } from "../constants/dashboard.constants";
import { QUERY_LIMITS } from "@/lib/constants";

/**
 * Hook for fetching cheques due soon alerts
 * Queries pending cheques with due dates within configured days
 */
export function useChequesAlerts(): UseChequesAlertsReturn {
  const { user } = useUser();
  const [chequesDueSoon, setChequesDueSoon] = useState<AlertData>({ count: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {return;}

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const now = new Date();
    const futureDate = calculateFutureDate(now, DASHBOARD_CONFIG.CHEQUE_DUE_DAYS);

    // Server-side filtering for pending cheques only (reduces 90%+ of documents)
    // Date and endorsement filtering kept in-memory to avoid complex compound index
    const q = query(
      chequesRef,
      where("status", "==", CHEQUE_PENDING_STATUS),
      limit(QUERY_LIMITS.PENDING_CHEQUES)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      let total = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const dueDate = toDate(data.dueDate);
        // Filter by date and endorsement in-memory (simpler than compound index)
        if (dueDate <= futureDate && data.isEndorsedCheque !== true) {
          count++;
          total += data.amount || 0;
        }
      });

      setChequesDueSoon({ count, total });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { chequesDueSoon, isLoading };
}

/** Calculate date X days in the future */
function calculateFutureDate(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

