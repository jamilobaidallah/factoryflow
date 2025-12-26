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
import { CHEQUE_STATUS_AR, CHEQUE_TYPES, TRANSACTION_TYPES, PAYMENT_TYPES } from '@/lib/constants';

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
  associatedParty?: string;
  totalDiscount?: number;
  writeoffAmount?: number;
}

export interface Payment {
  id: string;
  type: string;
  amount: number;
  clientName?: string;
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
    associatedParty: data.associatedParty,
    totalDiscount: data.totalDiscount || 0,
    writeoffAmount: data.writeoffAmount || 0,
  }));
}

/** Transform raw Firestore docs to Payment objects */
function transformPayments(docs: DocumentData[]): Payment[] {
  return docs.map((data) => ({
    id: data.id,
    type: data.type,
    amount: data.amount || 0,
    clientName: data.clientName,
  }));
}

/**
 * Calculate client balances using the same formula as client-detail-page:
 * currentBalance = openingBalance + sales - purchases - (paymentsReceived - paymentsMade) - discounts - writeoffs
 *
 * Then for expected balance after cheques:
 * expectedBalance = currentBalance - incomingCheques + outgoingCheques
 */
function calculateClientBalances(
  clients: Client[],
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  cheques: Cheque[]
): Map<string, ClientBalance> {
  const balanceMap = new Map<string, ClientBalance>();

  clients.forEach((client) => {
    // Calculate current balance from ledger entries
    const clientLedger = ledgerEntries.filter((e) => e.associatedParty === client.name);
    let sales = 0;
    let purchases = 0;
    let discounts = 0;
    let writeoffs = 0;

    clientLedger.forEach((entry) => {
      // Exclude advances from balance calculation
      const isAdvance = entry.category === "سلفة عميل" || entry.category === "سلفة مورد";

      if (!isAdvance) {
        const isIncome =
          entry.type === TRANSACTION_TYPES.INCOME ||
          entry.type === TRANSACTION_TYPES.INCOME_ALT ||
          entry.type === TRANSACTION_TYPES.LOAN;
        if (isIncome) {
          sales += entry.amount || 0;
        } else if (entry.type === TRANSACTION_TYPES.EXPENSE) {
          purchases += entry.amount || 0;
        }
      }
      discounts += entry.totalDiscount || 0;
      writeoffs += entry.writeoffAmount || 0;
    });

    // Calculate payments
    const clientPayments = payments.filter((p) => p.clientName === client.name);
    let paymentsReceived = 0;
    let paymentsMade = 0;

    clientPayments.forEach((payment) => {
      if (payment.type === PAYMENT_TYPES.RECEIPT) {
        paymentsReceived += payment.amount || 0;
      } else if (payment.type === PAYMENT_TYPES.DISBURSEMENT) {
        paymentsMade += payment.amount || 0;
      }
    });

    // Current balance formula
    const openingBalance = client.balance || 0;
    const currentBalance =
      openingBalance + sales - purchases - (paymentsReceived - paymentsMade) - discounts - writeoffs;

    // Calculate expected balance after cheques
    const clientCheques = cheques.filter((c) => c.clientName === client.name);

    if (clientCheques.length === 0) {
      balanceMap.set(client.id, { currentBalance, expectedBalance: null });
    } else {
      let incomingTotal = 0;
      let outgoingTotal = 0;

      clientCheques.forEach((cheque) => {
        if (cheque.type === CHEQUE_TYPES.INCOMING) {
          incomingTotal += cheque.amount || 0;
        } else if (cheque.type === CHEQUE_TYPES.OUTGOING) {
          outgoingTotal += cheque.amount || 0;
        }
      });

      const expectedBalance = currentBalance - incomingTotal + outgoingTotal;
      balanceMap.set(client.id, { currentBalance, expectedBalance });
    }
  });

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
  const queryKey = queryKeys.clients.all(ownerId || '');

  const transform = useCallback((docs: DocumentData[]) => transformClients(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const clientsRef = collection(firestore, `users/${ownerId}/clients`);
    const q = query(clientsRef, orderBy('createdAt', 'desc'), limit(500));

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

  const data = queryClient.getQueryData<Client[]>(queryKey);

  return {
    data: data ?? [],
    isLoading: !data && !!ownerId,
  };
}

/**
 * Hook for pending cheques with real-time subscription
 */
export function usePendingChequesSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  const queryKey = queryKeys.cheques.pending(ownerId || '');

  const transform = useCallback((docs: DocumentData[]) => transformCheques(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const chequesRef = collection(firestore, `users/${ownerId}/cheques`);
    const q = query(chequesRef, where('status', '==', CHEQUE_STATUS_AR.PENDING));

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

  const data = queryClient.getQueryData<Cheque[]>(queryKey);

  return {
    data: data ?? [],
    isLoading: !data && !!ownerId,
  };
}

/**
 * Hook for ledger entries with real-time subscription (for balance calculation)
 */
export function useLedgerEntriesSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  const queryKey = queryKeys.ledger.all(ownerId || '');

  const transform = useCallback((docs: DocumentData[]) => transformLedgerEntries(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const ledgerRef = collection(firestore, `users/${ownerId}/ledger`);

    unsubscribeRef.current = onSnapshot(
      ledgerRef,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
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

  const data = queryClient.getQueryData<LedgerEntry[]>(queryKey);

  return {
    data: data ?? [],
    isLoading: !data && !!ownerId,
  };
}

/**
 * Hook for payments with real-time subscription (for balance calculation)
 */
export function usePaymentsSubscription() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const ownerId = user?.dataOwnerId;
  const queryKey = queryKeys.payments.all(ownerId || '');

  const transform = useCallback((docs: DocumentData[]) => transformPayments(docs), []);

  useEffect(() => {
    if (!ownerId) {
      return;
    }

    const paymentsRef = collection(firestore, `users/${ownerId}/payments`);

    unsubscribeRef.current = onSnapshot(
      paymentsRef,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
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

  const data = queryClient.getQueryData<Payment[]>(queryKey);

  return {
    data: data ?? [],
    isLoading: !data && !!ownerId,
  };
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
