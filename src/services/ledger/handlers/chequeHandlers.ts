/**
 * Cheque Handlers
 * Batch operations for incoming and outgoing cheques
 */

import { doc } from "firebase/firestore";
import type { CheckFormData, OutgoingCheckFormData } from "@/components/ledger/types/ledger";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";
import type { HandlerContext } from "../types";

/**
 * Validates essential cheque data before saving
 * @returns true if cheque data is valid, false otherwise
 */
function isValidChequeData(chequeNumber: string | undefined, amount: number): boolean {
  return !!chequeNumber?.trim() && !isNaN(amount) && amount > 0;
}

/**
 * Handle incoming cheque batch operation
 * Supports single cheque or multiple cheques
 *
 * Note: When immediateSettlement is true and cheque is cashed, payment creation
 * is skipped here to avoid double payments. The immediate settlement logic in
 * LedgerService handles creating a single consolidated payment.
 */
export function handleIncomingCheckBatch(
  ctx: HandlerContext,
  checkFormData: CheckFormData
): void {
  const { batch, transactionId, formData, entryType, refs } = ctx;
  const accountingType = checkFormData.accountingType || "cashed";
  const chequeAmount = parseFloat(checkFormData.chequeAmount);

  if (!isValidChequeData(checkFormData.chequeNumber, chequeAmount)) {
    console.warn("Skipping invalid incoming cheque - missing cheque number or invalid amount");
    return;
  }

  let chequeStatus: string;
  if (accountingType === "cashed") {
    chequeStatus = CHEQUE_STATUS_AR.CASHED;
  } else if (accountingType === "postponed") {
    chequeStatus = CHEQUE_STATUS_AR.PENDING;
  } else {
    chequeStatus = CHEQUE_STATUS_AR.ENDORSED;
  }

  const chequeDocRef = doc(refs.cheques);
  const chequeData: Record<string, unknown> = {
    chequeNumber: checkFormData.chequeNumber,
    clientName: formData.associatedParty || "غير محدد",
    amount: chequeAmount,
    type: CHEQUE_TYPES.INCOMING,
    chequeType: accountingType === "endorsed" ? "مجير" : "عادي",
    status: chequeStatus,
    linkedTransactionId: transactionId,
    issueDate: new Date(formData.date),
    dueDate: new Date(checkFormData.dueDate),
    bankName: checkFormData.bankName,
    notes: `مرتبط بالمعاملة: ${formData.description}`,
    createdAt: new Date(),
    accountingType: accountingType,
  };

  if (accountingType === "endorsed" && checkFormData.endorsedToName) {
    chequeData.endorsedTo = checkFormData.endorsedToName;
    chequeData.endorsedDate = new Date();
  }

  batch.set(chequeDocRef, chequeData);

  // Skip payment creation for cashed cheques when immediateSettlement is true
  // to avoid double payment. The settlement logic will handle it.
  if (accountingType === "cashed" && !formData.immediateSettlement) {
    const paymentDocRef = doc(refs.payments);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: entryType === "دخل" ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT,
      method: "cheque",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `شيك صرف رقم ${checkFormData.chequeNumber} - ${formData.description}`,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });
  } else if (accountingType === "endorsed") {
    const receiptDocRef = doc(refs.payments);
    batch.set(receiptDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: PAYMENT_TYPES.RECEIPT,
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `تظهير شيك رقم ${checkFormData.chequeNumber} للجهة: ${checkFormData.endorsedToName}`,
      createdAt: new Date(),
      isEndorsement: true,
      noCashMovement: true,
    });

    const disbursementDocRef = doc(refs.payments);
    batch.set(disbursementDocRef, {
      clientName: checkFormData.endorsedToName,
      amount: chequeAmount,
      type: PAYMENT_TYPES.DISBURSEMENT,
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `استلام شيك مظهر رقم ${checkFormData.chequeNumber} من العميل: ${formData.associatedParty}`,
      createdAt: new Date(),
      isEndorsement: true,
      noCashMovement: true,
    });
  }
}

/**
 * Handle outgoing cheque batch operation
 * Supports single cheque or multiple cheques
 *
 * Note: When immediateSettlement is true and cheque is cashed, payment creation
 * is skipped here to avoid double payments. The immediate settlement logic in
 * LedgerService handles creating a single consolidated payment.
 */
export function handleOutgoingCheckBatch(
  ctx: HandlerContext,
  outgoingCheckFormData: OutgoingCheckFormData
): void {
  const { batch, transactionId, formData, refs } = ctx;
  const accountingType = outgoingCheckFormData.accountingType || "cashed";
  const chequeAmount = parseFloat(outgoingCheckFormData.chequeAmount);

  if (!isValidChequeData(outgoingCheckFormData.chequeNumber, chequeAmount)) {
    console.warn("Skipping invalid outgoing cheque - missing cheque number or invalid amount");
    return;
  }

  let chequeStatus: string;
  if (accountingType === "cashed") {
    chequeStatus = CHEQUE_STATUS_AR.CASHED;
  } else if (accountingType === "postponed") {
    chequeStatus = CHEQUE_STATUS_AR.PENDING;
  } else {
    chequeStatus = CHEQUE_STATUS_AR.CASHED;
  }

  const chequeDocRef = doc(refs.cheques);
  const chequeData: Record<string, unknown> = {
    chequeNumber: outgoingCheckFormData.chequeNumber,
    clientName: formData.associatedParty || "غير محدد",
    amount: chequeAmount,
    type: CHEQUE_TYPES.OUTGOING,
    chequeType: accountingType === "endorsed" ? "مظهر" : "عادي",
    status: chequeStatus,
    linkedTransactionId: transactionId,
    issueDate: new Date(formData.date),
    dueDate: new Date(outgoingCheckFormData.dueDate),
    bankName: outgoingCheckFormData.bankName,
    notes: `مرتبط بالمعاملة: ${formData.description}`,
    createdAt: new Date(),
    accountingType: accountingType,
  };

  if (accountingType === "endorsed" && outgoingCheckFormData.endorsedFromName) {
    chequeData.isEndorsedCheque = true;
    chequeData.endorsedFromName = outgoingCheckFormData.endorsedFromName;
    chequeData.notes = `شيك مظهر من: ${outgoingCheckFormData.endorsedFromName} - مرتبط بالمعاملة: ${formData.description}`;
  }

  batch.set(chequeDocRef, chequeData);

  // Skip payment creation for cashed cheques when immediateSettlement is true
  // to avoid double payment. The settlement logic will handle it.
  if (accountingType === "cashed" && !formData.immediateSettlement) {
    const paymentDocRef = doc(refs.payments);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: PAYMENT_TYPES.DISBURSEMENT,
      method: "cheque",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `شيك صرف رقم ${outgoingCheckFormData.chequeNumber} - ${formData.description}`,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
    });
  } else if (accountingType === "endorsed") {
    const paymentDocRef = doc(refs.payments);
    batch.set(paymentDocRef, {
      clientName: formData.associatedParty || "غير محدد",
      amount: chequeAmount,
      type: PAYMENT_TYPES.DISBURSEMENT,
      method: "cheque",
      linkedTransactionId: transactionId,
      date: new Date(formData.date),
      notes: `شيك مظهر رقم ${outgoingCheckFormData.chequeNumber} من ${outgoingCheckFormData.endorsedFromName} - ${formData.description}`,
      category: formData.category,
      subCategory: formData.subCategory,
      createdAt: new Date(),
      isEndorsement: true,
    });
  }
}
