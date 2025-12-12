/**
 * usePaymentAllocations Hook
 *
 * Core business logic for multi-allocation payments:
 * - FIFO distribution calculation
 * - Save allocations to Firestore
 * - Reverse allocations on payment delete
 */

import { useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  runTransaction,
  getDoc,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import {
  UnpaidTransaction,
  AllocationEntry,
  FIFODistributionResult,
} from '../types';
import { calculatePaymentStatus } from '@/lib/arap-utils';
import { safeSubtract, safeAdd, sumAmounts, zeroFloor } from '@/lib/currency';
import { createJournalEntryForPayment } from '@/services/journalService';

/** Result from savePaymentWithAllocations */
export interface SavePaymentResult {
  paymentId: string;
  /** True if journal entry failed (payment still saved) */
  journalFailed?: boolean;
}

interface UsePaymentAllocationsResult {
  loading: boolean;
  error: string | null;
  distributeFIFO: (amount: number, transactions: UnpaidTransaction[]) => FIFODistributionResult;
  savePaymentWithAllocations: (
    paymentData: {
      clientName: string;
      amount: number;
      date: Date;
      notes: string;
      type: string;
      /** Optional: Link to cheque when cashing a cheque */
      linkedChequeId?: string;
    },
    allocations: AllocationEntry[],
    allocationMethod: 'fifo' | 'manual'
  ) => Promise<SavePaymentResult | null>;
  reversePaymentAllocations: (paymentId: string) => Promise<boolean>;
}

/**
 * Hook for managing payment allocations
 */
export function usePaymentAllocations(): UsePaymentAllocationsResult {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Distribute payment amount across transactions using FIFO (oldest first)
   */
  const distributeFIFO = (
    amount: number,
    transactions: UnpaidTransaction[]
  ): FIFODistributionResult => {
    // Sort by date ascending (oldest first) - should already be sorted, but ensure
    const sorted = [...transactions].sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );

    let remainingPayment = amount;
    const allocations: AllocationEntry[] = [];

    for (const txn of sorted) {
      if (remainingPayment <= 0) {
        // No more money to allocate, add with 0 allocation
        allocations.push({
          transactionId: txn.transactionId,
          ledgerDocId: txn.id,
          transactionDate: txn.date,
          description: txn.description,
          totalAmount: txn.amount,
          remainingBalance: txn.remainingBalance,
          allocatedAmount: 0,
        });
        continue;
      }

      // Calculate how much to allocate to this transaction
      const allocationAmount = Math.min(remainingPayment, txn.remainingBalance);
      remainingPayment = safeSubtract(remainingPayment, allocationAmount);

      allocations.push({
        transactionId: txn.transactionId,
        ledgerDocId: txn.id,
        transactionDate: txn.date,
        description: txn.description,
        totalAmount: txn.amount,
        remainingBalance: txn.remainingBalance,
        allocatedAmount: allocationAmount,
      });
    }

    const totalAllocated = sumAmounts(allocations.map(a => a.allocatedAmount));

    return {
      allocations,
      totalAllocated,
      remainingPayment: zeroFloor(remainingPayment),
    };
  };

  /**
   * Save payment document and all allocations, update ledger entries
   * Uses Firestore transaction for atomicity - all operations succeed or all fail
   */
  const savePaymentWithAllocations = async (
    paymentData: {
      clientName: string;
      amount: number;
      date: Date;
      notes: string;
      type: string;
      /** Optional: Link to cheque when cashing a cheque */
      linkedChequeId?: string;
    },
    allocations: AllocationEntry[],
    allocationMethod: 'fifo' | 'manual'
  ): Promise<SavePaymentResult | null> => {
    if (!user) {
      setError('المستخدم غير مسجل الدخول');
      return null;
    }

    setLoading(true);
    setError(null);

    // Filter to only allocations with amounts > 0
    const activeAllocations = allocations.filter((a) => a.allocatedAmount > 0);

    if (activeAllocations.length === 0) {
      setError('يجب تخصيص مبلغ واحد على الأقل');
      setLoading(false);
      return null;
    }

    try {
      const totalAllocated = sumAmounts(activeAllocations.map(a => a.allocatedAmount));

      // Extract transaction IDs for display in the payments table
      const allocationTransactionIds = activeAllocations.map(
        (a) => a.transactionId
      );

      // Create document reference for the payment (ID generated before transaction)
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentDocRef = doc(paymentsRef);

      // Use a transaction for atomic read-modify-write
      await runTransaction(firestore, async (transaction) => {
        // 1. Read all ledger entries first (required before writes in transaction)
        const ledgerReads: { ref: ReturnType<typeof doc>; data: Record<string, unknown>; allocation: AllocationEntry }[] = [];

        for (const allocation of activeAllocations) {
          const ledgerRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, allocation.ledgerDocId);
          const ledgerDoc = await transaction.get(ledgerRef);

          if (!ledgerDoc.exists()) {
            throw new Error(`Ledger entry ${allocation.ledgerDocId} not found`);
          }

          ledgerReads.push({
            ref: ledgerRef,
            data: ledgerDoc.data() as Record<string, unknown>,
            allocation,
          });
        }

        // 2. Create the payment document
        transaction.set(paymentDocRef, {
          clientName: paymentData.clientName,
          amount: paymentData.amount,
          type: paymentData.type,
          date: paymentData.date,
          notes: paymentData.notes,
          createdAt: new Date(),
          isMultiAllocation: true,
          totalAllocated,
          allocationMethod,
          allocationCount: activeAllocations.length,
          allocationTransactionIds,
          linkedTransactionId: '',
          ...(paymentData.linkedChequeId && { linkedChequeId: paymentData.linkedChequeId }),
        });

        // 3. Create allocation documents and update ledger entries
        for (const { ref: ledgerRef, data: ledgerData, allocation } of ledgerReads) {
          // Create allocation document
          const allocationsRef = collection(
            firestore,
            `users/${user.dataOwnerId}/payments/${paymentDocRef.id}/allocations`
          );
          const allocationDocRef = doc(allocationsRef);

          transaction.set(allocationDocRef, {
            transactionId: allocation.transactionId,
            ledgerDocId: allocation.ledgerDocId,
            allocatedAmount: allocation.allocatedAmount,
            transactionDate: allocation.transactionDate,
            description: allocation.description,
            createdAt: new Date(),
          });

          // Update ledger entry with new payment totals
          const transactionAmount = (ledgerData.amount as number) || 0;
          const currentTotalPaid = (ledgerData.totalPaid as number) || 0;
          const newTotalPaid = safeAdd(currentTotalPaid, allocation.allocatedAmount);
          const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
          const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

          transaction.update(ledgerRef, {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          });
        }
      });

      // Create journal entry for the payment
      const paymentDescription = `دفعة ${paymentData.type === 'قبض' ? 'واردة من' : 'صادرة إلى'} ${paymentData.clientName}`;
      let journalCreated = true;

      try {
        const journalResult = await createJournalEntryForPayment(
          user.dataOwnerId,
          paymentDocRef.id,
          paymentDescription,
          totalAllocated,
          paymentData.type as 'قبض' | 'صرف',
          paymentData.date,
          allocationTransactionIds[0] // Link to first transaction
        );

        if (!journalResult.success) {
          journalCreated = false;
          console.error(
            "Journal entry failed for payment:",
            paymentDocRef.id,
            journalResult.error
          );
        }
      } catch (err) {
        journalCreated = false;
        console.error("Failed to create journal entry for payment:", paymentDocRef.id, err);
      }

      setLoading(false);

      return {
        paymentId: paymentDocRef.id,
        journalFailed: !journalCreated,
      };
    } catch (err) {
      console.error('Error saving payment with allocations:', err);
      setError('حدث خطأ أثناء حفظ الدفعة');
      setLoading(false);
      return null;
    }
  };

  /**
   * Reverse all allocations for a payment (used when deleting)
   * Uses Firestore transaction for atomicity - all operations succeed or all fail
   */
  const reversePaymentAllocations = async (paymentId: string): Promise<boolean> => {
    if (!user) {
      setError('المستخدم غير مسجل الدخول');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // First, fetch allocations outside transaction (can't query in transaction)
      const allocationsRef = collection(
        firestore,
        `users/${user.dataOwnerId}/payments/${paymentId}/allocations`
      );
      const allocationsSnapshot = await getDocs(allocationsRef);
      const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, paymentId);

      // Use transaction for atomic reversal
      await runTransaction(firestore, async (transaction) => {
        // 1. Read all ledger entries that need updating
        const ledgerUpdates: { ref: ReturnType<typeof doc>; data: Record<string, unknown>; allocatedAmount: number }[] = [];

        for (const allocationDoc of allocationsSnapshot.docs) {
          const allocation = allocationDoc.data();
          const ledgerRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, allocation.ledgerDocId);
          const ledgerDoc = await transaction.get(ledgerRef);

          if (ledgerDoc.exists()) {
            ledgerUpdates.push({
              ref: ledgerRef,
              data: ledgerDoc.data() as Record<string, unknown>,
              allocatedAmount: allocation.allocatedAmount || 0,
            });
          }
        }

        // 2. Delete allocation documents
        for (const allocationDoc of allocationsSnapshot.docs) {
          transaction.delete(allocationDoc.ref);
        }

        // 3. Delete payment document
        transaction.delete(paymentRef);

        // 4. Update ledger entries (reverse the payments)
        for (const { ref: ledgerRef, data: ledgerData, allocatedAmount } of ledgerUpdates) {
          const transactionAmount = (ledgerData.amount as number) || 0;
          const currentTotalPaid = (ledgerData.totalPaid as number) || 0;
          const newTotalPaid = zeroFloor(safeSubtract(currentTotalPaid, allocatedAmount));
          const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
          const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

          transaction.update(ledgerRef, {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          });
        }
      });

      setLoading(false);
      return true;
    } catch (err) {
      console.error('Error reversing payment allocations:', err);
      setError('حدث خطأ أثناء حذف الدفعة');
      setLoading(false);
      return false;
    }
  };

  return {
    loading,
    error,
    distributeFIFO,
    savePaymentWithAllocations,
    reversePaymentAllocations,
  };
}
