/**
 * Advance Allocation Handlers
 * Handles applying customer/supplier advances to invoices
 */

import { doc, getDoc, updateDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { safeAdd, safeSubtract } from "@/lib/currency";
import type { HandlerContext } from "../types";
import type { AdvanceAllocationResult } from "@/components/ledger/components/AdvanceAllocationDialog";
import type {
  AdvanceAllocation,
  AdvancePaymentRecord,
} from "@/components/ledger/utils/ledger-constants";

/**
 * Handle advance allocation batch operation
 * Updates both the advance entry (mark as used) and the new invoice entry (mark as paid by advance)
 *
 * @param ctx - Handler context with batch, refs, and form data
 * @param allocations - Array of advance allocations from the dialog
 * @param invoiceDocId - The ID of the newly created invoice document
 * @returns Total amount paid from advances
 */
export async function handleAdvanceAllocationBatch(
  ctx: HandlerContext,
  allocations: AdvanceAllocationResult[],
  invoiceDocId: string
): Promise<{
  totalPaidFromAdvances: number;
  paidFromAdvances: AdvancePaymentRecord[];
}> {
  const { batch, transactionId, formData, userId } = ctx;
  const now = new Date();

  let totalPaidFromAdvances = 0;
  const paidFromAdvances: AdvancePaymentRecord[] = [];

  for (const allocation of allocations) {
    if (allocation.amount <= 0) continue;

    totalPaidFromAdvances = safeAdd(totalPaidFromAdvances, allocation.amount);

    // Record that this invoice was paid by this advance
    paidFromAdvances.push({
      advanceId: allocation.advanceId,
      advanceTransactionId: allocation.advanceTransactionId,
      amount: allocation.amount,
      date: now,
    });

    // Update the advance entry to record this allocation
    const advanceRef = doc(
      firestore,
      `users/${userId}/ledger`,
      allocation.advanceId
    );

    // Fetch current advance data to update allocations array
    const advanceSnap = await getDoc(advanceRef);
    if (!advanceSnap.exists()) {
      console.warn(`Advance entry ${allocation.advanceId} not found`);
      continue;
    }

    const advanceData = advanceSnap.data();
    const existingAllocations: AdvanceAllocation[] = advanceData.advanceAllocations || [];
    const existingTotalUsed = advanceData.totalUsedFromAdvance || 0;

    // Create new allocation record
    const newAllocation: AdvanceAllocation = {
      invoiceId: invoiceDocId,
      invoiceTransactionId: transactionId,
      amount: allocation.amount,
      date: now,
      description: formData.description,
    };

    // Calculate new totals
    const newTotalUsed = safeAdd(existingTotalUsed, allocation.amount);
    const newRemainingBalance = safeSubtract(
      advanceData.amount,
      newTotalUsed
    );

    // Update advance entry in batch
    batch.update(advanceRef, {
      advanceAllocations: [...existingAllocations, newAllocation],
      totalUsedFromAdvance: newTotalUsed,
      remainingBalance: newRemainingBalance,
    });
  }

  return { totalPaidFromAdvances, paidFromAdvances };
}
