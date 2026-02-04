"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, limit } from "firebase/firestore";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { QUERY_LIMITS } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import type { AlertData, UseReceivablesAlertsReturn } from "../types/dashboard.types";
import { INCOME_TYPES, EXPENSE_TYPE } from "../constants/dashboard.constants";

/** Outstanding payment statuses */
const OUTSTANDING_STATUSES = ["unpaid", "partial"] as const;

/** Track which limit warnings have been shown this session */
const shownLimitWarnings = new Set<string>();

/** Show a warning toast when query limit is reached */
function showLimitWarning(limitType: string, limitValue: number, message: string) {
  const warningKey = `${limitType}-${limitValue}`;
  if (shownLimitWarnings.has(warningKey)) {
    return; // Already shown this session
  }
  shownLimitWarnings.add(warningKey);

  console.warn(`${limitType} limit reached (${limitValue}). ${message}`);
  toast({
    title: "تحذير: تجاوز حد البيانات",
    description: message,
    variant: "destructive",
    duration: 10000,
  });
}

/**
 * Hook for fetching unpaid receivables and payables alerts
 * Queries AR/AP entries with unpaid or partial payment status
 */
export function useReceivablesAlerts(): UseReceivablesAlertsReturn {
  const { user } = useUser();
  const [unpaidReceivables, setUnpaidReceivables] = useState<AlertData>({ count: 0, total: 0 });
  const [unpaidPayables, setUnpaidPayables] = useState<AlertData>({ count: 0, total: 0 });

  useEffect(() => {
    if (!user) {return;}

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    // Add limit to prevent loading unbounded data
    const ledgerQuery = query(ledgerRef, limit(QUERY_LIMITS.DASHBOARD_ENTRIES));

    const unsubscribe = onSnapshot(ledgerQuery, (snapshot) => {
      // Show warning if limit is reached (data may be incomplete)
      if (snapshot.size >= QUERY_LIMITS.DASHBOARD_ENTRIES) {
        showLimitWarning(
          'Receivables alerts',
          QUERY_LIMITS.DASHBOARD_ENTRIES,
          'بعض قيود الذمم المدينة/الدائنة قد لا تظهر. يُنصح بأرشفة القيود القديمة.'
        );
      }

      let receivablesCount = 0;
      let receivablesTotal = 0;
      let payablesCount = 0;
      let payablesTotal = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        const outstanding = getOutstandingAmount(data);

        // Count AR entries (income type) with outstanding balances
        if (isOutstandingReceivable(data)) {
          receivablesCount++;
          receivablesTotal += outstanding;
        }

        // Count AP entries (expense type) with outstanding balances
        if (isOutstandingPayable(data)) {
          payablesCount++;
          payablesTotal += outstanding;
        }
      });

      setUnpaidReceivables({ count: receivablesCount, total: receivablesTotal });
      setUnpaidPayables({ count: payablesCount, total: payablesTotal });
    });

    return () => unsubscribe();
  }, [user]);

  return { unpaidReceivables, unpaidPayables };
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

/** Check if entry is an outstanding payable */
function isOutstandingPayable(data: Record<string, unknown>): boolean {
  // Check if it's an AR/AP entry - use truthy check for compatibility
  const isARAPEntry = Boolean(data.isARAPEntry);

  // Check if it's an expense type (payable)
  const isExpenseType = data.type === EXPENSE_TYPE;

  // Check if payment status indicates outstanding balance
  const hasOutstandingStatus = OUTSTANDING_STATUSES.includes(
    data.paymentStatus as typeof OUTSTANDING_STATUSES[number]
  );

  // If entry has paymentStatus, it's definitely an AR/AP entry
  // This handles legacy entries that might not have isARAPEntry flag
  const hasPaymentTracking = data.paymentStatus !== undefined;

  return (isARAPEntry || hasPaymentTracking) && isExpenseType && hasOutstandingStatus;
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
