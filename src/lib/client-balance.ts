/**
 * Shared client balance calculation utilities
 *
 * This module provides a single source of truth for calculating client balances.
 * Used by both the clients list page and the client balance sheet to ensure consistency.
 *
 * Balance Formula:
 * balance = openingBalance + sum(debit - credit) for all transactions
 *
 * Where:
 * - Income transactions (sales): debit
 * - Expense transactions (purchases): credit
 * - Payments received (قبض): credit (reduces what they owe)
 * - Payments made (صرف): debit (reduces what we owe)
 * - Customer advances (سلفة عميل): credit (we owe them)
 * - Supplier advances (سلفة مورد): debit (they owe us)
 * - Loans given: debit (they owe us)
 * - Loans received: credit (we owe them)
 * - Income discounts/writeoffs: credit (reduces what they owe)
 * - Expense discounts/writeoffs: debit (reduces what we owe)
 *
 * Positive balance = عليه (they owe us)
 * Negative balance = له (we owe them)
 */

import {
  isLoanTransaction,
  isInitialLoan,
  getLoanType,
} from '@/components/ledger/utils/ledger-helpers';

// Types for balance calculation
export interface BalanceLedgerEntry {
  id: string;
  transactionId?: string; // Unique transaction identifier (used by payments to link to entries)
  type: string;
  amount: number;
  category: string;
  subCategory?: string;
  totalDiscount?: number;
  writeoffAmount?: number;
  linkedPaymentId?: string; // For advances created from multi-allocation payments
}

export interface BalancePayment {
  id: string;
  type: string;
  amount: number;
  linkedTransactionId?: string; // Links payment to ledger entry (e.g., advance)
}

export interface BalanceCheque {
  id: string;
  amount: number;
  type: string; // 'وارد' (incoming) or 'صادر' (outgoing)
  status: string;
  isEndorsedCheque?: boolean;
}

/**
 * Check if entry is an advance (customer or supplier)
 */
function isAdvanceEntry(entry: BalanceLedgerEntry): boolean {
  return entry.category === 'سلفة عميل' || entry.category === 'سلفة مورد';
}

/**
 * Check if entry type is income
 */
function isIncomeType(type: string): boolean {
  return type === 'دخل' || type === 'إيراد';
}

/**
 * Calculate debit and credit for a ledger entry
 * This is the core transformation used by both balance sheet and clients list
 */
export function calculateEntryDebitCredit(
  entry: BalanceLedgerEntry
): { debit: number; credit: number; discountDebit: number; discountCredit: number; writeoffDebit: number; writeoffCredit: number } {
  const isAdvance = isAdvanceEntry(entry);
  const isLoan = isLoanTransaction(entry.type, entry.category);

  let debit = 0;
  let credit = 0;
  let discountDebit = 0;
  let discountCredit = 0;
  let writeoffDebit = 0;
  let writeoffCredit = 0;

  // Skip advances that were created from multi-allocation payments
  // These have linkedPaymentId and their cash movement is already captured
  // in the payment record (avoids double-counting the advance amount)
  if (isAdvance && entry.linkedPaymentId) {
    return { debit: 0, credit: 0, discountDebit: 0, discountCredit: 0, writeoffDebit: 0, writeoffCredit: 0 };
  }

  if (isLoan) {
    // Loans: direction based on subcategory
    const loanType = getLoanType(entry.category);
    if (isInitialLoan(entry.subCategory)) {
      // Initial loans:
      // - Loan Given (قروض ممنوحة / منح قرض): We lent money → debit (they owe us)
      // - Loan Received (قروض مستلمة / استلام قرض): We borrowed → credit (we owe them)
      if (loanType === 'receivable') {
        debit = entry.amount; // We lent money, they owe us
      } else if (loanType === 'payable') {
        credit = entry.amount; // We borrowed, we owe them
      }
    } else {
      // Loan repayments/collections:
      // - Loan Collection (تحصيل قرض): They paid us back → credit (reduces what they owe)
      // - Loan Repayment (سداد قرض): We paid back → debit (reduces what we owe)
      if (loanType === 'receivable') {
        credit = entry.amount; // They paid back
      } else if (loanType === 'payable') {
        debit = entry.amount; // We paid back
      }
    }
  } else if (isAdvance) {
    // Advances have INVERTED debit/credit vs their entry type
    // Customer advance (سلفة عميل): We received cash, but we OWE them goods → credit (لنا)
    // Supplier advance (سلفة مورد): We paid cash, they OWE us goods → debit (عليه)
    if (entry.category === 'سلفة عميل') {
      credit = entry.amount; // We owe them (liability)
    } else if (entry.category === 'سلفة مورد') {
      debit = entry.amount; // They owe us (asset)
    }
  } else if (isIncomeType(entry.type)) {
    debit = entry.amount;
    // Income discounts/writeoffs reduce what they owe (credit)
    if (entry.totalDiscount && entry.totalDiscount > 0) {
      discountCredit = entry.totalDiscount;
    }
    if (entry.writeoffAmount && entry.writeoffAmount > 0) {
      writeoffCredit = entry.writeoffAmount;
    }
  } else if (entry.type === 'مصروف') {
    credit = entry.amount;
    // Expense discounts/writeoffs reduce what we owe (debit)
    if (entry.totalDiscount && entry.totalDiscount > 0) {
      discountDebit = entry.totalDiscount;
    }
    if (entry.writeoffAmount && entry.writeoffAmount > 0) {
      writeoffDebit = entry.writeoffAmount;
    }
  }

  return { debit, credit, discountDebit, discountCredit, writeoffDebit, writeoffCredit };
}

/**
 * Calculate debit and credit for a payment
 */
export function calculatePaymentDebitCredit(
  payment: BalancePayment,
  ledgerEntries?: BalanceLedgerEntry[]
): { debit: number; credit: number } {
  // Skip payments with no amount
  if (payment.amount <= 0) {
    return { debit: 0, credit: 0 };
  }

  // Skip payments linked to advance entries (already counted in ledger)
  // Note: linkedTransactionId refers to the transactionId field, NOT the document id
  if (payment.linkedTransactionId && ledgerEntries) {
    const linkedEntry = ledgerEntries.find(e => e.transactionId === payment.linkedTransactionId);
    if (linkedEntry && isAdvanceEntry(linkedEntry)) {
      return { debit: 0, credit: 0 };
    }
  }

  // Payment received (قبض): credit (reduces what they owe)
  // Payment made (صرف): debit (reduces what we owe)
  if (payment.type === 'قبض') {
    return { debit: 0, credit: payment.amount };
  } else if (payment.type === 'صرف') {
    return { debit: payment.amount, credit: 0 };
  }

  return { debit: 0, credit: 0 };
}

/**
 * Calculate total balance from ledger entries and payments
 *
 * @param openingBalance - The client's initial balance
 * @param ledgerEntries - All ledger entries for this client
 * @param payments - All payments for this client
 * @returns The current balance (positive = they owe us, negative = we owe them)
 */
export function calculateClientBalance(
  openingBalance: number,
  ledgerEntries: BalanceLedgerEntry[],
  payments: BalancePayment[]
): number {
  let totalDebit = 0;
  let totalCredit = 0;

  // Process ledger entries
  for (const entry of ledgerEntries) {
    const { debit, credit, discountDebit, discountCredit, writeoffDebit, writeoffCredit } =
      calculateEntryDebitCredit(entry);
    totalDebit += debit + discountDebit + writeoffDebit;
    totalCredit += credit + discountCredit + writeoffCredit;
  }

  // Process payments
  for (const payment of payments) {
    const { debit, credit } = calculatePaymentDebitCredit(payment, ledgerEntries);
    totalDebit += debit;
    totalCredit += credit;
  }

  // Balance = opening + (debit - credit)
  // Positive = they owe us (عليه)
  // Negative = we owe them (له)
  return openingBalance + totalDebit - totalCredit;
}

/**
 * Calculate balance after pending cheques clear
 *
 * @param currentBalance - The current balance before cheques
 * @param pendingCheques - Pending cheques for this client
 * @returns The expected balance after all pending cheques clear
 */
export function calculateBalanceAfterCheques(
  currentBalance: number,
  pendingCheques: BalanceCheque[]
): number {
  // Filter to only PENDING cheques (excluding endorsed)
  const pending = pendingCheques.filter(
    c => c.status === 'معلق' && !c.isEndorsedCheque
  );

  let incomingTotal = 0;
  let outgoingTotal = 0;

  for (const cheque of pending) {
    if (cheque.type === 'وارد') {
      incomingTotal += cheque.amount || 0;
    } else if (cheque.type === 'صادر') {
      outgoingTotal += cheque.amount || 0;
    }
  }

  // Incoming cheques reduce what they owe (subtract)
  // Outgoing cheques reduce what we owe (add)
  return currentBalance - incomingTotal + outgoingTotal;
}

/**
 * Check if client has pending cheques
 */
export function hasPendingCheques(pendingCheques: BalanceCheque[]): boolean {
  return pendingCheques.some(c => c.status === 'معلق' && !c.isEndorsedCheque);
}
