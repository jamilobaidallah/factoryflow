"use client";

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import { convertFirestoreDates } from '@/lib/firestore-utils';
import { queryKeys } from './keys';
import { CHEQUE_STATUS_AR, QUERY_LIMITS } from '@/lib/constants';
import { useReactiveQueryData } from './useReactiveQueryData';
import { toast } from '@/hooks/use-toast';
import {
  calculateClientBalance,
  calculateBalanceAfterCheques,
  hasPendingCheques,
  type BalanceLedgerEntry,
  type BalancePayment,
  type BalanceCheque,
} from '@/lib/client-balance';

// Track which limit warnings have been shown this session (to avoid spam)
const shownLimitWarnings = new Set<string>();

/**
 * Show a limit warning toast to the user (once per session per warning type)
 */
function showLimitWarning(limitType: string, limitValue: number, message: string) {
  const warningKey = `${limitType}-${limitValue}`;
  if (shownLimitWarnings.has(warningKey)) {
    return; // Already shown this session
  }
  shownLimitWarnings.add(warningKey);

  console.warn(`${limitType} limit reached (${limitValue}). ${message}`);
  toast({
    title: "تحذير: تجاوز حد البيانات",
    description: message,
    variant: "destructive",
    duration: 10000, // Show for 10 seconds
  });
}

// Types matching clients-page.tsx
export interface Client {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  createdAt: Date;
}

export interface Cheque {
  id: string;
  amount: number;
  status: string;
  type: string;
  clientName?: string;
  isEndorsedCheque?: boolean;
}

export interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  category: string;
  subCategory?: string;
  associatedParty?: string;
  totalDiscount?: number;
  writeoffAmount?: number;
  linkedPaymentId?: string; // For advances created from multi-allocation payments
}

export interface Payment {
  id: string;
  type: string;
  amount: number;
  clientName?: string;
  linkedTransactionId?: string; // Links payment to ledger entry (e.g., advance)
}

export interface ClientBalance {
  currentBalance: number;
  expectedBalance: number | null;
}

/** Transform raw Firestore docs to Client objects */
function transformClients(docs: DocumentData[]): Client[] {
  return docs.map((data) => ({
    id: data.id,
    ...convertFirestoreDates(data),
  } as Client));
}

/** Transform raw Firestore docs to Cheque objects (excluding endorsed) */
function transformCheques(docs: DocumentData[]): Cheque[] {
  return docs
    .filter((data) => !data.isEndorsedCheque)
    .map((data) => ({
      id: data.id,
      amount: data.amount || 0,
      status: data.status,
      type: data.type,
      clientName: data.clientName,
      isEndorsedCheque: data.isEndorsedCheque,
    }));
}

/** Transform raw Firestore docs to LedgerEntry objects */
function transformLedgerEntries(docs: DocumentData[]): LedgerEntry[] {
  return docs.map((data) => ({
    id: data.id,
    type: data.type,
    amount: data.amount || 0,
    category: data.category,
    subCategory: data.subCategory,
    associatedParty: data.associatedParty,
    totalDiscount: data.totalDiscount || 0,
    writeoffAmount: data.writeoffAmount || 0,
    linkedPaymentId: data.linkedPaymentId,
  }));
}

/** Transform raw Firestore docs to Payment objects */
function transformPayments(docs: DocumentData[]): Payment[] {
  return docs.map((data) => ({
    id: data.id,
    type: data.type,
    amount: data.amount || 0,
    clientName: data.clientName,
    linkedTransactionId: data.linkedTransactionId,
  }));
}

/**
 * Build index maps for O(1) lookups by client name
 * This transforms O(n²) filtering into O(n) indexing + O(1) lookups
 */
function buildClientIndexes(
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  cheques: Cheque[]
) {
  // Index ledger entries by associatedParty (client name)
  const ledgerByClient = new Map<string, LedgerEntry[]>();
  for (const entry of ledgerEntries) {
    if (entry.associatedParty) {
      const list = ledgerByClient.get(entry.associatedParty);
      if (list) {
        list.push(entry);
      } else {
        ledgerByClient.set(entry.associatedParty, [entry]);
      }
    }
  }

  // Index payments by clientName
  const paymentsByClient = new Map<string, Payment[]>();
  for (const payment of payments) {
    if (payment.clientName) {
      const list = paymentsByClient.get(payment.clientName);
      if (list) {
        list.push(payment);
      } else {
        paymentsByClient.set(payment.clientName, [payment]);
      }
    }
  }

  // Index cheques by clientName
  const chequesByClient = new Map<string, Cheque[]>();
  for (const cheque of cheques) {
    if (cheque.clientName) {
      const list = chequesByClient.get(cheque.clientName);
      if (list) {
        list.push(cheque);
      } else {
        chequesByClient.set(cheque.clientName, [cheque]);
      }
    }
  }

  return { ledgerByClient, paymentsByClient, chequesByClient };
}

/**
 * Calculate client balances using the shared debit/credit formula from client-balance.ts
 *
 * This uses the EXACT same calculation as the client balance sheet to ensure consistency.
 * The formula is: balance = openingBalance + sum(debit - credit) for all transactions
 *
 * Then for expected balance after cheques:
 * expectedBalance = currentBalance - incomingCheques + outgoingCheques
 *
 * OPTIMIZED: Uses pre-indexed Maps for O(1) lookups instead of O(n) filtering per client.
 * Total complexity: O(n) where n = max(clients, ledgerEntries, payments, cheques)
 */
function calculateClientBalances(
  clients: Client[],
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  cheques: Cheque[]
): Map<string, ClientBalance> {
  const balanceMap = new Map<string, ClientBalance>();

  // Build indexes once: O(n) for each collection
  const { ledgerByClient, paymentsByClient, chequesByClient } = buildClientIndexes(
    ledgerEntries,
    payments,
    cheques
  );

  // Process each client with O(1) lookups
  for (const client of clients) {
    // O(1) lookup instead of O(n) filter
    const clientLedger = ledgerByClient.get(client.name) || [];
    const clientPayments = paymentsByClient.get(client.name) || [];
    const clientCheques = chequesByClient.get(client.name) || [];

    // Convert to balance utility types
    const balanceLedgerEntries: BalanceLedgerEntry[] = clientLedger.map(e => ({
      id: e.id,
      type: e.type,
      amount: e.amount,
      category: e.category,
      subCategory: e.subCategory,
      totalDiscount: e.totalDiscount,
      writeoffAmount: e.writeoffAmount,
      linkedPaymentId: e.linkedPaymentId,
    }));

    const balancePayments: BalancePayment[] = clientPayments.map(p => ({
      id: p.id,
      type: p.type,
      amount: p.amount,
      linkedTransactionId: p.linkedTransactionId,
    }));

    const balanceCheques: BalanceCheque[] = clientCheques.map(c => ({
      id: c.id,
      amount: c.amount,
      type: c.type,
      status: c.status,
      isEndorsedCheque: c.isEndorsedCheque,
    }));

    // Calculate current balance using shared utility (same as balance sheet)
    const openingBalance = client.balance || 0;
    const currentBalance = calculateClientBalance(openingBalance, balanceLedgerEntries, balancePayments);

    // Calculate expected balance after cheques
    if (!hasPendingCheques(balanceCheques)) {
      balanceMap.set(client.id, { currentBalance, expectedBalance: null });
    } else {
      const expectedBalance = calculateBalanceAfterCheques(currentBalance, balanceCheques);
      balanceMap.set(client.id, { currentBalance, expectedBalance });
    }
  }

  return balanceMap;
}

/**
 * Hook for clients list with real-time subscription
 */
export function useClientsSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  // Memoize queryKey to prevent subscription churn on re-renders
  const queryKey = useMemo(
    () => queryKeys.clients.all(ownerId || ''),
    [ownerId]
  );

  const transform = useCallback((docs: DocumentData[]) => transformClients(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const clientsRef = collection(firestore, `users/${ownerId}/clients`);
    const q = query(clientsRef, orderBy('createdAt', 'desc'), limit(QUERY_LIMITS.CLIENTS));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Clients subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  return useReactiveQueryData<Client[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });
}

/**
 * Hook for pending cheques with real-time subscription
 */
export function usePendingChequesSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  // Memoize queryKey to prevent subscription churn on re-renders
  const queryKey = useMemo(
    () => queryKeys.cheques.pending(ownerId || ''),
    [ownerId]
  );

  const transform = useCallback((docs: DocumentData[]) => transformCheques(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const chequesRef = collection(firestore, `users/${ownerId}/cheques`);
    // Limit pending cheques to prevent unbounded queries
    const q = query(chequesRef, where('status', '==', CHEQUE_STATUS_AR.PENDING), limit(QUERY_LIMITS.PENDING_CHEQUES));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Warn if we hit the limit - indicates need for pagination
        if (snapshot.size >= QUERY_LIMITS.PENDING_CHEQUES) {
          showLimitWarning('Pending cheques', QUERY_LIMITS.PENDING_CHEQUES, 'بعض الشيكات المعلقة قد لا تُحتسب في حسابات الأرصدة. يُرجى مراجعة الشيكات القديمة.');
        }
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Pending cheques subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  return useReactiveQueryData<Cheque[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });
}

/**
 * Hook for ledger entries with real-time subscription (for balance calculation)
 */
export function useLedgerEntriesSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  // Memoize queryKey to prevent subscription churn on re-renders
  const queryKey = useMemo(
    () => queryKeys.ledger.all(ownerId || ''),
    [ownerId]
  );

  const transform = useCallback((docs: DocumentData[]) => transformLedgerEntries(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const ledgerRef = collection(firestore, `users/${ownerId}/ledger`);
    // Order by date descending to get most recent entries first, then limit
    // This ensures if we hit the limit, we have the most recent data (not random)
    const q = query(ledgerRef, orderBy('date', 'desc'), limit(QUERY_LIMITS.LEDGER_ENTRIES));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Warn if we hit the limit - indicates need for pagination or archiving
        if (snapshot.size >= QUERY_LIMITS.LEDGER_ENTRIES) {
          showLimitWarning('Ledger entries', QUERY_LIMITS.LEDGER_ENTRIES, 'بعض القيود المحاسبية قد لا تُحتسب. يُنصح بأرشفة القيود القديمة أو التواصل مع الدعم.');
        }
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Ledger entries subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  return useReactiveQueryData<LedgerEntry[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });
}

/**
 * Hook for payments with real-time subscription (for balance calculation)
 */
export function usePaymentsSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  // Memoize queryKey to prevent subscription churn on re-renders
  const queryKey = useMemo(
    () => queryKeys.payments.all(ownerId || ''),
    [ownerId]
  );

  const transform = useCallback((docs: DocumentData[]) => transformPayments(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const paymentsRef = collection(firestore, `users/${ownerId}/payments`);
    // Order by date descending to get most recent payments first, then limit
    // This ensures if we hit the limit, we have the most recent data (not random)
    const q = query(paymentsRef, orderBy('date', 'desc'), limit(QUERY_LIMITS.PAYMENTS));

    unsubscribeRef.current = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Warn if we hit the limit - indicates need for pagination or archiving
        if (snapshot.size >= QUERY_LIMITS.PAYMENTS) {
          showLimitWarning('Payments', QUERY_LIMITS.PAYMENTS, 'بعض المدفوعات قد لا تُحتسب في الأرصدة. يُنصح بأرشفة المدفوعات القديمة.');
        }
        const data = transform(docs);
        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error('Payments subscription error:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [ownerId, queryKey, queryClient, transform]);

  return useReactiveQueryData<Payment[]>({
    queryKey,
    defaultValue: [],
    enabled: !!ownerId,
  });
}

/**
 * Combined hook for clients page data
 * Fetches all 4 data sources and computes balances
 */
export function useClientsPageData() {
  const { data: clients, isLoading: clientsLoading } = useClientsSubscription();
  const { data: cheques, isLoading: chequesLoading } = usePendingChequesSubscription();
  const { data: ledgerEntries, isLoading: ledgerLoading } = useLedgerEntriesSubscription();
  const { data: payments, isLoading: paymentsLoading } = usePaymentsSubscription();

  // Calculate client balances (memoized based on all data sources)
  const clientBalances = useMemo(
    () => calculateClientBalances(clients, ledgerEntries, payments, cheques),
    [clients, ledgerEntries, payments, cheques]
  );

  // Combined loading state - only show loading on initial load
  const isLoading = clientsLoading || chequesLoading || ledgerLoading || paymentsLoading;

  return {
    clients,
    clientBalances,
    isLoading,
  };
}
