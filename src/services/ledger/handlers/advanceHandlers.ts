/**
 * Advance Allocation Handlers
 * Handles applying customer/supplier advances to invoices
 *
 * BUG 1 FIX: Uses FieldValue.arrayUnion and FieldValue.increment for atomic updates
 * to prevent race conditions when multiple invoices allocate from the same advance
 *
 * JOURNAL FIX: Now creates journal entries when advances are applied to invoices.
 * Without these journals, Trial Balance would show incorrect AR/AP and Advance balances.
 *
 * SEMANTIC CHANGE: Advances now use standard AR/AP tracking (totalPaid, remainingBalance, paymentStatus)
 * instead of the separate totalUsedFromAdvance field. This aligns with how loans track obligations.
 *
 * The advance entry represents an OBLIGATION:
 * - Customer advance (سلفة عميل): We owe the customer goods/services
 * - Supplier advance (سلفة مورد): Supplier owes us goods/services
 *
 * When an invoice "uses" an advance, it's fulfilling that obligation:
 * - totalPaid increases (obligation fulfilled)
 * - remainingBalance decreases (remaining obligation)
 * - paymentStatus transitions: unpaid → partial → paid
 *
 * Journal entries when applying advances:
 * - Customer advance application: DR Customer Advances, CR AR
 * - Supplier advance application: DR AP, CR Supplier Advances
 */

import { doc, arrayUnion, increment } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { safeAdd } from "@/lib/currency";
import { TRANSACTION_TYPES } from "@/lib/constants";
import type { HandlerContext } from "../types";
import type { AdvanceAllocationResult } from "@/components/ledger/components/AdvanceAllocationDialog";
import type {
  AdvanceAllocation,
  AdvancePaymentRecord,
} from "@/components/ledger/utils/ledger-constants";
import {
  createJournalPostingEngine,
  getTemplateForAdvanceApplication,
} from "@/services/journal";

/**
 * Handle advance allocation batch operation
 * Updates both the advance entry (mark as used) and the new invoice entry (mark as paid by advance)
 *
 * BUG 1 FIX: Uses atomic Firestore operations to prevent race conditions:
 * - arrayUnion() for advanceAllocations - atomically appends to array
 * - increment() for totalPaid - atomically adds to the value (standard AR/AP field)
 *
 * JOURNAL FIX: Creates journal entries for each advance application:
 * - Customer advance: DR Customer Advances, CR AR
 * - Supplier advance: DR AP, CR Supplier Advances
 *
 * Note: remainingBalance is updated as a convenience field but can always be
 * recalculated from (amount - totalPaid) if needed. The authoritative
 * source is totalPaid which is now atomic.
 *
 * @param ctx - Handler context with batch, refs, and form data
 * @param allocations - Array of advance allocations from the dialog
 * @param invoiceDocId - The ID of the newly created invoice document
 * @returns Total amount paid from advances and journal creation promises
 */
export async function handleAdvanceAllocationBatch(
  ctx: HandlerContext,
  allocations: AdvanceAllocationResult[],
  invoiceDocId: string
): Promise<{
  totalPaidFromAdvances: number;
  paidFromAdvances: AdvancePaymentRecord[];
  journalPromises: Promise<void>[];
}> {
  const { batch, transactionId, formData, userId } = ctx;
  const now = new Date();

  let totalPaidFromAdvances = 0;
  const paidFromAdvances: AdvancePaymentRecord[] = [];
  const journalPromises: Promise<void>[] = [];

  // Determine advance type based on transaction type (entryType is in ctx, not formData)
  // Income (دخل) entries use customer advances (سلفة عميل)
  // Expense (مصروف) entries use supplier advances (سلفة مورد)
  const isCustomerAdvance = ctx.entryType === TRANSACTION_TYPES.INCOME;
  const advanceType = isCustomerAdvance ? "سلفة عميل" : "سلفة مورد";

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
    // - increment: atomically adds to totalPaid (standard AR/AP field)
    // - increment(-amount): atomically subtracts from remainingBalance
    //
    // This ensures that concurrent allocations don't overwrite each other.
    // Even if two requests run simultaneously, both amounts will be added correctly.
    //
    // SEMANTIC CHANGE: Using totalPaid instead of totalUsedFromAdvance
    // This aligns advances with standard AR/AP tracking (like loans)
    //
    // paymentStatus is determined by remainingAfterAllocation:
    // - 0: Advance fully consumed → "paid"
    // - > 0: Partial consumption → "partial"
    const newPaymentStatus = allocation.remainingAfterAllocation <= 0 ? "paid" : "partial";

    batch.update(advanceRef, {
      advanceAllocations: arrayUnion(newAllocation),
      totalPaid: increment(allocation.amount),
      remainingBalance: increment(-allocation.amount),
      paymentStatus: newPaymentStatus,
    });

    // JOURNAL FIX: Create journal entry for advance application
    // This fixes the Trial Balance bug where AR/AP and Advance balances were incorrect
    // because no journal was created when advances were consumed.
    //
    // Customer advance application: DR Customer Advances (2150), CR AR (1200)
    // Supplier advance application: DR AP (2000), CR Supplier Advances (1350)
    const journalPromise = createAdvanceApplicationJournal(
      userId,
      allocation,
      invoiceDocId,
      transactionId,
      advanceType,
      formData.description,
      now
    );
    journalPromises.push(journalPromise);
  }

  return { totalPaidFromAdvances, paidFromAdvances, journalPromises };
}

/**
 * Create journal entry for advance application
 *
 * This is called after the batch commit to avoid conflicts.
 * Journal entries are created outside the main batch because:
 * 1. They need sequence numbers (requires separate transaction)
 * 2. Graceful failure - if journal fails, the advance allocation still works
 */
async function createAdvanceApplicationJournal(
  userId: string,
  allocation: AdvanceAllocationResult,
  invoiceDocId: string,
  transactionId: string,
  advanceType: "سلفة عميل" | "سلفة مورد",
  description: string,
  date: Date
): Promise<void> {
  try {
    const engine = createJournalPostingEngine(userId);
    const templateId = getTemplateForAdvanceApplication(advanceType);

    const result = await engine.post({
      templateId,
      amount: allocation.amount,
      date,
      description: `تطبيق ${advanceType} على فاتورة: ${description}`,
      source: {
        type: "advance_application",
        documentId: invoiceDocId,
        transactionId: transactionId,
      },
    });

    if (!result.success) {
      console.error(
        `Failed to create advance application journal: ${result.error}`
      );
    }
  } catch (error) {
    // Graceful failure - log but don't throw
    // The advance allocation itself succeeded
    console.error("Error creating advance application journal:", error);
  }
}
