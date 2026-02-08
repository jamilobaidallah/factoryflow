import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import { QUERY_LIMITS } from '@/lib/constants';
import type { Client } from './useClientData';

export interface Payment {
  id: string;
  type: string;
  amount: number;
  date: Date;
  description: string;
  paymentMethod: string;
  notes: string;  // Payment method info is stored in notes field
  associatedParty?: string;
  discountAmount?: number;  // Settlement discount applied with this payment
  isEndorsement?: boolean;  // True if payment is from cheque endorsement
  noCashMovement?: boolean; // True if no actual cash moved (endorsements)
  endorsementChequeId?: string; // Links payment to the endorsed cheque
  linkedTransactionId?: string; // Links payment to its ledger entry
  category?: string;  // Category for filtering (e.g., سلفة عميل, سلفة مورد)
}

/**
 * Hook to subscribe to payments for a specific client
 */
export function usePaymentsForClient(client: Client | null) {
  const { user } = useUser();
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    if (!user || !client) {return;}

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    const q = query(
      paymentsRef,
      where("clientName", "==", client.name),
      orderBy("date", "desc"),
      limit(QUERY_LIMITS.PAYMENTS)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentsList: Payment[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          const payment = {
            id: doc.id,
            ...data,
            date: data.date?.toDate?.() || new Date(),
          } as Payment;
          paymentsList.push(payment);
        });

        // Sorted by Firestore orderBy, no client-side sort needed
        setPayments(paymentsList);
      },
      (error) => {
        console.error("Error loading payments:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  return { payments };
}
