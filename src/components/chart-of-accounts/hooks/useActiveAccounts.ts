import { useState, useEffect } from 'react';
import type { Account } from '@/types/accounting';
import { getAccountsActive } from '@/services/journalService';
import { useUser } from '@/firebase/provider';

interface UseActiveAccountsResult {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetch active accounts once (one-time getDocs — accounts are quasi-static).
 * Exposes a `refresh()` fn for after create/deactivate/delete operations.
 */
export function useActiveAccounts(): UseActiveAccountsResult {
  const { user } = useUser();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!user?.dataOwnerId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAccountsActive(user.dataOwnerId).then((result) => {
      if (cancelled) return;
      if (result.success && result.data) {
        setAccounts(result.data);
      } else {
        setError(result.error ?? 'فشل تحميل الحسابات');
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [user?.dataOwnerId, tick]);

  const refresh = () => setTick((t) => t + 1);

  return { accounts, loading, error, refresh };
}
