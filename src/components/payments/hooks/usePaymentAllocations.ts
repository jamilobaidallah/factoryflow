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
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';
import { firestore } from '@/firebase/config';
import { useUser } from '@/firebase/provider';
import {
  UnpaidTransaction,
  AllocationEntry,
  PaymentAllocationInput,
  FIFODistributionResult,
} from '../types';
import { calculatePaymentStatus } from '@/lib/arap-utils';

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
      linkedChequeId?: string;
    },
    allocations: AllocationEntry[],
    allocationMethod: 'fifo' | 'manual'
  ) => Promise<string | null>;
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
      remainingPayment -= allocationAmount;

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

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);

    return {
      allocations,
      totalAllocated,
      remainingPayment: Math.max(0, remainingPayment),
    };
  };

  /**
   * Save payment document and all allocations, update ledger entries
   */
  const savePaymentWithAllocations = async (
    paymentData: {
      clientName: string;
      amount: number;
      date: Date;
      notes: string;
      type: string;
      linkedChequeId?: string;
    },
    allocations: AllocationEntry[],
    allocationMethod: 'fifo' | 'manual'
  ): Promise<string | null> => {
    if (!user) {
      setError('المستخدم غير مسجل الدخول');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const batch = writeBatch(firestore);

      // Filter to only allocations with amounts > 0
      const activeAllocations = allocations.filter((a) => a.allocatedAmount > 0);

      if (activeAllocations.length === 0) {
        setError('يجب تخصيص مبلغ واحد على الأقل');
        setLoading(false);
        return null;
      }

      const totalAllocated = activeAllocations.reduce(
        (sum, a) => sum + a.allocatedAmount,
        0
      );

      // Extract transaction IDs for display in the payments table
      const allocationTransactionIds = activeAllocations.map(
        (a) => a.transactionId
      );

      // Create the payment document
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentDocRef = doc(paymentsRef);

      batch.set(paymentDocRef, {
        clientName: paymentData.clientName,
        amount: paymentData.amount,
        type: paymentData.type,
        date: paymentData.date,
        notes: paymentData.notes,
        createdAt: new Date(),
        // Multi-allocation fields
        isMultiAllocation: true,
        totalAllocated,
        allocationMethod,
        allocationCount: activeAllocations.length,
        allocationTransactionIds, // Array of transaction IDs for display
        // Keep linkedTransactionId empty for multi-allocation payments
        linkedTransactionId: '',
        // Link to cheque if this payment is from cashing a cheque
        ...(paymentData.linkedChequeId && { linkedChequeId: paymentData.linkedChequeId }),
      });

      // Create allocation documents in subcollection
      const allocationsRef = collection(
        firestore,
        `users/${user.uid}/payments/${paymentDocRef.id}/allocations`
      );

      for (const allocation of activeAllocations) {
        const allocationDocRef = doc(allocationsRef);
        batch.set(allocationDocRef, {
          transactionId: allocation.transactionId,
          ledgerDocId: allocation.ledgerDocId,
          allocatedAmount: allocation.allocatedAmount,
          transactionDate: allocation.transactionDate,
          description: allocation.description,
          createdAt: new Date(),
        });

        // Update the corresponding ledger entry
        const ledgerDocRef = doc(
          firestore,
          `users/${user.uid}/ledger`,
          allocation.ledgerDocId
        );

        // We need to get current values and calculate new ones
        // Since we can't read in a batch, we'll update with increment-like logic
        // Actually, we need to read the current state first - let's do individual updates
      }

      // Commit the batch for payment and allocations
      await batch.commit();

      // Now update ledger entries individually (outside batch for reads)
      for (const allocation of activeAllocations) {
        await updateLedgerEntry(
          user.uid,
          allocation.ledgerDocId,
          allocation.allocatedAmount,
          'add'
        );
      }

      setLoading(false);
      return paymentDocRef.id;
    } catch (err) {
      console.error('Error saving payment with allocations:', err);
      setError('حدث خطأ أثناء حفظ الدفعة');
      setLoading(false);
      return null;
    }
  };

  /**
   * Reverse all allocations for a payment (used when deleting)
   */
  const reversePaymentAllocations = async (paymentId: string): Promise<boolean> => {
    if (!user) {
      setError('المستخدم غير مسجل الدخول');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all allocations for this payment
      const allocationsRef = collection(
        firestore,
        `users/${user.uid}/payments/${paymentId}/allocations`
      );
      const allocationsSnapshot = await getDocs(allocationsRef);

      // Reverse each allocation on the ledger
      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data();
        await updateLedgerEntry(
          user.uid,
          allocation.ledgerDocId,
          allocation.allocatedAmount,
          'subtract'
        );

        // Delete the allocation document
        await deleteDoc(allocationDoc.ref);
      }

      // Delete the payment document
      const paymentRef = doc(firestore, `users/${user.uid}/payments`, paymentId);
      await deleteDoc(paymentRef);

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

/**
 * Helper function to update a ledger entry's AR/AP fields
 */
async function updateLedgerEntry(
  userId: string,
  ledgerDocId: string,
  amount: number,
  operation: 'add' | 'subtract'
): Promise<void> {
  const ledgerRef = doc(firestore, `users/${userId}/ledger`, ledgerDocId);

  // We need to read current state first
  const { getDoc } = await import('firebase/firestore');
  const ledgerSnapshot = await getDoc(ledgerRef);

  if (!ledgerSnapshot.exists()) {
    console.warn(`Ledger entry ${ledgerDocId} not found`);
    return;
  }

  const ledgerData = ledgerSnapshot.data();
  const transactionAmount = ledgerData.amount || 0;
  const currentTotalPaid = ledgerData.totalPaid || 0;

  let newTotalPaid: number;
  if (operation === 'add') {
    newTotalPaid = currentTotalPaid + amount;
  } else {
    newTotalPaid = Math.max(0, currentTotalPaid - amount);
  }

  const newRemainingBalance = transactionAmount - newTotalPaid;
  const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

  await updateDoc(ledgerRef, {
    totalPaid: newTotalPaid,
    remainingBalance: newRemainingBalance,
    paymentStatus: newStatus,
  });
}
