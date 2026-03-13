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

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
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

      // Fetch balance sheet (internally uses trial balance data)
      const bsResult = await getBalanceSheet(user.dataOwnerId, asOfDate);

      if (bsResult.success && bsResult.data) {
        setBalanceSheet(bsResult.data);

        // Handle query limit warning
        if (bsResult.warning) {
          setWarning(bsResult.warning);
          toast({
            title: 'تحذير',
            description: bsResult.warning,
            variant: 'default',
          });
        }
      } else {
        setError(bsResult.error || 'فشل تحميل الميزانية العمومية');
        toast({
          title: 'خطأ',
          description: bsResult.error || 'فشل تحميل الميزانية العمومية',
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
