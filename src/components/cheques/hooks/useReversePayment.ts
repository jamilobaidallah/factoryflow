"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  doc,
  collection,
  getDocs,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Cheque } from "../types/cheques";
import { assertNonNegative, isDataIntegrityError } from "@/lib/errors";
import { calculatePaymentStatus } from "@/lib/arap-utils";

/**
 * Hook for reversing a cheque payment when status changes back to pending.
 *
 * This is shared between incoming and outgoing cheques pages to avoid
 * code duplication (DRY principle).
 */
export function useReversePayment() {
  const { user } = useUser();
  const { toast } = useToast();

  /**
   * Reverses a payment when a cheque status changes from cleared back to pending.
   *
   * This function:
   * 1. Finds the linked payment and its allocations
   * 2. Restores ledger entry balances for each allocation
   * 3. Deletes allocations and payment document
   * 4. Clears the cheque's payment link
   *
   * @param cheque - The cheque being reverted
   * @returns true if reversal succeeded, false otherwise
   */
  const reversePayment = async (cheque: Cheque): Promise<boolean> => {
    if (!user || !cheque.linkedPaymentId) return false;

    try {
      const batch = writeBatch(firestore);

      // 1. Get the payment and its allocations
      const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, cheque.linkedPaymentId);
      const paymentDoc = await getDoc(paymentRef);

      if (!paymentDoc.exists()) {
        console.warn("Payment not found:", cheque.linkedPaymentId);
        return true; // Payment doesn't exist, just clear the link
      }

      // 2. Get all allocations for this payment
      const allocationsRef = collection(
        firestore,
        `users/${user.dataOwnerId}/payments/${cheque.linkedPaymentId}/allocations`
      );
      const allocationsSnapshot = await getDocs(allocationsRef);

      // 3. Reverse each allocation - restore the ledger entry's remaining balance
      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data();
        const ledgerDocId = allocation.ledgerDocId;
        const allocatedAmount = allocation.allocatedAmount || 0;

        if (ledgerDocId) {
          const ledgerRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDocId);
          const ledgerDoc = await getDoc(ledgerRef);

          if (ledgerDoc.exists()) {
            const ledgerData = ledgerDoc.data();
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const currentRemainingBalance = ledgerData.remainingBalance || 0;
            const originalAmount = ledgerData.amount || 0;

            // Fail fast on negative values - indicates data corruption
            const newTotalPaid = assertNonNegative(currentTotalPaid - allocatedAmount, {
              operation: 'reverseChequePayment',
              entityId: ledgerDocId,
              entityType: 'ledger'
            });
            const newRemainingBalance = currentRemainingBalance + allocatedAmount;
            const newPaymentStatus = calculatePaymentStatus(newTotalPaid, originalAmount);

            batch.update(ledgerRef, {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newPaymentStatus,
            });
          }
        }

        // Delete the allocation
        batch.delete(allocationDoc.ref);
      }

      // 4. Delete the payment document
      batch.delete(paymentRef);

      // 5. Update the cheque to clear payment link
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);
      batch.update(chequeRef, {
        linkedPaymentId: null,
        paidTransactionIds: null,
        clearedDate: null,
      });

      await batch.commit();
      return true;
    } catch (error) {
      console.error("Error reversing payment:", error);

      if (isDataIntegrityError(error)) {
        toast({
          title: "خطأ في سلامة البيانات",
          description: "المبلغ المدفوع سيصبح سالباً. قد يكون هناك تكرار في عملية الإلغاء.",
          variant: "destructive",
        });
      }

      return false;
    }
  };

  return { reversePayment };
}
