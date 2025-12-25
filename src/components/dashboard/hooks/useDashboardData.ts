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
  PAYMENT_TYPES,
  LOAN_TYPE,
  LOAN_CATEGORIES,
  LOAN_SUBCATEGORIES,
} from "../constants/dashboard.constants";

/**
 * Hook for fetching and managing all dashboard data
 * Handles ledger entries, payments, and aggregations
 */
export function useDashboardData(): UseDashboardDataReturn {
  const { user } = useUser();

  // Operating cash state (from PAYMENTS collection - excludes noCashMovement)
  const [operatingCashIn, setOperatingCashIn] = useState(0);
  const [operatingCashOut, setOperatingCashOut] = useState(0);

  // Financing cash state (from ledger - capital contributions and owner drawings)
  const [financingCashIn, setFinancingCashIn] = useState(0);
  const [financingCashOut, setFinancingCashOut] = useState(0);

  // Loan tracking state (from ledger - loans received and given)
  const [loansReceivable, setLoansReceivable] = useState(0);  // Outstanding loans we gave (assets)
  const [loansPayable, setLoansPayable] = useState(0);        // Outstanding loans we owe (liabilities)
  const [loanCashIn, setLoanCashIn] = useState(0);            // Cash received from loans
  const [loanCashOut, setLoanCashOut] = useState(0);          // Cash paid for loans

  // Revenue & Expenses state
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [totalDiscounts, setTotalDiscounts] = useState(0);
  const [totalBadDebt, setTotalBadDebt] = useState(0);  // Bad debt write-offs (ديون معدومة)

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

  // Loading states
  const [isLedgerLoading, setIsLedgerLoading] = useState(true);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);

  // Load ledger data for P&L, financing cash, and recent transactions
  // NOTE: Operating cash is calculated separately from payments collection
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
      let discounts = 0;  // Track discounts (contra-revenue, reduces net income)
      let badDebt = 0;    // Track bad debt write-offs (ديون معدومة, treated as expense)
      // Financing cash - from equity entries (NOT from payments)
      let finCashIn = 0;
      let finCashOut = 0;
      // Loan tracking
      let loanReceivableTotal = 0;  // Outstanding loans we gave (assets)
      let loanPayableTotal = 0;     // Outstanding loans we owe (liabilities)
      let loanIn = 0;               // Cash received from loans
      let loanOut = 0;              // Cash paid for loans
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
          totalDiscount: data.totalDiscount,
          isARAPEntry: data.isARAPEntry,
        };

        // Check if entry should be excluded from P&L
        // Exclude by type (equity, loan) OR by category (backward compatibility)
        const isEquity = entry.type === EQUITY_TYPE;
        const isLoan = entry.type === LOAN_TYPE;
        const isExcludedCategory = EXCLUDED_CATEGORIES.some((cat) => entry.category === cat);
        const isExcluded = isEquity || isLoan || isExcludedCategory;

        if (isExcluded) {
          // FINANCING ACTIVITIES: Equity transactions affect cash balance
          // Capital contribution (رأس مال مالك) = cash IN
          // Owner drawings (سحوبات المالك) = cash OUT
          // NOTE: These don't go through payments collection, calculated from ledger
          if (entry.subCategory === EQUITY_SUBCATEGORIES.CAPITAL_IN) {
            finCashIn += entry.amount;
          } else if (entry.subCategory === EQUITY_SUBCATEGORIES.DRAWINGS_OUT) {
            finCashOut += entry.amount;
          }

          // LOAN TRANSACTIONS: Also in financing activities
          // Loans received: استلام قرض = cash IN, creates liability
          // Loan repayment: سداد قرض = cash OUT, reduces liability
          // Loans given: منح قرض = cash OUT, creates asset
          // Loan collection: تحصيل قرض = cash IN, reduces asset
          if (entry.category === LOAN_CATEGORIES.RECEIVED) {
            if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_RECEIPT) {
              loanIn += entry.amount;
              // Track outstanding balance
              loanPayableTotal += entry.remainingBalance ?? entry.amount ?? 0;
            } else if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_REPAYMENT) {
              loanOut += entry.amount;
            }
          } else if (entry.category === LOAN_CATEGORIES.GIVEN) {
            if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_GIVEN) {
              loanOut += entry.amount;
              // Track outstanding balance
              loanReceivableTotal += entry.remainingBalance ?? entry.amount ?? 0;
            } else if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_COLLECTION) {
              loanIn += entry.amount;
            }
          }
        } else {
          const monthKey = formatMonthKey(entry.date);
          const isIncome = INCOME_TYPES.some((type) => entry.type === type);

          // P&L: Count all income/expenses regardless of payment status
          if (isIncome) {
            revenue += entry.amount;
            // Track discounts (contra-revenue) - discounts reduce net income
            if (entry.totalDiscount) {
              discounts += entry.totalDiscount;
            }
            // Track bad debt write-offs (treated as expense, reduces profit)
            if (data.writeoffAmount) {
              badDebt += data.writeoffAmount;
            }
            updateMonthlyData(monthlyMap, monthKey, entry.amount, 0, entry.totalDiscount || 0, data.writeoffAmount || 0);
          } else if (entry.type === EXPENSE_TYPE) {
            expenses += entry.amount;
            updateMonthlyData(monthlyMap, monthKey, 0, entry.amount, 0, 0);
            updateCategoryData(categoryMap, entry.category, monthKey, entry.amount);
          }
          // NOTE: Operating cash is now calculated from payments collection, not here
        }

        transactions.push(entry);
      });

      setTotalRevenue(revenue);
      setTotalExpenses(expenses);
      setTotalDiscounts(discounts);
      setTotalBadDebt(badDebt);
      setFinancingCashIn(finCashIn);
      setFinancingCashOut(finCashOut);
      setLoansReceivable(loanReceivableTotal);
      setLoansPayable(loanPayableTotal);
      setLoanCashIn(loanIn);
      setLoanCashOut(loanOut);
      setMonthlyDataMap(monthlyMap);
      setExpensesByCategoryMap(categoryMap);

      // Sort by date and get recent transactions
      transactions.sort((a, b) => b.date.getTime() - a.date.getTime());
      setRecentTransactions(transactions.slice(0, DASHBOARD_CONFIG.TRANSACTIONS_LIMIT));
      setIsLedgerLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Load payments data for operating cash calculation
  // IMPORTANT: Skip payments with noCashMovement (e.g., endorsements)
  useEffect(() => {
    if (!user) return;

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    const paymentsQuery = query(paymentsRef, orderBy("date", "desc"), limit(5000));
    const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      let opCashIn = 0;
      let opCashOut = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        // Skip endorsement payments - they don't involve actual cash movement
        if (data.isEndorsement || data.noCashMovement) {
          return;
        }

        const amount = data.amount || 0;
        const paymentType = data.type || "";

        if (paymentType === PAYMENT_TYPES.INCOMING) {
          opCashIn += amount;
        } else if (paymentType === PAYMENT_TYPES.OUTGOING) {
          opCashOut += amount;
        }
      });

      setOperatingCashIn(opCashIn);
      setOperatingCashOut(opCashOut);
      setIsPaymentsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Total cash = Operating (from payments) + Financing (from ledger equity + loans)
  // This matches the Cash Flow Report calculation
  const totalCashIn = operatingCashIn + financingCashIn + loanCashIn;
  const totalCashOut = operatingCashOut + financingCashOut + loanCashOut;

  // Combined loading state - wait for both ledger and payments to load
  const isLoading = isLedgerLoading || isPaymentsLoading;

  return {
    totalCashIn,
    totalCashOut,
    cashBalance: totalCashIn - totalCashOut,
    totalRevenue,
    totalExpenses,
    totalDiscounts,
    totalBadDebt,
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

/** Format date to month key (YYYY-MM) */
function formatMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Update monthly data aggregation */
function updateMonthlyData(
  map: Map<string, MonthlyFinancialData>,
  monthKey: string,
  revenue: number,
  expenses: number,
  discounts: number,
  badDebt: number
): void {
  const existing = map.get(monthKey) || { revenue: 0, expenses: 0, discounts: 0, badDebt: 0 };
  existing.revenue += revenue;
  existing.expenses += expenses;
  existing.discounts = (existing.discounts || 0) + discounts;
  existing.badDebt = (existing.badDebt || 0) + badDebt;
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
