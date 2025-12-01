/**
 * useAllClients Hook
 *
 * Fetches all unique client names from:
 * 1. Ledger entries (associatedParty field) - AR/AP tracking
 * 2. Partners collection
 * 3. Clients collection (optional - for ledger page)
 *
 * Returns a deduplicated, sorted list for use in client dropdown components.
 */

import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, where, orderBy, limit } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';

type ClientSource = 'ledger' | 'partner' | 'client' | 'both' | 'multiple';

interface ClientInfo {
  name: string;
  source: ClientSource;
  /** Total balance: positive = they owe us (debt), negative = we owe them (credit) */
  balance?: number;
  hasBalance?: boolean;
}

interface UseAllClientsOptions {
  /** Include clients from the clients collection (default: false) */
  includeClientsCollection?: boolean;
}

interface UseAllClientsResult {
  clients: ClientInfo[];
  clientNames: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAllClients(options: UseAllClientsOptions = {}): UseAllClientsResult {
  const { includeClientsCollection = false } = options;
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

      // Helper to merge sources
      const mergeSource = (existing: ClientSource, newSource: ClientSource): ClientSource => {
        if (existing === newSource) return existing;
        if (existing === 'multiple' || newSource === 'multiple') return 'multiple';
        // If combining different sources, use 'both' for ledger+partner, 'multiple' if client involved
        if ((existing === 'client' || newSource === 'client') && existing !== newSource) {
          return 'multiple';
        }
        return 'both';
      };

      // 1. Fetch from ledger (associatedParty with AR/AP entries)
      const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
      const ledgerQuery = query(
        ledgerRef,
        where('isARAPEntry', '==', true)
      );
      const ledgerSnapshot = await getDocs(ledgerQuery);

      ledgerSnapshot.forEach((doc) => {
        const data = doc.data();
        const partyName = data.associatedParty;
        if (partyName && typeof partyName === 'string' && partyName.trim()) {
          const trimmedName = partyName.trim();
          const existing = clientMap.get(trimmedName);
          const remainingBalance = data.remainingBalance || 0;
          const paymentStatus = data.paymentStatus || 'unpaid';
          const entryType = data.type; // 'دخل' or 'مصروف'

          // Calculate balance: positive = they owe us (receivable), negative = we owe them (payable)
          // For income entries (دخل): remaining balance is what client owes us (positive)
          // For expense entries (مصروف): remaining balance is what we owe supplier (negative)
          let balanceContribution = 0;
          if (paymentStatus !== 'paid' && remainingBalance > 0) {
            balanceContribution = entryType === 'مصروف' ? -remainingBalance : remainingBalance;
          }

          if (existing) {
            existing.balance = (existing.balance || 0) + balanceContribution;
            existing.hasBalance = existing.balance !== 0;
            existing.source = mergeSource(existing.source, 'ledger');
          } else {
            clientMap.set(trimmedName, {
              name: trimmedName,
              source: 'ledger',
              balance: balanceContribution,
              hasBalance: balanceContribution !== 0,
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
              balance: 0,
              hasBalance: false,
            });
          }
        }
      });

      // 3. Optionally fetch from clients collection
      if (includeClientsCollection) {
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
                balance: 0,
                hasBalance: false,
              });
            }
          }
        });
      }

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
  }, [user, includeClientsCollection]);

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
