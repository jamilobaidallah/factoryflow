import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import type { Client } from './useClientData';

export interface Cheque {
  id: string;
  chequeNumber: string;
  amount: number;
  issueDate: Date;
  dueDate?: Date;
  bankName: string;
  status: string;
  type: string;
  associatedParty?: string;
  // Endorsement fields
  endorsedTo?: string;        // Name of party cheque was endorsed to
  endorsedDate?: Date;        // When the cheque was endorsed
  chequeType?: string;        // "عادي" (normal) or "مجير" (endorsed)
  isEndorsedCheque?: boolean; // Flag for endorsed cheques
  endorsedFromId?: string;    // Reference to original incoming cheque
}

/**
 * Hook to subscribe to cheques for a specific client
 */
export function useChequesForClient(client: Client | null) {
  const { user } = useUser();
  const [cheques, setCheques] = useState<Cheque[]>([]);

  useEffect(() => {
    if (!user || !client) {return;}

    const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
    const q = query(
      chequesRef,
      where("clientName", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chequesList: Cheque[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          chequesList.push({
            id: doc.id,
            ...data,
            issueDate: data.issueDate?.toDate?.() || new Date(),
            dueDate: data.dueDate?.toDate?.() || data.issueDate?.toDate?.() || new Date(),
          } as Cheque);
        });
        // Sort by issue date in JavaScript
        chequesList.sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());
        setCheques(chequesList);
      },
      (error) => {
        console.error("Error loading cheques:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  return { cheques };
}
