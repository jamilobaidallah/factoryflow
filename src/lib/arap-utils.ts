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
  doc,
  Firestore,
  runTransaction,
  DocumentReference,
  Transaction
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

// ============================================================================
// Error Constants
// ============================================================================

const ERRORS = {
  LEDGER_NOT_FOUND: 'LEDGER_NOT_FOUND',
  ARAP_NOT_ENABLED: 'ARAP_NOT_ENABLED',
} as const;

// ============================================================================
// Pure Functions (easily testable, no side effects)
// ============================================================================

/**
 * Calculate the payment status based on total paid and transaction amount
 */
export function calculatePaymentStatus(
  totalPaid: number,
  transactionAmount: number
): PaymentStatus {
  const remaining = safeSubtract(transactionAmount, totalPaid);

  if (remaining <= 0) return PAYMENT_STATUSES.PAID;
  if (totalPaid > 0) return PAYMENT_STATUSES.PARTIAL;
  return PAYMENT_STATUSES.UNPAID;
}

/**
 * Validate transaction ID format (TXN-XXXXXXXX-XXXXXX-XXX)
 */
export function isValidTransactionId(transactionId: string): boolean {
  if (!transactionId || transactionId.trim().length === 0) return false;
  return /^TXN-\d{8}-\d{6}-\d{3}$/.test(transactionId.trim());
}

/**
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = 'دينار'): string {
  return `${roundCurrency(amount).toFixed(2)} ${currency}`;
}

/**
 * Validate payment amount
 */
export function validatePaymentAmount(amount: number): { isValid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { isValid: false, error: "المبلغ يجب أن يكون أكبر من صفر" };
  }
  if (amount > 999999999) {
    return { isValid: false, error: "المبلغ كبير جداً" };
  }
  return { isValid: true };
}

/**
 * Check if a payment is a multi-allocation payment
 */
export function isMultiAllocationPayment(payment: {
  isMultiAllocation?: boolean;
  allocationCount?: number;
}): boolean {
  return payment.isMultiAllocation === true && (payment.allocationCount ?? 0) > 0;
}

// ============================================================================
// Internal Helpers (DRY - shared logic)
// ============================================================================

interface LedgerData {
  isARAPEntry?: boolean;
  totalPaid?: number;
  amount?: number;
}

/**
 * Calculate new ARAP values after a payment change
 */
function calculateNewARAPValues(
  ledgerData: LedgerData,
  paymentAmount: number,
  operation: 'add' | 'subtract'
): { newTotalPaid: number; newRemainingBalance: number; newStatus: PaymentStatus } {
  const currentTotalPaid = ledgerData.totalPaid || 0;
  const transactionAmount = ledgerData.amount || 0;

  const newTotalPaid = operation === 'add'
    ? safeAdd(currentTotalPaid, paymentAmount)
    : zeroFloor(safeSubtract(currentTotalPaid, paymentAmount));

  const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
  const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

  return { newTotalPaid, newRemainingBalance, newStatus };
}

/**
 * Execute atomic ARAP update within a Firestore transaction
 */
async function executeARAPTransaction(
  transaction: Transaction,
  ledgerDocRef: DocumentReference,
  paymentAmount: number,
  operation: 'add' | 'subtract',
  successMessage: string
): Promise<ARAPUpdateResult> {
  const ledgerSnapshot = await transaction.get(ledgerDocRef);

  if (!ledgerSnapshot.exists()) {
    throw new Error(ERRORS.LEDGER_NOT_FOUND);
  }

  const ledgerData = ledgerSnapshot.data() as LedgerData;

  if (!ledgerData.isARAPEntry) {
    throw new Error(ERRORS.ARAP_NOT_ENABLED);
  }

  const { newTotalPaid, newRemainingBalance, newStatus } = calculateNewARAPValues(
    ledgerData,
    paymentAmount,
    operation
  );

  transaction.update(ledgerDocRef, {
    totalPaid: newTotalPaid,
    remainingBalance: newRemainingBalance,
    paymentStatus: newStatus,
  });

  return {
    success: true,
    message: successMessage,
    newTotalPaid,
    newRemainingBalance,
    newStatus,
  };
}

/**
 * Find ledger document by transaction ID
 */
async function findLedgerDocByTransactionId(
  firestore: Firestore,
  userId: string,
  transactionId: string
): Promise<{ found: true; docId: string } | { found: false }> {
  const ledgerRef = collection(firestore, `users/${userId}/ledger`);
  const ledgerQuery = query(ledgerRef, where("transactionId", "==", transactionId.trim()));
  const snapshot = await getDocs(ledgerQuery);

  if (snapshot.empty) return { found: false };
  return { found: true, docId: snapshot.docs[0].id };
}

/**
 * Handle ARAP operation errors and return user-friendly messages
 */
function handleARAPError(
  error: unknown,
  context: { transactionId?: string; operation: string }
): ARAPUpdateResult {
  console.error(`Error ${context.operation}:`, error);

  if (error instanceof Error) {
    if (error.message === ERRORS.LEDGER_NOT_FOUND) {
      return {
        success: false,
        message: context.transactionId
          ? `⚠ لم يتم العثور على حركة مالية برقم: ${context.transactionId}`
          : `⚠ لم يتم العثور على القيد المالي`,
      };
    }
    if (error.message === ERRORS.ARAP_NOT_ENABLED) {
      return {
        success: false,
        message: "⚠ الحركة المالية لا تتبع نظام الذمم",
      };
    }
  }

  return { success: false, message: "حدث خطأ أثناء تحديث الذمم" };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Update AR/AP tracking when a payment is added
 * Uses Firestore transaction to prevent race conditions
 */
export async function updateARAPOnPaymentAdd(
  firestore: Firestore,
  userId: string,
  transactionId: string,
  paymentAmount: number
): Promise<ARAPUpdateResult> {
  try {
    const lookup = await findLedgerDocByTransactionId(firestore, userId, transactionId);

    if (!lookup.found) {
      return { success: false, message: `⚠ لم يتم العثور على حركة مالية برقم: ${transactionId}` };
    }

    const ledgerDocRef = doc(firestore, `users/${userId}/ledger`, lookup.docId);

    return await runTransaction(firestore, (transaction) =>
      executeARAPTransaction(
        transaction,
        ledgerDocRef,
        paymentAmount,
        'add',
        `تم تحديث الذمم بنجاح`
      ).then(result => ({
        ...result,
        message: `تم تحديث: المدفوع ${roundCurrency(result.newTotalPaid!).toFixed(2)} - المتبقي ${roundCurrency(result.newRemainingBalance!).toFixed(2)}`,
      }))
    );
  } catch (error) {
    return handleARAPError(error, { transactionId, operation: 'updating AR/AP on payment add' });
  }
}

/**
 * Reverse AR/AP tracking when a payment is deleted
 * Uses Firestore transaction to prevent race conditions
 */
export async function reverseARAPOnPaymentDelete(
  firestore: Firestore,
  userId: string,
  transactionId: string,
  paymentAmount: number
): Promise<ARAPUpdateResult> {
  try {
    const lookup = await findLedgerDocByTransactionId(firestore, userId, transactionId);

    if (!lookup.found) {
      return { success: false, message: `⚠ لم يتم العثور على حركة مالية برقم: ${transactionId}` };
    }

    const ledgerDocRef = doc(firestore, `users/${userId}/ledger`, lookup.docId);

    return await runTransaction(firestore, (transaction) =>
      executeARAPTransaction(
        transaction,
        ledgerDocRef,
        paymentAmount,
        'subtract',
        "تم حذف المدفوعة وتحديث الرصيد في دفتر الأستاذ"
      )
    );
  } catch (error) {
    return handleARAPError(error, { transactionId, operation: 'reversing AR/AP on payment delete' });
  }
}

/**
 * Update a ledger entry's AR/AP fields directly by document ID
 * Uses Firestore transaction to prevent race conditions
 */
export async function updateLedgerEntryById(
  firestore: Firestore,
  userId: string,
  ledgerDocId: string,
  paymentAmount: number,
  operation: 'add' | 'subtract'
): Promise<ARAPUpdateResult> {
  try {
    const ledgerDocRef = doc(firestore, `users/${userId}/ledger`, ledgerDocId);

    return await runTransaction(firestore, (transaction) =>
      executeARAPTransaction(
        transaction,
        ledgerDocRef,
        paymentAmount,
        operation,
        `تم تحديث الذمم بنجاح`
      ).then(result => ({
        ...result,
        message: `تم تحديث: المدفوع ${roundCurrency(result.newTotalPaid!).toFixed(2)} - المتبقي ${roundCurrency(result.newRemainingBalance!).toFixed(2)}`,
      }))
    );
  } catch (error) {
    return handleARAPError(error, { operation: 'updating ledger entry by ID' });
  }
}
