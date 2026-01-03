"use client";

import {
  useLedgerDashboardData,
  usePaymentsDashboardData,
} from "@/hooks/firebase-query/useDashboardQueries";
import type { UseDashboardDataReturn } from "../types/dashboard.types";

/**
 * Hook for fetching and managing all dashboard data
 * Uses React Query for caching and real-time subscriptions
 */
export function useDashboardData(): UseDashboardDataReturn {
  // Fetch ledger data (P&L, financing cash, loans, transactions)
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
    isLoading,
  };
}
