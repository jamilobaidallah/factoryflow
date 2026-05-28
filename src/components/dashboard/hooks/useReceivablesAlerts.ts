"use client";

import { useState, useEffect, useMemo } from "react";
import type { DocumentData } from "firebase/firestore";
import { collection, onSnapshot, query, limit } from "firebase/firestore";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { QUERY_LIMITS } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";
import type { UseReceivablesAlertsReturn } from "../types/dashboard.types";
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
 * Hook for fetching unpaid receivables and payables alerts.
 * When selectedMonth is provided (format "YYYY-MM"), only entries
 * created in that month are counted.
 */
export function useReceivablesAlerts(selectedMonth?: string): UseReceivablesAlertsReturn {
  const { user } = useUser();
  // Raw docs stored separately so the Firestore subscription never re-fires when
  // selectedMonth changes — month filtering is pure in-memory via useMemo below.
  const [rawDocs, setRawDocs] = useState<DocumentData[]>([]);

  // Subscribe only on user change — NOT on selectedMonth.
  // This prevents tearing down and recreating a 5000-doc listener every time the
  // user switches the month selector.
  useEffect(() => {
    if (!user) { setRawDocs([]); return; }

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    const ledgerQuery = query(ledgerRef, limit(QUERY_LIMITS.DASHBOARD_ENTRIES));

    const unsubscribe = onSnapshot(
      ledgerQuery,
      (snapshot) => {
        if (snapshot.size >= QUERY_LIMITS.DASHBOARD_ENTRIES) {
          showLimitWarning(
            'Receivables alerts',
            QUERY_LIMITS.DASHBOARD_ENTRIES,
            'بعض قيود الذمم المدينة/الدائنة قد لا تظهر. يُنصح بأرشفة القيود القديمة.'
          );
        }
        setRawDocs(snapshot.docs.map((d) => d.data()));
      },
      (error) => {
        console.error('Receivables alerts subscription error:', error);
        toast({
          title: "خطأ في تحميل بيانات الذمم",
          description: "تعذّر تحميل بيانات الذمم المدينة والدائنة. يرجى تحديث الصفحة.",
          variant: "destructive",
        });
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Derive counts in-memory when rawDocs or selectedMonth changes (no Firestore round-trip)
  const { unpaidReceivables, unpaidPayables } = useMemo(() => {
    let monthFrom: Date | null = null;
    let monthTo: Date | null = null;
    if (selectedMonth) {
      const [yearStr, monthStr] = selectedMonth.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      monthFrom = new Date(year, month - 1, 1, 0, 0, 0, 0);
      monthTo = new Date(year, month, 0, 23, 59, 59, 999);
    }

    let receivablesCount = 0;
    let receivablesTotal = 0;
    let payablesCount = 0;
    let payablesTotal = 0;

    for (const data of rawDocs) {
      if (monthFrom && monthTo) {
        const raw = data.date;
        const entryDate: Date = raw?.toDate ? raw.toDate() : new Date(raw as string);
        if (entryDate < monthFrom || entryDate > monthTo) continue;
      }
      const outstanding = getOutstandingAmount(data);
      if (isOutstandingReceivable(data)) { receivablesCount++; receivablesTotal += outstanding; }
      if (isOutstandingPayable(data))    { payablesCount++;    payablesTotal    += outstanding; }
    }

    return {
      unpaidReceivables: { count: receivablesCount, total: receivablesTotal },
      unpaidPayables:    { count: payablesCount,    total: payablesTotal    },
    };
  }, [rawDocs, selectedMonth]);

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
