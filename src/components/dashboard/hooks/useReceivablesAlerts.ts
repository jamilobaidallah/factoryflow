"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import type { AlertData, UseReceivablesAlertsReturn } from "../types/dashboard.types";
import { INCOME_TYPES } from "../constants/dashboard.constants";

/** Outstanding payment statuses */
const OUTSTANDING_STATUSES = ["unpaid", "partial"] as const;

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
          // Use remainingBalance if available, otherwise use amount for unpaid entries
          const outstanding = getOutstandingAmount(data);
          total += outstanding;
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
  // Check if it's an AR/AP entry - use truthy check for compatibility
  const isARAPEntry = Boolean(data.isARAPEntry);

  // Check if it's an income type (receivable vs payable)
  const isIncomeType = INCOME_TYPES.some((type) => data.type === type);

  // Check if payment status indicates outstanding balance
  const hasOutstandingStatus = OUTSTANDING_STATUSES.includes(
    data.paymentStatus as typeof OUTSTANDING_STATUSES[number]
  );

  // If entry has paymentStatus, it's definitely an AR/AP entry
  // This handles legacy entries that might not have isARAPEntry flag
  const hasPaymentTracking = data.paymentStatus !== undefined;

  return (isARAPEntry || hasPaymentTracking) && isIncomeType && hasOutstandingStatus;
}

/** Get the outstanding amount for an entry */
function getOutstandingAmount(data: Record<string, unknown>): number {
  // For partial payments, remainingBalance is accurate
  if (typeof data.remainingBalance === "number" && data.remainingBalance > 0) {
    return data.remainingBalance;
  }

  // For unpaid entries without remainingBalance, use amount
  if (data.paymentStatus === "unpaid" && typeof data.amount === "number") {
    return data.amount;
  }

  return 0;
}
