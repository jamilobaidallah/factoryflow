/**
 * useClientTransactions Hook
 *
 * Fetches all unpaid or partially paid transactions for a specific client.
 * Used for multi-allocation payment dialog.
 *
 * NOTE: Excludes advance entries (سلفة عميل / سلفة مورد) which have their own
 * allocation flow via AdvanceAllocationDialog. Advances should not appear
 * in the multi-allocation payment list as they represent prepayments, not invoices.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import { UnpaidTransaction } from '../types';
import { safeSubtract, sumAmounts } from '@/lib/currency';
import { calculateEntryDebitCredit, type BalanceLedgerEntry } from '@/lib/client-balance';

// Advance categories to exclude from multi-allocation payments
// These have their own allocation flow and should not be mixed with regular invoices
const ADVANCE_CATEGORIES = ['سلفة عميل', 'سلفة مورد'];

interface UseClientTransactionsResult {
  transactions: UnpaidTransaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalOutstanding: number;
}

/**
 * Hook to fetch unpaid/partial transactions for a client
 *
 * @param clientName - The client name to fetch transactions for
 * @returns Object containing transactions, loading state, error, and refetch function
 */
export function useClientTransactions(clientName: string, paymentType?: string): UseClientTransactionsResult {
  const { user } = useUser();
  const [transactions, setTransactions] = useState<UnpaidTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user || !clientName) {
      setTransactions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);

      // Query for AR/AP entries belonging to this client
      // Note: We don't use orderBy here to avoid needing a composite index
      // Sorting is done in JavaScript after fetching
      const q = query(
        ledgerRef,
        where('associatedParty', '==', clientName),
        where('isARAPEntry', '==', true)
      );

      const snapshot = await getDocs(q);
      const unpaidTransactions: UnpaidTransaction[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const paymentStatus = data.paymentStatus || 'unpaid';

        // Skip advance entries - they have their own allocation mechanism
        // Advances represent prepayments and should not be in the invoice list
        if (ADVANCE_CATEGORIES.includes(data.category)) {
          return;
        }

        // Filter by payment direction using the same debit/credit logic as the balance sheet.
        // قبض (receipt) → show entries where party owes us (debit > 0)
        // صرف (disbursement) → show entries where we owe party (credit > 0)
        if (paymentType) {
          const entry: BalanceLedgerEntry = {
            id: doc.id,
            type: data.type,
            amount: data.amount || 0,
            category: data.category || '',
            subCategory: data.subCategory,
            totalDiscount: data.totalDiscount,
            writeoffAmount: data.writeoffAmount,
            linkedPaymentId: data.linkedPaymentId,
            isReturnEntry: data.isReturnEntry,
          };
          const { debit, credit } = calculateEntryDebitCredit(entry);
          if (paymentType === 'قبض' && debit <= 0) return;
          if (paymentType === 'صرف' && credit <= 0) return;
        }

        // Only include unpaid or partial transactions
        if (paymentStatus === 'paid') {
          return;
        }

        const amount = data.amount || 0;
        const totalPaid = data.totalPaid || 0;
        const remainingBalance = data.remainingBalance ?? safeSubtract(amount, totalPaid);

        // Skip if remaining balance is 0 or negative
        if (remainingBalance <= 0) {
          return;
        }

        unpaidTransactions.push({
          id: doc.id,
          transactionId: data.transactionId || '',
          date: data.date?.toDate?.() || new Date(data.date) || new Date(),
          description: data.description || '',
          category: data.category || '',
          amount,
          totalPaid,
          remainingBalance,
          paymentStatus: paymentStatus as 'unpaid' | 'partial',
        });
      });

      // Sort by date (oldest first) for FIFO distribution
      unpaidTransactions.sort((a, b) => a.date.getTime() - b.date.getTime());

      setTransactions(unpaidTransactions);
    } catch (err) {
      console.error('Error fetching client transactions:', err);
      setError('حدث خطأ أثناء جلب المعاملات');
    } finally {
      setLoading(false);
    }
  }, [user, clientName, paymentType]);

  // Fetch on mount and when clientName changes
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Calculate total outstanding balance
  const totalOutstanding = sumAmounts(transactions.map(t => t.remainingBalance));

  return {
    transactions,
    loading,
    error,
    refetch: fetchTransactions,
    totalOutstanding,
  };
}
