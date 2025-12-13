"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { toDate } from "@/lib/firestore-utils";
import type { AlertData, UseReceivablesAlertsReturn } from "../types/dashboard.types";
import { INCOME_TYPES } from "../constants/dashboard.constants";

/**
 * Hook for fetching unpaid receivables alerts
 * Queries AR entries with unpaid or partial payment status
 */
export function useReceivablesAlerts(): UseReceivablesAlertsReturn {
  const { user } = useUser();
  const [unpaidReceivables, setUnpaidReceivables] = useState<AlertData>({ count: 0, total: 0 });

  useEffect(() => {
    if (!user) return;

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    const unsubscribe = onSnapshot(ledgerRef, (snapshot) => {
      let count = 0;
      let total = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Only count AR entries (income type) with outstanding balances
        if (isOutstandingReceivable(data)) {
          count++;
          total += data.remainingBalance || data.amount || 0;
        }
      });

      setUnpaidReceivables({ count, total });
    });

    return () => unsubscribe();
  }, [user]);

  return { unpaidReceivables };
}

/** Check if entry is an outstanding receivable */
function isOutstandingReceivable(data: Record<string, unknown>): boolean {
  const isARAPEntry = data.isARAPEntry === true;
  const isIncomeType = INCOME_TYPES.some((type) => data.type === type);
  const isOutstanding = data.paymentStatus === "unpaid" || data.paymentStatus === "partial";

  return isARAPEntry && isIncomeType && isOutstanding;
}
