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
  EQUITY_SUBCATEGORIES,
} from "../constants/dashboard.constants";

/**
 * Hook for fetching and managing all dashboard data
 * Handles ledger entries, payments, and aggregations
 */
export function useDashboardData(): UseDashboardDataReturn {
  const { user } = useUser();

  // Operating cash state (from ledger - paid income/expenses)
  const [operatingCashIn, setOperatingCashIn] = useState(0);
  const [operatingCashOut, setOperatingCashOut] = useState(0);

  // Financing cash state (from ledger - capital contributions and owner drawings)
  const [financingCashIn, setFinancingCashIn] = useState(0);
  const [financingCashOut, setFinancingCashOut] = useState(0);

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
      // Operating cash - from paid income/expense entries
      let opCashIn = 0;
      let opCashOut = 0;
      // Financing cash - from equity entries
      let finCashIn = 0;
      let finCashOut = 0;
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
          subCategory: data.subCategory || "",
          date: toDate(data.date),
          associatedParty: data.associatedParty,
          description: data.description,
          paymentStatus: data.paymentStatus,
          remainingBalance: data.remainingBalance,
          totalPaid: data.totalPaid,
          isARAPEntry: data.isARAPEntry,
        };

        // Check if entry should be excluded from P&L
        // Exclude by type (equity) OR by category (backward compatibility)
        const isEquity = entry.type === EQUITY_TYPE;
        const isExcludedCategory = EXCLUDED_CATEGORIES.some((cat) => entry.category === cat);
        const isExcluded = isEquity || isExcludedCategory;

        if (isExcluded) {
          // FINANCING ACTIVITIES: Equity transactions affect cash balance
          // Capital contribution (رأس مال مالك) = cash IN
          // Owner drawings (سحوبات المالك) = cash OUT
          if (entry.subCategory === EQUITY_SUBCATEGORIES.CAPITAL_IN) {
            finCashIn += entry.amount;
          } else if (entry.subCategory === EQUITY_SUBCATEGORIES.DRAWINGS_OUT) {
            finCashOut += entry.amount;
          }
        } else {
          const monthKey = formatMonthKey(entry.date);
          const isIncome = INCOME_TYPES.some((type) => entry.type === type);

          // P&L: Count all income/expenses regardless of payment status
          if (isIncome) {
            revenue += entry.amount;
            updateMonthlyData(monthlyMap, monthKey, entry.amount, 0);
          } else if (entry.type === EXPENSE_TYPE) {
            expenses += entry.amount;
            updateMonthlyData(monthlyMap, monthKey, 0, entry.amount);
            updateCategoryData(categoryMap, entry.category, monthKey, entry.amount);
          }

          // OPERATING CASH: Calculate based on payment status
          // - Non-ARAP entries (instant settlement) = full amount
          // - Paid ARAP entries = full amount
          // - Partial ARAP entries = only totalPaid portion
          // - Unpaid ARAP entries = 0 (no cash movement yet)
          let cashAmount = 0;
          if (!entry.isARAPEntry) {
            // Non-AR/AP = instant settlement, full amount
            cashAmount = entry.amount;
          } else if (entry.paymentStatus === "paid") {
            // Fully paid = full amount
            cashAmount = entry.amount;
          } else if (entry.paymentStatus === "partial") {
            // Partial = only the paid portion
            cashAmount = entry.totalPaid || 0;
          }
          // unpaid = 0, already initialized

          if (cashAmount > 0) {
            if (isIncome) {
              opCashIn += cashAmount;
            } else if (entry.type === EXPENSE_TYPE) {
              opCashOut += cashAmount;
            }
          }
        }

        transactions.push(entry);
      });

      setTotalRevenue(revenue);
      setTotalExpenses(expenses);
      setOperatingCashIn(opCashIn);
      setOperatingCashOut(opCashOut);
      setFinancingCashIn(finCashIn);
      setFinancingCashOut(finCashOut);
      setMonthlyDataMap(monthlyMap);
      setExpensesByCategoryMap(categoryMap);

      // Sort by date and get recent transactions
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentTransactions(transactions.slice(0, DASHBOARD_CONFIG.TRANSACTIONS_LIMIT));
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Total cash = Operating (paid income - paid expenses) + Financing (capital - drawings)
  // This matches the Cash Flow Report calculation
  const totalCashIn = operatingCashIn + financingCashIn;
  const totalCashOut = operatingCashOut + financingCashOut;

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
