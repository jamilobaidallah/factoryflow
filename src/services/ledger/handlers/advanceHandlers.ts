/**
 * Advance Allocation Handlers
 * Handles applying customer/supplier advances to invoices
 *
 * BUG 1 FIX: Uses FieldValue.arrayUnion and FieldValue.increment for atomic updates
 * to prevent race conditions when multiple invoices allocate from the same advance
 */

import { doc, arrayUnion, increment } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { safeAdd } from "@/lib/currency";
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
 * BUG 1 FIX: Uses atomic Firestore operations to prevent race conditions:
 * - arrayUnion() for advanceAllocations - atomically appends to array
 * - increment() for totalUsedFromAdvance - atomically adds to the value
 *
 * Note: remainingBalance is updated as a convenience field but can always be
 * recalculated from (amount - totalUsedFromAdvance) if needed. The authoritative
 * source is totalUsedFromAdvance which is now atomic.
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

    // Create new allocation record
    const newAllocation: AdvanceAllocation = {
      invoiceId: invoiceDocId,
      invoiceTransactionId: transactionId,
      amount: allocation.amount,
      date: now,
      description: formData.description,
    };

    // BUG 1 FIX: Use atomic operations to prevent race conditions
    // - arrayUnion: atomically appends to advanceAllocations array
    // - increment: atomically adds to totalUsedFromAdvance
    // - increment(-amount): atomically subtracts from remainingBalance
    //
    // This ensures that concurrent allocations don't overwrite each other.
    // Even if two requests run simultaneously, both amounts will be added correctly.
    batch.update(advanceRef, {
      advanceAllocations: arrayUnion(newAllocation),
      totalUsedFromAdvance: increment(allocation.amount),
      remainingBalance: increment(-allocation.amount),
    });
  }

  return { totalPaidFromAdvances, paidFromAdvances };
}
