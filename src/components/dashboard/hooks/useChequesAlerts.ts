"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { toDate, type FirestoreDateValue } from "@/lib/firestore-utils";
import type { AlertData, UseChequesAlertsReturn } from "../types/dashboard.types";
import { DASHBOARD_CONFIG, CHEQUE_PENDING_STATUS } from "../constants/dashboard.constants";

/**
 * Hook for fetching cheques due soon alerts
 * Queries pending cheques with due dates within configured days
 */
export function useChequesAlerts(): UseChequesAlertsReturn {
  const { user } = useUser();
  const [chequesDueSoon, setChequesDueSoon] = useState<AlertData>({ count: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const unsubscribe = onSnapshot(chequesRef, (snapshot) => {
      const now = new Date();
      const futureDate = calculateFutureDate(now, DASHBOARD_CONFIG.CHEQUE_DUE_DAYS);

      let count = 0;
      let total = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        if (isEligibleForAlert(data, futureDate)) {
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

/** Check if cheque should appear in due soon alert */
function isEligibleForAlert(
  data: { status?: string; dueDate?: FirestoreDateValue; isEndorsedCheque?: boolean },
  futureDate: Date
): boolean {
  const isPending = data.status === CHEQUE_PENDING_STATUS;
  const isEndorsed = data.isEndorsedCheque === true;
  const dueDate = toDate(data.dueDate);
  const isDueSoon = dueDate <= futureDate;

  return isPending && !isEndorsed && isDueSoon;
}
