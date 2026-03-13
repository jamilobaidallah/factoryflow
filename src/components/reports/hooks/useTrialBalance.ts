/**
 * useTrialBalance - Custom hook for Trial Balance calculations
 *
 * Uses double-entry journal entries to calculate accurate trial balance:
 * - Debits and credits by account
 * - Self-balancing verification (Debits = Credits)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
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

  // Refs for auto-refresh logic
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchDataRef = useRef<(() => Promise<void>) | null>(null);
  const isInitialSnapshotRef = useRef(true);

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

  // Keep ref up-to-date with latest fetchData
  useEffect(() => {
    fetchDataRef.current = fetchData;
  }, [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh: subscribe to journal_entries changes and re-fetch on change
  useEffect(() => {
    if (!user) return;

    isInitialSnapshotRef.current = true;

    const journalRef = collection(firestore, `users/${user.dataOwnerId}/journal_entries`);
    // Listen to the most recently created journal entry; fires when new entries are posted
    const recentQuery = query(journalRef, orderBy('createdAt', 'desc'), limit(1));

    const unsubscribe = onSnapshot(
      recentQuery,
      { includeMetadataChanges: false },
      () => {
        // Skip the initial snapshot (data already fetched by fetchData above)
        if (isInitialSnapshotRef.current) {
          isInitialSnapshotRef.current = false;
          return;
        }

        // Debounce to handle multiple rapid journal entries (e.g., main + COGS)
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
          fetchDataRef.current?.();
        }, 800);
      },
      () => {
        // Silently ignore subscription errors; manual refresh still works
      }
    );

    return () => {
      unsubscribe();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [user]);

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
