import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import {
  isLoanTransaction,
  isInitialLoan,
  getLoanType,
} from '@/components/ledger/utils/ledger-helpers';
import type { Client } from './useClientData';

export interface LedgerEntry {
  id: string;
  transactionId?: string;
  type: string;
  amount: number;
  date: Date;
  category: string;
  subCategory?: string;
  description: string;
  associatedParty?: string;
  remainingBalance?: number;
  totalDiscount?: number;        // Settlement discounts (خصم تسوية)
  writeoffAmount?: number;       // Bad debt write-offs (ديون معدومة)
  totalPaidFromAdvances?: number; // Amount paid from customer/supplier advances
  linkedPaymentId?: string;       // For advances created from multi-allocation payments
  // Advance allocation fields
  totalUsedFromAdvance?: number;  // Total amount consumed from this advance
  advanceAllocations?: Array<{    // Which invoices used this advance
    invoiceId: string;
    invoiceTransactionId: string;
    amount: number;
    date: Date | string;
    description?: string;
  }>;
}

interface LedgerMetrics {
  totalSales: number;
  totalPurchases: number;
  loansReceivable: number;
  loansPayable: number;
}

/**
 * Check if a ledger entry is an advance (سلفة)
 * Advances are informational only - they explain where overpayment sits
 * but should NOT affect running balance (the payment already captured the money flow)
 */
export function isAdvanceEntry(entry: LedgerEntry): boolean {
  return entry.category === "سلفة عميل" || entry.category === "سلفة مورد";
}

/**
 * Hook to subscribe to ledger entries for a specific client
 * Also calculates financial metrics (sales, purchases, loans)
 */
export function useLedgerForClient(client: Client | null) {
  const { user } = useUser();
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [metrics, setMetrics] = useState<LedgerMetrics>({
    totalSales: 0,
    totalPurchases: 0,
    loansReceivable: 0,
    loansPayable: 0,
  });

  useEffect(() => {
    if (!user || !client) {return;}

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    const q = query(
      ledgerRef,
      where("associatedParty", "==", client.name)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entries: LedgerEntry[] = [];
        let sales = 0;
        let purchases = 0;
        let loanReceivable = 0;
        let loanPayable = 0;

        snapshot.forEach((doc) => {
          const data = doc.data();
          const entry = {
            id: doc.id,
            ...data,
            date: data.date?.toDate?.() || new Date(),
          } as LedgerEntry;
          entries.push(entry);

          // Track loan balances (separate from regular income/expense)
          if (isLoanTransaction(entry.type, entry.category)) {
            if (isInitialLoan(entry.subCategory)) {
              const loanType = getLoanType(entry.category);
              if (loanType === "receivable") {
                loanReceivable += entry.remainingBalance ?? entry.amount ?? 0;
              } else if (loanType === "payable") {
                loanPayable += entry.remainingBalance ?? entry.amount ?? 0;
              }
            }
          } else if (!isAdvanceEntry(entry)) {
            // Calculate regular totals (exclude advances and loans)
            if (entry.type === "دخل" || entry.type === "إيراد") {
              sales += entry.amount;
            } else if (entry.type === "مصروف") {
              purchases += entry.amount;
            }
          }
        });

        // Sort by date in JavaScript instead of Firestore
        entries.sort((a, b) => b.date.getTime() - a.date.getTime());

        setLedgerEntries(entries);
        setMetrics({
          totalSales: sales,
          totalPurchases: purchases,
          loansReceivable: loanReceivable,
          loansPayable: loanPayable,
        });
      },
      (error) => {
        console.error("Error loading ledger entries:", error);
      }
    );

    return () => unsubscribe();
  }, [user, client]);

  return {
    ledgerEntries,
    ...metrics,
  };
}
