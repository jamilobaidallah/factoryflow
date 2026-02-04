"use client";

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  limit,
  orderBy,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import { toDate } from '@/lib/firestore-utils';
import { safeAdd } from '@/lib/currency';
import { queryKeys } from './keys';
import { useReactiveQueryData } from './useReactiveQueryData';
import { QUERY_LIMITS } from '@/lib/constants';
import type {
  DashboardLedgerEntry,
  MonthlyFinancialData,
} from '@/components/dashboard/types/dashboard.types';
import {
  DASHBOARD_CONFIG,
  EXCLUDED_CATEGORIES,
  INCOME_TYPES,
  EXPENSE_TYPE,
  EQUITY_TYPE,
  EQUITY_SUBCATEGORIES,
  LOAN_TYPE,
  LOAN_CATEGORIES,
  LOAN_SUBCATEGORIES,
  PAYMENT_TYPES,
} from '@/components/dashboard/constants/dashboard.constants';

/** Aggregated ledger data for dashboard */
export interface LedgerDashboardData {
  totalRevenue: number;
  totalExpenses: number;
  totalDiscounts: number;
  totalBadDebt: number;
  totalExpenseDiscounts: number;   // Expense discounts (contra-expense)
  totalExpenseWriteoffs: number;   // Expense writeoffs (contra-expense)
  financingCashIn: number;
  financingCashOut: number;
  loansReceivable: number;
  loansPayable: number;
  loanCashIn: number;
  loanCashOut: number;
  monthlyDataMap: Map<string, MonthlyFinancialData>;
  expensesByCategoryMap: Map<string, { total: number; monthly: Map<string, number> }>;
  recentTransactions: DashboardLedgerEntry[];
}

/** Aggregated payments data for dashboard */
export interface PaymentsDashboardData {
  operatingCashIn: number;
  operatingCashOut: number;
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
  existing.revenue = safeAdd(existing.revenue, revenue);
  existing.expenses = safeAdd(existing.expenses, expenses);
  existing.discounts = safeAdd(existing.discounts || 0, discounts);
  existing.badDebt = safeAdd(existing.badDebt || 0, badDebt);
  map.set(monthKey, existing);
}

/** Update category data aggregation */
function updateCategoryData(
  map: Map<string, { total: number; monthly: Map<string, number> }>,
  category: string,
  monthKey: string,
  amount: number
): void {
  if (!category) {
    return;
  }

  const catData = map.get(category) || { total: 0, monthly: new Map() };
  catData.total = safeAdd(catData.total, amount);
  const monthlyAmount = catData.monthly.get(monthKey) || 0;
  catData.monthly.set(monthKey, safeAdd(monthlyAmount, amount));
  map.set(category, catData);
}

/** Transform ledger snapshot to dashboard data */
function transformLedgerData(docs: DocumentData[]): LedgerDashboardData {
  let revenue = 0;
  let expenses = 0;
  let discounts = 0;
  let badDebt = 0;
  let expenseDiscounts = 0;   // Expense discounts (contra-expense)
  let expenseWriteoffs = 0;   // Expense writeoffs (contra-expense)
  let finCashIn = 0;
  let finCashOut = 0;
  let loanReceivableTotal = 0;
  let loanPayableTotal = 0;
  let loanIn = 0;
  let loanOut = 0;
  const transactions: DashboardLedgerEntry[] = [];
  const monthlyMap = new Map<string, MonthlyFinancialData>();
  const categoryMap = new Map<string, { total: number; monthly: Map<string, number> }>();

  docs.forEach((data) => {
    const entry: DashboardLedgerEntry = {
      id: data.id,
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

    const isEquity = entry.type === EQUITY_TYPE;
    const isLoan = entry.type === LOAN_TYPE;
    const isExcludedCategory = EXCLUDED_CATEGORIES.some((cat) => entry.category === cat);
    const isExcluded = isEquity || isLoan || isExcludedCategory;

    if (isExcluded) {
      if (entry.subCategory === EQUITY_SUBCATEGORIES.CAPITAL_IN) {
        finCashIn = safeAdd(finCashIn, entry.amount);
      } else if (entry.subCategory === EQUITY_SUBCATEGORIES.DRAWINGS_OUT) {
        finCashOut = safeAdd(finCashOut, entry.amount);
      }

      if (entry.category === LOAN_CATEGORIES.RECEIVED) {
        if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_RECEIPT) {
          loanIn = safeAdd(loanIn, entry.amount);
          loanPayableTotal = safeAdd(loanPayableTotal, entry.remainingBalance ?? entry.amount ?? 0);
        } else if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_REPAYMENT) {
          loanOut = safeAdd(loanOut, entry.amount);
        }
      } else if (entry.category === LOAN_CATEGORIES.GIVEN) {
        if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_GIVEN) {
          loanOut = safeAdd(loanOut, entry.amount);
          loanReceivableTotal = safeAdd(loanReceivableTotal, entry.remainingBalance ?? entry.amount ?? 0);
        } else if (entry.subCategory === LOAN_SUBCATEGORIES.LOAN_COLLECTION) {
          loanIn = safeAdd(loanIn, entry.amount);
        }
      }
    } else {
      const monthKey = formatMonthKey(entry.date);
      const isIncome = INCOME_TYPES.some((type) => entry.type === type);

      if (isIncome) {
        revenue = safeAdd(revenue, entry.amount);
        if (entry.totalDiscount) {
          discounts = safeAdd(discounts, entry.totalDiscount);
        }
        if (data.writeoffAmount) {
          badDebt = safeAdd(badDebt, data.writeoffAmount);
        }
        updateMonthlyData(monthlyMap, monthKey, entry.amount, 0, entry.totalDiscount || 0, data.writeoffAmount || 0);
      } else if (entry.type === EXPENSE_TYPE) {
        expenses = safeAdd(expenses, entry.amount);
        // Track discounts/writeoffs on expense entries (contra-expense)
        if (entry.totalDiscount) {
          expenseDiscounts = safeAdd(expenseDiscounts, entry.totalDiscount);
        }
        if (data.writeoffAmount) {
          expenseWriteoffs = safeAdd(expenseWriteoffs, data.writeoffAmount);
        }
        updateMonthlyData(monthlyMap, monthKey, 0, entry.amount, 0, 0);
        updateCategoryData(categoryMap, entry.category, monthKey, entry.amount);
      }
    }

    transactions.push(entry);
  });

  // Sort by date and get recent transactions
  transactions.sort((a, b) => b.date.getTime() - a.date.getTime());

  return {
    totalRevenue: revenue,
    totalExpenses: expenses,
    totalDiscounts: discounts,
    totalBadDebt: badDebt,
    totalExpenseDiscounts: expenseDiscounts,
    totalExpenseWriteoffs: expenseWriteoffs,
    financingCashIn: finCashIn,
    financingCashOut: finCashOut,
    loansReceivable: loanReceivableTotal,
    loansPayable: loanPayableTotal,
    loanCashIn: loanIn,
    loanCashOut: loanOut,
    monthlyDataMap: monthlyMap,
    expensesByCategoryMap: categoryMap,
    recentTransactions: transactions.slice(0, DASHBOARD_CONFIG.TRANSACTIONS_LIMIT),
  };
}

/** Transform payments snapshot to dashboard data */
function transformPaymentsData(docs: DocumentData[]): PaymentsDashboardData {
  let opCashIn = 0;
  let opCashOut = 0;

  docs.forEach((data) => {
    if (data.isEndorsement || data.noCashMovement) {
      return;
    }

    const amount = data.amount || 0;
    const paymentType = data.type || "";

    if (paymentType === PAYMENT_TYPES.INCOMING) {
      opCashIn = safeAdd(opCashIn, amount);
    } else if (paymentType === PAYMENT_TYPES.OUTGOING) {
      opCashOut = safeAdd(opCashOut, amount);
    }
  });

  return {
    operatingCashIn: opCashIn,
    operatingCashOut: opCashOut,
  };
}

/**
 * Hook for ledger dashboard data with real-time subscription
 * Aggregates P&L, financing cash, and recent transactions
 */
export function useLedgerDashboardData() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  const queryKey = queryKeys.dashboard.stats(ownerId || '');

  // Memoize transform to avoid recreating on each render
  const transform = useCallback((docs: DocumentData[]) => transformLedgerData(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const ledgerRef = collection(firestore, `users/${ownerId}/ledger`);
    const ledgerQuery = query(ledgerRef, orderBy("date", "desc"), limit(QUERY_LIMITS.DASHBOARD_ENTRIES));

    unsubscribeRef.current = onSnapshot(
      ledgerQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Ledger dashboard subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  const defaultData: LedgerDashboardData = {
    totalRevenue: 0,
    totalExpenses: 0,
    totalDiscounts: 0,
    totalBadDebt: 0,
    totalExpenseDiscounts: 0,
    totalExpenseWriteoffs: 0,
    financingCashIn: 0,
    financingCashOut: 0,
    loansReceivable: 0,
    loansPayable: 0,
    loanCashIn: 0,
    loanCashOut: 0,
    monthlyDataMap: new Map(),
    expensesByCategoryMap: new Map(),
    recentTransactions: [],
  };

  const { data, isLoading } = useReactiveQueryData<LedgerDashboardData>({
    queryKey,
    defaultValue: defaultData,
    enabled: !!ownerId,
  });

  return { data, isLoading };
}

/**
 * Hook for payments dashboard data with real-time subscription
 * Aggregates operating cash in/out
 */
export function usePaymentsDashboardData() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  const queryKey = useMemo(
    () => [...queryKeys.payments.all(ownerId || ''), 'dashboard'] as const,
    [ownerId]
  );

  // Memoize transform to avoid recreating on each render
  const transform = useCallback((docs: DocumentData[]) => transformPaymentsData(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const paymentsRef = collection(firestore, `users/${ownerId}/payments`);
    const paymentsQuery = query(paymentsRef, orderBy("date", "desc"), limit(QUERY_LIMITS.DASHBOARD_ENTRIES));

    unsubscribeRef.current = onSnapshot(
      paymentsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Payments dashboard subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  const defaultData: PaymentsDashboardData = {
    operatingCashIn: 0,
    operatingCashOut: 0,
  };

  const { data, isLoading } = useReactiveQueryData<PaymentsDashboardData>({
    queryKey,
    defaultValue: defaultData,
    enabled: !!ownerId,
  });

  return { data, isLoading };
}
