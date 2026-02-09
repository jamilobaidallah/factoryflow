/**
 * useTrialBalance - Custom hook for Trial Balance calculations
 *
 * Uses double-entry journal entries to calculate accurate trial balance:
 * - Debits and credits by account
 * - Self-balancing verification (Debits = Credits)
 */

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@/firebase/provider';
import { toast } from '@/hooks/use-toast';
import {
  getTrialBalance,
  seedChartOfAccounts,
} from '@/services/journalService';
import { TrialBalanceSummary } from '@/types/accounting';

interface UseTrialBalanceResult {
  trialBalance: TrialBalanceSummary | null;
  loading: boolean;
  error: string | null;
  warning: string | null;
  refresh: () => Promise<void>;
  isBalanced: boolean;
}

export function useTrialBalance(asOfDate?: Date): UseTrialBalanceResult {
  const { user } = useUser();
  const [trialBalance, setTrialBalance] = useState<TrialBalanceSummary | null>(null);
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

      // Fetch trial balance
      const result = await getTrialBalance(user.dataOwnerId, asOfDate);

      if (result.success && result.data) {
        setTrialBalance(result.data);

        // Handle query limit warning
        if (result.warning) {
          setWarning(result.warning);
          toast({
            title: 'تحذير',
            description: result.warning,
            variant: 'default',
          });
        }
      } else {
        setError(result.error || 'فشل تحميل ميزان المراجعة');
        toast({
          title: 'خطأ',
          description: result.error || 'فشل تحميل ميزان المراجعة',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching trial balance:', err);
      const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
      setError(errorMsg);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل ميزان المراجعة. يرجى المحاولة مرة أخرى',
        variant: 'destructive',
      });
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
    warning,
    refresh: fetchData,
    isBalanced,
  };
}
