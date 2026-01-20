/**
 * Payment Handlers
 * Batch operations for immediate settlements and initial payments
 */

import { doc } from "firebase/firestore";
import { PAYMENT_TYPES } from "@/lib/constants";
import { addPaymentJournalEntryToBatch } from "@/services/journalService";
import type { HandlerContext } from "../types";

// Advance categories - payment direction matches entry type now
const CUSTOMER_ADVANCE_CATEGORY = "سلفة عميل";  // type "دخل" - cash IN (customer pays us)
const SUPPLIER_ADVANCE_CATEGORY = "سلفة مورد";  // type "مصروف" - cash OUT (we pay supplier)

/**
 * Determine the correct payment type based on entry type and category
 * For advances, the payment direction matches the entry type:
 * - سلفة عميل (Customer Advance): type "دخل" = RECEIPT (we receive cash)
 * - سلفة مورد (Supplier Advance): type "مصروف" = DISBURSEMENT (we pay cash)
 */
function getPaymentType(entryType: string, category: string): string {
  // Customer advance: type is "دخل" and we RECEIVE cash
  if (category === CUSTOMER_ADVANCE_CATEGORY) {
    return PAYMENT_TYPES.RECEIPT;
  }
  // Supplier advance: type is "مصروف" and we PAY cash
  if (category === SUPPLIER_ADVANCE_CATEGORY) {
    return PAYMENT_TYPES.DISBURSEMENT;
  }
  // Normal entries: income = receipt, expense = disbursement
  return entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
}

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
  const { batch, transactionId, formData, entryType, refs, userId } = ctx;

  if (amount > 0) {
    const paymentDocRef = doc(refs.payments);
    const isCheque = method === "cheque";
    const paymentType = getPaymentType(entryType, formData.category);
    const paymentDescription = isCheque
      ? `تسوية فورية بشيك - ${formData.description}`
      : `تسوية فورية نقدية - ${formData.description}`;

    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: amount,
      type: paymentType,
      method: method,
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: paymentDescription,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });

    // Create journal entry for the payment (double-entry accounting)
    // Receipt: DR Cash, CR AR | Disbursement: DR AP, CR Cash
    addPaymentJournalEntryToBatch(batch, userId, {
      paymentId: paymentDocRef.id,
      description: paymentDescription,
      amount: amount,
      paymentType: paymentType as 'قبض' | 'صرف',
      date: new Date(formData.date),
      linkedTransactionId: transactionId,
    });
  }
}

/**
 * Handle initial payment batch operation
 * Creates a partial payment record and its journal entry when AR/AP tracking is enabled
 */
export function handleInitialPaymentBatch(
  ctx: HandlerContext,
  paymentAmount: number
): void {
  const { batch, transactionId, formData, entryType, refs, userId } = ctx;

  if (paymentAmount > 0) {
    const paymentDocRef = doc(refs.payments);
    const paymentType = getPaymentType(entryType, formData.category);
    const paymentDescription = `دفعة أولية - ${formData.description}`;

    // Create payment record
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: paymentAmount,
      type: paymentType,
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: paymentDescription,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });

    // Create journal entry for the payment (double-entry accounting)
    // Receipt: DR Cash, CR AR | Disbursement: DR AP, CR Cash
    addPaymentJournalEntryToBatch(batch, userId, {
      paymentId: paymentDocRef.id,
      description: paymentDescription,
      amount: paymentAmount,
      paymentType: paymentType as 'قبض' | 'صرف',
      date: new Date(formData.date),
      linkedTransactionId: transactionId,
    });
  }
}
