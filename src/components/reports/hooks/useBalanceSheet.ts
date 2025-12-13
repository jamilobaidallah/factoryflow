/**
 * useBalanceSheet - Custom hook for Balance Sheet calculations
 *
 * Uses double-entry journal entries to calculate:
 * - Assets (Cash, AR, Inventory, Fixed Assets)
 * - Liabilities (AP, Accrued Expenses)
 * - Equity (Owner's Capital, Retained Earnings)
 *
 * Verifies accounting equation: Assets = Liabilities + Equity
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/firebase/provider';
import { formatNumber } from '@/lib/date-utils';
import {
  getBalanceSheet,
  getTrialBalance,
  seedChartOfAccounts,
} from '@/services/journalService';
import {
  BalanceSheet,
  TrialBalanceSummary,
  AccountBalance,
} from '@/types/accounting';

interface UseBalanceSheetResult {
  balanceSheet: BalanceSheet | null;
  trialBalance: TrialBalanceSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isBalanced: boolean;
}

export function useBalanceSheet(asOfDate?: Date): UseBalanceSheetResult {
  const { user } = useUser();
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Ensure chart of accounts exists
      await seedChartOfAccounts(user.uid);

      // Fetch balance sheet and trial balance in parallel
      const [bsResult, tbResult] = await Promise.all([
        getBalanceSheet(user.uid, asOfDate),
        getTrialBalance(user.uid, asOfDate),
      ]);

      if (bsResult.success && bsResult.data) {
        setBalanceSheet(bsResult.data);
      } else {
        setError(bsResult.error || 'Failed to load balance sheet');
      }

      if (tbResult.success && tbResult.data) {
        setTrialBalance(tbResult.data);
      }
    } catch (err) {
      console.error('Error fetching balance sheet:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user, asOfDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isBalanced = balanceSheet?.isBalanced ?? false;

  return {
    balanceSheet,
    trialBalance,
    loading,
    error,
    refresh: fetchData,
    isBalanced,
  };
}

/**
 * Format currency for display
 */
export function formatBalanceSheetAmount(amount: number): string {
  const formatted = formatNumber(Math.abs(amount), 2);
  return `${formatted} دينار`;
}

/**
 * Get account balance display class based on value
 */
export function getBalanceClass(balance: number): string {
  if (balance > 0) return 'text-green-600';
  if (balance < 0) return 'text-red-600';
  return 'text-gray-500';
}
