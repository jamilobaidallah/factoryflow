"use client";

import { useState, useEffect } from "react";
import { collection, onSnapshot, query, limit, orderBy } from "firebase/firestore";
import { useUser } from "@/firebase/provider";
import { firestore } from "@/firebase/config";
import { toDate } from "@/lib/firestore-utils";
import type {
  DashboardLedgerEntry,
  MonthlyFinancialData,
  UseDashboardDataReturn,
} from "../types/dashboard.types";
import {
  DASHBOARD_CONFIG,
  EXCLUDED_CATEGORIES,
  INCOME_TYPES,
  EXPENSE_TYPE,
  EQUITY_TYPE,
  PAYMENT_TYPES,
} from "../constants/dashboard.constants";

/**
 * Hook for fetching and managing all dashboard data
 * Handles ledger entries, payments, and aggregations
 */
export function useDashboardData(): UseDashboardDataReturn {
  const { user } = useUser();

  // Cash balance state
  const [totalCashIn, setTotalCashIn] = useState(0);
  const [totalCashOut, setTotalCashOut] = useState(0);

  // Revenue & Expenses state
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Monthly aggregations
  const [monthlyDataMap, setMonthlyDataMap] = useState<Map<string, MonthlyFinancialData>>(
    new Map()
  );

  // Expense categories
  const [expensesByCategoryMap, setExpensesByCategoryMap] = useState<
    Map<string, { total: number; monthly: Map<string, number> }>
  >(new Map());

  // Recent transactions
  const [recentTransactions, setRecentTransactions] = useState<DashboardLedgerEntry[]>([]);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);

  // Load ledger data
  // NOTE: Ideal solution would be pre-computed counters via Cloud Functions.
  // This uses a safety limit to prevent excessive reads while maintaining functionality.
  useEffect(() => {
    if (!user) return;

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    // Safety limit to prevent excessive Firestore reads - aggregations will be based on most recent 5000 entries
    const ledgerQuery = query(ledgerRef, orderBy("date", "desc"), limit(5000));
    const unsubscribe = onSnapshot(ledgerQuery, (snapshot) => {
      let revenue = 0;
      let expenses = 0;
      const transactions: DashboardLedgerEntry[] = [];
      const monthlyMap = new Map<string, MonthlyFinancialData>();
      const categoryMap = new Map<string, { total: number; monthly: Map<string, number> }>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const entry: DashboardLedgerEntry = {
          id: doc.id,
          type: data.type || "",
          amount: data.amount || 0,
          category: data.category || "",
          date: toDate(data.date),
          associatedParty: data.associatedParty,
          description: data.description,
          paymentStatus: data.paymentStatus,
          remainingBalance: data.remainingBalance,
          isARAPEntry: data.isARAPEntry,
        };

        // Check if entry should be excluded from P&L
        // Exclude by type (equity) OR by category (backward compatibility)
        const isEquity = entry.type === EQUITY_TYPE;
        const isExcludedCategory = EXCLUDED_CATEGORIES.some((cat) => entry.category === cat);
        const isExcluded = isEquity || isExcludedCategory;

        if (!isExcluded) {
          const monthKey = formatMonthKey(entry.date);
          const isIncome = INCOME_TYPES.some((type) => entry.type === type);

          if (isIncome) {
            revenue += entry.amount;
            updateMonthlyData(monthlyMap, monthKey, entry.amount, 0);
          } else if (entry.type === EXPENSE_TYPE) {
            expenses += entry.amount;
            updateMonthlyData(monthlyMap, monthKey, 0, entry.amount);
            updateCategoryData(categoryMap, entry.category, monthKey, entry.amount);
          }
        }

        transactions.push(entry);
      });

      setTotalRevenue(revenue);
      setTotalExpenses(expenses);
      setMonthlyDataMap(monthlyMap);
      setExpensesByCategoryMap(categoryMap);

      // Sort by date and get recent transactions
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentTransactions(transactions.slice(0, DASHBOARD_CONFIG.TRANSACTIONS_LIMIT));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Load payments for cash balance
  useEffect(() => {
    if (!user) return;

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    // Safety limit to prevent excessive Firestore reads
    const paymentsQuery = query(paymentsRef, limit(5000));
    const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      let cashIn = 0;
      let cashOut = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Skip endorsed cheques and no-cash-movement payments
        if (data.isEndorsement || data.noCashMovement) return;

        if (data.type === PAYMENT_TYPES.INCOMING) {
          cashIn += data.amount || 0;
        } else if (data.type === PAYMENT_TYPES.OUTGOING) {
          cashOut += data.amount || 0;
        }
      });

      setTotalCashIn(cashIn);
      setTotalCashOut(cashOut);
    });

    return () => unsubscribe();
  }, [user]);

  return {
    totalCashIn,
    totalCashOut,
    cashBalance: totalCashIn - totalCashOut,
    totalRevenue,
    totalExpenses,
    monthlyDataMap,
    expensesByCategoryMap,
    recentTransactions,
    isLoading,
  };
}

/** Format date to month key (YYYY-MM) */
function formatMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Update monthly data aggregation */
function updateMonthlyData(
  map: Map<string, MonthlyFinancialData>,
  monthKey: string,
  revenue: number,
  expenses: number
): void {
  const existing = map.get(monthKey) || { revenue: 0, expenses: 0 };
  existing.revenue += revenue;
  existing.expenses += expenses;
  map.set(monthKey, existing);
}

/** Update category data aggregation */
function updateCategoryData(
  map: Map<string, { total: number; monthly: Map<string, number> }>,
  category: string,
  monthKey: string,
  amount: number
): void {
  if (!category) return;

  const catData = map.get(category) || { total: 0, monthly: new Map() };
  catData.total += amount;
  const monthlyAmount = catData.monthly.get(monthKey) || 0;
  catData.monthly.set(monthKey, monthlyAmount + amount);
  map.set(category, catData);
}
