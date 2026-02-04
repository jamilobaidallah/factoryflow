/**
 * AR/AP (Accounts Receivable/Payable) Utility Functions
 *
 * This module provides reusable functions for managing accounts receivable and payable,
 * including payment tracking, status calculations, and ledger updates.
 */

import {
  PaymentStatus,
  PAYMENT_STATUSES
} from './definitions';
import {
  safeSubtract,
  safeAdd,
  roundCurrency
} from './currency';

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

  if (remaining <= 0) {return PAYMENT_STATUSES.PAID;}
  if (effectiveSettled > 0) {return PAYMENT_STATUSES.PARTIAL;}
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
 * Format currency amount for display
 */
export function formatCurrency(amount: number, currency: string = 'دينار'): string {
  return `${roundCurrency(amount).toFixed(2)} ${currency}`;
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
