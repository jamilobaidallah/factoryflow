/**
 * Payment Handlers
 * Batch operations for immediate settlements and initial payments
 */

import { doc } from "firebase/firestore";
import { PAYMENT_TYPES } from "@/lib/constants";
import type { HandlerContext } from "../types";

/**
 * Handle immediate settlement batch operation
 * Creates a cash payment record for full immediate payment
 */
export function handleImmediateSettlementBatch(
  ctx: HandlerContext,
  cashAmount: number
): void {
  const { batch, transactionId, formData, entryType, refs } = ctx;

  if (cashAmount > 0) {
    const paymentDocRef = doc(refs.payments);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: cashAmount,
      type: entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT,
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `تسوية فورية نقدية - ${formData.description}`,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });
  }
}

/**
 * Handle initial payment batch operation
 * Creates a partial payment record when AR/AP tracking is enabled
 */
export function handleInitialPaymentBatch(
  ctx: HandlerContext,
  paymentAmount: number
): void {
  const { batch, transactionId, formData, entryType, refs } = ctx;

  if (paymentAmount > 0) {
    const paymentDocRef = doc(refs.payments);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: paymentAmount,
      type: entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT,
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `دفعة أولية - ${formData.description}`,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });
  }
}
