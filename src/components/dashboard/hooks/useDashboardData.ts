"use client";

import { useMemo } from "react";
import {
  useLedgerDashboardData,
  usePaymentsDashboardData,
} from "@/hooks/firebase-query/useDashboardQueries";
import type { UseDashboardDataReturn } from "../types/dashboard.types";
import {
  classifyOutstanding,
  getOutstandingAmount,
} from "./receivablesClassification";

/**
 * Hook for fetching and managing all dashboard data.
 *
 * When selectedMonth is provided (format "YYYY-MM"), the AR/AP alert counts
 * are filtered to that month only. Pass undefined for all-time totals.
 *
 * AR/AP counts are derived in-memory from the same ledger snapshot already
 * loaded for P&L — no second Firestore listener is opened.
 */
export function useDashboardData(selectedMonth?: string): UseDashboardDataReturn {
  // Fetch ledger data (P&L, financing cash, loans, transactions, AR/AP candidates)
  const { data: ledgerData, isLoading: isLedgerLoading } = useLedgerDashboardData();

  // Fetch payments data (operating cash in/out)
  const { data: paymentsData, isLoading: isPaymentsLoading } = usePaymentsDashboardData();

  // Extract values with defaults
  const totalRevenue = ledgerData?.totalRevenue ?? 0;
  const totalExpenses = ledgerData?.totalExpenses ?? 0;
  const totalDiscounts = ledgerData?.totalDiscounts ?? 0;
  const totalBadDebt = ledgerData?.totalBadDebt ?? 0;
  const totalExpenseDiscounts = ledgerData?.totalExpenseDiscounts ?? 0;
  const totalExpenseWriteoffs = ledgerData?.totalExpenseWriteoffs ?? 0;
  const financingCashIn = ledgerData?.financingCashIn ?? 0;
  const financingCashOut = ledgerData?.financingCashOut ?? 0;
  const loansReceivable = ledgerData?.loansReceivable ?? 0;
  const loansPayable = ledgerData?.loansPayable ?? 0;
  const loanCashIn = ledgerData?.loanCashIn ?? 0;
  const loanCashOut = ledgerData?.loanCashOut ?? 0;
  const monthlyDataMap = ledgerData?.monthlyDataMap ?? new Map();
  const expensesByCategoryMap = ledgerData?.expensesByCategoryMap ?? new Map();
  const recentTransactions = ledgerData?.recentTransactions ?? [];

  const operatingCashIn = paymentsData?.operatingCashIn ?? 0;
  const operatingCashOut = paymentsData?.operatingCashOut ?? 0;

  // Total cash = Operating (from payments) + Financing (from ledger equity + loans)
  const totalCashIn = operatingCashIn + financingCashIn + loanCashIn;
  const totalCashOut = operatingCashOut + financingCashOut + loanCashOut;

  // Derive AR/AP alert counts in-memory — no Firestore round-trip.
  // Month filtering is pure in-memory; Firestore subscription is NOT re-created on month change.
  // ledgerData is a stable React Query reference; it only changes when the snapshot fires.
  const { unpaidReceivables, unpaidPayables } = useMemo(() => {
    const arApCandidates = ledgerData?.arApCandidates ?? [];
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

    for (const entry of arApCandidates) {
      if (monthFrom && monthTo) {
        if (entry.date < monthFrom || entry.date > monthTo) { continue; }
      }

      // Shared classifier: advances flip to the opposite side and loans (initial
      // entries only) are included on the correct side. See receivablesClassification.ts.
      const side = classifyOutstanding(entry as unknown as Record<string, unknown>);
      if (!side) { continue; }

      const outstanding = getOutstandingAmount(entry as unknown as Record<string, unknown>);
      if (side === "receivable") { receivablesCount++; receivablesTotal += outstanding; }
      else                       { payablesCount++;    payablesTotal    += outstanding; }
    }

    return {
      unpaidReceivables: { count: receivablesCount, total: receivablesTotal },
      unpaidPayables:    { count: payablesCount,    total: payablesTotal    },
    };
  }, [ledgerData, selectedMonth]);

  // Combined loading state
  const isLoading = isLedgerLoading || isPaymentsLoading;

  return {
    totalCashIn,
    totalCashOut,
    cashBalance: totalCashIn - totalCashOut,
    totalRevenue,
    totalExpenses,
    totalDiscounts,
    totalBadDebt,
    totalExpenseDiscounts,
    totalExpenseWriteoffs,
    loansReceivable,
    loansPayable,
    loanCashIn,
    loanCashOut,
    monthlyDataMap,
    expensesByCategoryMap,
    recentTransactions,
    unpaidReceivables,
    unpaidPayables,
    isLoading,
  };
}
