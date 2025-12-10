/**
 * Payment Handlers
 * Batch operations for immediate settlements and initial payments
 */

import { doc } from "firebase/firestore";
import { PAYMENT_TYPES } from "@/lib/constants";
import type { HandlerContext } from "../types";

/**
 * Handle immediate settlement batch operation
 * Creates a payment record for full immediate payment
 *
 * @param ctx - Handler context with batch, refs, and form data
 * @param amount - The payment amount
 * @param method - Payment method: "cash" or "cheque" (default: "cash")
 */
export function handleImmediateSettlementBatch(
  ctx: HandlerContext,
  amount: number,
  method: "cash" | "cheque" = "cash"
): void {
  const { batch, transactionId, formData, entryType, refs } = ctx;

  if (amount > 0) {
    const paymentDocRef = doc(refs.payments);
    const isCheque = method === "cheque";

    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: amount,
      type: entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT,
      method: method,
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: isCheque
        ? `تسوية فورية بشيك - ${formData.description}`
        : `تسوية فورية نقدية - ${formData.description}`,
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
