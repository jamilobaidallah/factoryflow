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
import { toast } from '@/hooks/use-toast';
import { formatNumber } from '@/lib/date-utils';
import {
  getBalanceSheet,
  seedChartOfAccounts,
} from '@/services/journalService';
import { BalanceSheet } from '@/types/accounting';

interface UseBalanceSheetResult {
  balanceSheet: BalanceSheet | null;
  loading: boolean;
  error: string | null;
  warning: string | null;
  refresh: () => Promise<void>;
  isBalanced: boolean;
}

export function useBalanceSheet(asOfDate?: Date): UseBalanceSheetResult {
  const { user } = useUser();
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);

    try {
      // Ensure chart of accounts exists
      await seedChartOfAccounts(user.dataOwnerId);

      // Fetch balance sheet (internally calls getTrialBalance, no need for duplicate call)
      const bsResult = await getBalanceSheet(user.dataOwnerId, asOfDate);

      if (bsResult.success && bsResult.data) {
        setBalanceSheet(bsResult.data);
        // Check for query limit warning
        if (bsResult.warning) {
          setWarning(bsResult.warning);
          toast({
            title: 'تحذير',
            description: bsResult.warning,
          });
        }
      } else {
        const errorMsg = bsResult.error || 'فشل تحميل الميزانية العمومية';
        setError(errorMsg);
        toast({
          title: 'خطأ',
          description: 'فشل تحميل الميزانية العمومية. يرجى المحاولة مرة أخرى',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching balance sheet:', err);
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      setError(errorMsg);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل الميزانية العمومية. يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
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
    loading,
    error,
    warning,
    refresh: fetchData,
    isBalanced,
  };
}

/**
 * Format currency for display
 * Preserves sign for negative values (e.g., negative equity)
 */
export function formatBalanceSheetAmount(amount: number): string {
  const formatted = formatNumber(amount, 2);
  return `${formatted} دينار`;
}

/**
 * Get account balance display class based on value
 */
export function getBalanceClass(balance: number): string {
  if (balance > 0) {return 'text-green-600';}
  if (balance < 0) {return 'text-red-600';}
  return 'text-gray-500';
}
