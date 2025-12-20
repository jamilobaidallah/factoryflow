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
  roundCurrency
} from './currency';
import { assertNonNegative, isDataIntegrityError } from './errors';

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
 * Calculate the payment status based on total paid, discounts, writeoffs, and transaction amount
 *
 * The effective settled amount includes:
 * - totalPaid: Actual cash/cheque payments received
 * - totalDiscount: Settlement discounts given (خصم تسوية)
 * - writeoffAmount: Bad debt written off (ديون معدومة)
 *
 * @param totalPaid - Sum of all payment amounts
 * @param transactionAmount - Original invoice/transaction amount
 * @param totalDiscount - Sum of all discounts given (default: 0)
 * @param writeoffAmount - Amount written off as bad debt (default: 0)
 */
export function calculatePaymentStatus(
  totalPaid: number,
  transactionAmount: number,
  totalDiscount: number = 0,
  writeoffAmount: number = 0
): PaymentStatus {
  const effectiveSettled = safeAdd(safeAdd(totalPaid, totalDiscount), writeoffAmount);
  const remaining = safeSubtract(transactionAmount, effectiveSettled);

  if (remaining <= 0) return PAYMENT_STATUSES.PAID;
  if (effectiveSettled > 0) return PAYMENT_STATUSES.PARTIAL;
  return PAYMENT_STATUSES.UNPAID;
}

/**
 * Calculate the remaining balance considering payments, discounts, and writeoffs
 */
export function calculateRemainingBalance(
  transactionAmount: number,
  totalPaid: number,
  totalDiscount: number = 0,
  writeoffAmount: number = 0
): number {
  const effectiveSettled = safeAdd(safeAdd(totalPaid, totalDiscount), writeoffAmount);
  return safeSubtract(transactionAmount, effectiveSettled);
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
  totalDiscount?: number;
  writeoffAmount?: number;
  amount?: number;
}

interface ARAPPaymentInput {
  paymentAmount: number;
  discountAmount?: number;
}

interface ARAPValuesResult {
  newTotalPaid: number;
  newTotalDiscount: number;
  newRemainingBalance: number;
  newStatus: PaymentStatus;
}

/**
 * Calculate new ARAP values after a payment change (with optional discount)
 *
 * @param ledgerData - Current ledger entry data
 * @param input - Payment amount and optional discount amount
 * @param operation - 'add' for new payment, 'subtract' for reversal
 */
function calculateNewARAPValues(
  ledgerData: LedgerData,
  input: ARAPPaymentInput | number,
  operation: 'add' | 'subtract'
): ARAPValuesResult {
  // Support both old signature (number) and new signature (object) for backward compatibility
  const paymentAmount = typeof input === 'number' ? input : input.paymentAmount;
  const discountAmount = typeof input === 'number' ? 0 : (input.discountAmount || 0);

  const currentTotalPaid = ledgerData.totalPaid || 0;
  const currentTotalDiscount = ledgerData.totalDiscount || 0;
  const writeoffAmount = ledgerData.writeoffAmount || 0;
  const transactionAmount = ledgerData.amount || 0;

  // Calculate new payment total
  const rawNewTotalPaid = operation === 'add'
    ? safeAdd(currentTotalPaid, paymentAmount)
    : safeSubtract(currentTotalPaid, paymentAmount);

  // Calculate new discount total
  const rawNewTotalDiscount = operation === 'add'
    ? safeAdd(currentTotalDiscount, discountAmount)
    : safeSubtract(currentTotalDiscount, discountAmount);

  // Fail fast on negative values - this indicates data corruption (e.g., double-reversal)
  const newTotalPaid = assertNonNegative(rawNewTotalPaid, {
    operation: 'calculateARAPPayment',
    entityType: 'payment'
  });

  const newTotalDiscount = assertNonNegative(rawNewTotalDiscount, {
    operation: 'calculateARAPDiscount',
    entityType: 'discount'
  });

  // Calculate remaining balance considering all settlements
  const newRemainingBalance = calculateRemainingBalance(
    transactionAmount,
    newTotalPaid,
    newTotalDiscount,
    writeoffAmount
  );

  // Calculate status considering all settlements
  const newStatus = calculatePaymentStatus(
    newTotalPaid,
    transactionAmount,
    newTotalDiscount,
    writeoffAmount
  );

  return { newTotalPaid, newTotalDiscount, newRemainingBalance, newStatus };
}

/**
 * Execute atomic ARAP update within a Firestore transaction
 * Supports both payment-only and payment+discount scenarios
 */
async function executeARAPTransaction(
  transaction: Transaction,
  ledgerDocRef: DocumentReference,
  input: ARAPPaymentInput | number,
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

  const { newTotalPaid, newTotalDiscount, newRemainingBalance, newStatus } = calculateNewARAPValues(
    ledgerData,
    input,
    operation
  );

  // Build update object - only include totalDiscount if there's a discount
  const updateData: Record<string, unknown> = {
    totalPaid: newTotalPaid,
    remainingBalance: newRemainingBalance,
    paymentStatus: newStatus,
  };

  // Only update totalDiscount if it changed (to avoid unnecessary writes)
  const discountAmount = typeof input === 'number' ? 0 : (input.discountAmount || 0);
  if (discountAmount > 0 || (ledgerData.totalDiscount || 0) > 0) {
    updateData.totalDiscount = newTotalDiscount;
  }

  transaction.update(ledgerDocRef, updateData);

  return {
    success: true,
    message: successMessage,
    newTotalPaid,
    newTotalDiscount,
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

  // Handle data integrity errors (negative values)
  if (isDataIntegrityError(error)) {
    return {
      success: false,
      message: "⚠ خطأ في سلامة البيانات: المبلغ المدفوع سيصبح سالباً. قد يكون هناك تكرار في العملية.",
    };
  }

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
