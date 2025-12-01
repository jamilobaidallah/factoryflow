/**
 * AR/AP (Accounts Receivable/Payable) Utility Functions
 *
 * This module provides reusable functions for managing accounts receivable and payable,
 * including payment tracking, status calculations, and ledger updates.
 */

import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  Firestore
} from 'firebase/firestore';
import {
  PaymentStatus,
  ARAPUpdateResult,
  PAYMENT_STATUSES
} from './definitions';
import {
  safeSubtract,
  safeAdd,
  zeroFloor,
  roundCurrency
} from './currency';

/**
 * Calculate the payment status based on total paid and transaction amount
 *
 * @param totalPaid - The total amount paid so far
 * @param transactionAmount - The total amount of the transaction
 * @returns PaymentStatus - 'paid', 'unpaid', or 'partial'
 */
export function calculatePaymentStatus(
  totalPaid: number,
  transactionAmount: number
): PaymentStatus {
  const remaining = safeSubtract(transactionAmount, totalPaid);

  if (remaining <= 0) {
    return PAYMENT_STATUSES.PAID;
  } else if (totalPaid > 0) {
    return PAYMENT_STATUSES.PARTIAL;
  }
  return PAYMENT_STATUSES.UNPAID;
}

/**
 * Update AR/AP tracking when a payment is added
 *
 * @param firestore - Firestore instance
 * @param userId - User ID
 * @param transactionId - Transaction ID to update (trimmed)
 * @param paymentAmount - Amount being paid
 * @returns ARAPUpdateResult with success status and details
 */
export async function updateARAPOnPaymentAdd(
  firestore: Firestore,
  userId: string,
  transactionId: string,
  paymentAmount: number
): Promise<ARAPUpdateResult> {
  try {
    // Trim the transaction ID to handle whitespace
    const trimmedTransactionId = transactionId.trim();

    // Find the ledger entry
    const ledgerRef = collection(firestore, `users/${userId}/ledger`);
    const ledgerQuery = query(
      ledgerRef,
      where("transactionId", "==", trimmedTransactionId)
    );
    const ledgerSnapshot = await getDocs(ledgerQuery);

    if (ledgerSnapshot.empty) {
      return {
        success: false,
        message: `⚠ لم يتم العثور على حركة مالية برقم: ${transactionId}`,
      };
    }

    const ledgerDoc = ledgerSnapshot.docs[0];
    const ledgerData = ledgerDoc.data();

    // Check if AR/AP tracking is enabled
    if (!ledgerData.isARAPEntry) {
      return {
        success: false,
        message: "⚠ الحركة المالية لا تتبع نظام الذمم. فعّل 'تتبع الذمم' في دفتر الأستاذ",
      };
    }

    // Calculate new values
    const currentTotalPaid = ledgerData.totalPaid || 0;
    const transactionAmount = ledgerData.amount || 0;
    const newTotalPaid = safeAdd(currentTotalPaid, paymentAmount);
    const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
    const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

    // Update the ledger entry
    await updateDoc(doc(firestore, `users/${userId}/ledger`, ledgerDoc.id), {
      totalPaid: newTotalPaid,
      remainingBalance: newRemainingBalance,
      paymentStatus: newStatus,
    });

    return {
      success: true,
      message: `تم تحديث: المدفوع ${roundCurrency(newTotalPaid).toFixed(2)} - المتبقي ${roundCurrency(newRemainingBalance).toFixed(2)}`,
      newTotalPaid,
      newRemainingBalance,
      newStatus,
    };
  } catch (error) {
    console.error("Error updating AR/AP on payment add:", error);
    return {
      success: false,
      message: "حدث خطأ أثناء تحديث الذمم",
    };
  }
}

/**
 * Reverse AR/AP tracking when a payment is deleted
 *
 * @param firestore - Firestore instance
 * @param userId - User ID
 * @param transactionId - Transaction ID to update (trimmed)
 * @param paymentAmount - Amount to subtract
 * @returns ARAPUpdateResult with success status and details
 */
export async function reverseARAPOnPaymentDelete(
  firestore: Firestore,
  userId: string,
  transactionId: string,
  paymentAmount: number
): Promise<ARAPUpdateResult> {
  try {
    // Trim the transaction ID
    const trimmedTransactionId = transactionId.trim();

    // Find the ledger entry
    const ledgerRef = collection(firestore, `users/${userId}/ledger`);
    const ledgerQuery = query(
      ledgerRef,
      where("transactionId", "==", trimmedTransactionId)
    );
    const ledgerSnapshot = await getDocs(ledgerQuery);

    if (ledgerSnapshot.empty) {
      return {
        success: false,
        message: `⚠ لم يتم العثور على حركة مالية برقم: ${transactionId}`,
      };
    }

    const ledgerDoc = ledgerSnapshot.docs[0];
    const ledgerData = ledgerDoc.data();

    // Check if AR/AP tracking is enabled
    if (!ledgerData.isARAPEntry) {
      return {
        success: false,
        message: "⚠ الحركة المالية لا تتبع نظام الذمم",
      };
    }

    // Calculate new values (subtract the payment)
    const currentTotalPaid = ledgerData.totalPaid || 0;
    const transactionAmount = ledgerData.amount || 0;
    const newTotalPaid = zeroFloor(safeSubtract(currentTotalPaid, paymentAmount));
    const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
    const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

    // Update the ledger entry
    await updateDoc(doc(firestore, `users/${userId}/ledger`, ledgerDoc.id), {
      totalPaid: newTotalPaid,
      remainingBalance: newRemainingBalance,
      paymentStatus: newStatus,
    });

    return {
      success: true,
      message: "تم حذف المدفوعة وتحديث الرصيد في دفتر الأستاذ",
      newTotalPaid,
      newRemainingBalance,
      newStatus,
    };
  } catch (error) {
    console.error("Error reversing AR/AP on payment delete:", error);
    return {
      success: false,
      message: "حدث خطأ أثناء تحديث الذمم",
    };
  }
}

/**
 * Validate transaction ID format
 *
 * @param transactionId - Transaction ID to validate
 * @returns boolean - true if valid format
 */
export function isValidTransactionId(transactionId: string): boolean {
  if (!transactionId || transactionId.trim().length === 0) {
    return false;
  }

  // Transaction IDs should follow pattern: TXN-XXXXXXXX-XXXXXX-XXX
  const pattern = /^TXN-\d{8}-\d{6}-\d{3}$/;
  return pattern.test(transactionId.trim());
}

/**
 * Format currency amount for display
 *
 * @param amount - Amount to format
 * @param currency - Currency symbol (default: 'دينار')
 * @returns Formatted string
 */
export function formatCurrency(amount: number, currency: string = 'دينار'): string {
  return `${roundCurrency(amount).toFixed(2)} ${currency}`;
}

/**
 * Validate payment amount
 *
 * @param amount - Amount to validate
 * @returns Object with isValid and error message
 */
export function validatePaymentAmount(amount: number): {
  isValid: boolean;
  error?: string;
} {
  if (isNaN(amount) || amount <= 0) {
    return {
      isValid: false,
      error: "المبلغ يجب أن يكون أكبر من صفر",
    };
  }

  if (amount > 999999999) {
    return {
      isValid: false,
      error: "المبلغ كبير جداً",
    };
  }

  return { isValid: true };
}

/**
 * Check if a payment is a multi-allocation payment
 *
 * @param payment - Payment object to check
 * @returns boolean - true if payment has multi-allocation flag
 */
export function isMultiAllocationPayment(payment: {
  isMultiAllocation?: boolean;
  allocationCount?: number;
}): boolean {
  return payment.isMultiAllocation === true && (payment.allocationCount ?? 0) > 0;
}

/**
 * Update a ledger entry's AR/AP fields directly by document ID
 *
 * @param firestore - Firestore instance
 * @param userId - User ID
 * @param ledgerDocId - Firestore document ID of the ledger entry
 * @param paymentAmount - Amount to add or subtract
 * @param operation - 'add' or 'subtract'
 * @returns ARAPUpdateResult with success status
 */
export async function updateLedgerEntryById(
  firestore: Firestore,
  userId: string,
  ledgerDocId: string,
  paymentAmount: number,
  operation: 'add' | 'subtract'
): Promise<ARAPUpdateResult> {
  try {
    const { getDoc } = await import('firebase/firestore');
    const ledgerRef = doc(firestore, `users/${userId}/ledger`, ledgerDocId);
    const ledgerSnapshot = await getDoc(ledgerRef);

    if (!ledgerSnapshot.exists()) {
      return {
        success: false,
        message: `⚠ لم يتم العثور على القيد المالي`,
      };
    }

    const ledgerData = ledgerSnapshot.data();
    const transactionAmount = ledgerData.amount || 0;
    const currentTotalPaid = ledgerData.totalPaid || 0;

    let newTotalPaid: number;
    if (operation === 'add') {
      newTotalPaid = safeAdd(currentTotalPaid, paymentAmount);
    } else {
      newTotalPaid = zeroFloor(safeSubtract(currentTotalPaid, paymentAmount));
    }

    const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
    const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

    await updateDoc(ledgerRef, {
      totalPaid: newTotalPaid,
      remainingBalance: newRemainingBalance,
      paymentStatus: newStatus,
    });

    return {
      success: true,
      message: `تم تحديث: المدفوع ${roundCurrency(newTotalPaid).toFixed(2)} - المتبقي ${roundCurrency(newRemainingBalance).toFixed(2)}`,
      newTotalPaid,
      newRemainingBalance,
      newStatus,
    };
  } catch (error) {
    console.error('Error updating ledger entry by ID:', error);
    return {
      success: false,
      message: 'حدث خطأ أثناء تحديث الذمم',
    };
  }
}
