/**
 * useTrialBalance - Custom hook for Trial Balance calculations
 *
 * Uses double-entry journal entries to calculate accurate trial balance:
 * - Debits and credits by account
 * - Self-balancing verification (Debits = Credits)
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/firebase/provider';
import {
  getTrialBalance,
  seedChartOfAccounts,
} from '@/services/journalService';
import { TrialBalanceSummary } from '@/types/accounting';

interface UseTrialBalanceResult {
  trialBalance: TrialBalanceSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isBalanced: boolean;
}

export function useTrialBalance(asOfDate?: Date): UseTrialBalanceResult {
  const { user } = useUser();
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

      // Fetch trial balance
      const result = await getTrialBalance(user.uid, asOfDate);

      if (result.success && result.data) {
        setTrialBalance(result.data);
      } else {
        setError(result.error || 'Failed to load trial balance');
      }
    } catch (err) {
      console.error('Error fetching trial balance:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [user, asOfDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isBalanced = trialBalance?.isBalanced ?? false;

  return {
    trialBalance,
    loading,
    error,
    refresh: fetchData,
    isBalanced,
  };
}
