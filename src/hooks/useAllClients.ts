/**
 * useAllClients Hook
 *
 * Fetches all unique client names from:
 * 1. Ledger entries (associatedParty field) - AR/AP tracking
 * 2. Partners collection
 * 3. Clients collection
 *
 * Returns a deduplicated, sorted list for use in client dropdown components.
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, where, limit, orderBy } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';

type ClientSource = 'ledger' | 'partner' | 'client' | 'multiple';

interface ClientInfo {
  name: string;
  source: ClientSource;
  hasOutstandingDebt?: boolean;
  totalOutstanding?: number;
}

interface UseAllClientsResult {
  clients: ClientInfo[];
  clientNames: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAllClients(): UseAllClientsResult {
  const { user } = useUser();
  const [clients, setClients] = useState<ClientInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const clientMap = new Map<string, ClientInfo>();

      // 1. Fetch from ledger (associatedParty with AR/AP entries)
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const ledgerQuery = query(
        ledgerRef,
        where('isARAPEntry', '==', true)
      );
      const ledgerSnapshot = await getDocs(ledgerQuery);

      // Helper to merge sources
      const mergeSource = (existing: ClientSource, newSource: ClientSource): ClientSource => {
        if (existing === newSource) return existing;
        return 'multiple';
      };

      ledgerSnapshot.forEach((doc) => {
        const data = doc.data();
        const partyName = data.associatedParty;
        if (partyName && typeof partyName === 'string' && partyName.trim()) {
          const trimmedName = partyName.trim();
          const existing = clientMap.get(trimmedName);
          const remainingBalance = data.remainingBalance || 0;
          const paymentStatus = data.paymentStatus || 'unpaid';
          const hasDebt = paymentStatus !== 'paid' && remainingBalance > 0;

          if (existing) {
            // Update existing entry
            if (hasDebt) {
              existing.hasOutstandingDebt = true;
              existing.totalOutstanding = (existing.totalOutstanding || 0) + remainingBalance;
            }
            existing.source = mergeSource(existing.source, 'ledger');
          } else {
            clientMap.set(trimmedName, {
              name: trimmedName,
              source: 'ledger',
              hasOutstandingDebt: hasDebt,
              totalOutstanding: hasDebt ? remainingBalance : 0,
            });
          }
        }
      });

      // 2. Fetch from partners collection
      const partnersRef = collection(firestore, `users/${user.uid}/partners`);
      const partnersSnapshot = await getDocs(partnersRef);

      partnersSnapshot.forEach((doc) => {
        const data = doc.data();
        const partnerName = data.name;
        if (partnerName && typeof partnerName === 'string' && partnerName.trim()) {
          const trimmedName = partnerName.trim();
          const existing = clientMap.get(trimmedName);

          if (existing) {
            existing.source = mergeSource(existing.source, 'partner');
          } else {
            clientMap.set(trimmedName, {
              name: trimmedName,
              source: 'partner',
              hasOutstandingDebt: false,
              totalOutstanding: 0,
            });
          }
        }
      });

      // 3. Fetch from clients collection
      const clientsRef = collection(firestore, `users/${user.uid}/clients`);
      const clientsQuery = query(clientsRef, orderBy('name'), limit(500));
      const clientsSnapshot = await getDocs(clientsQuery);

      clientsSnapshot.forEach((doc) => {
        const data = doc.data();
        const clientName = data.name;
        if (clientName && typeof clientName === 'string' && clientName.trim()) {
          const trimmedName = clientName.trim();
          const existing = clientMap.get(trimmedName);

          if (existing) {
            existing.source = mergeSource(existing.source, 'client');
          } else {
            clientMap.set(trimmedName, {
              name: trimmedName,
              source: 'client',
              hasOutstandingDebt: false,
              totalOutstanding: 0,
            });
          }
        }
      });

      // Convert to array and sort alphabetically
      const clientsArray = Array.from(clientMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name, 'ar')
      );

      setClients(clientsArray);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('حدث خطأ أثناء جلب قائمة العملاء');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Simple array of names for easy filtering
  const clientNames = clients.map((c) => c.name);

  return {
    clients,
    clientNames,
    loading,
    error,
    refetch: fetchClients,
  };
}
