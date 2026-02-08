import { useMemo } from 'react';
import { getDateRange } from '@/lib/statement-format';
import {
  isLoanTransaction,
  isInitialLoan,
  getLoanType,
} from '@/components/ledger/utils/ledger-helpers';
import { isAdvanceEntry, type LedgerEntry } from './useLedgerForClient';
import type { Payment } from './usePaymentsForClient';
import type { Client } from './useClientData';

export interface StatementItem {
  id: string;
  transactionId?: string;
  source: 'ledger' | 'payment';
  date: Date;
  isPayment: boolean;
  entryType: string;
  description: string;
  debit: number;
  credit: number;
  balance?: number;
  // Ledger-specific
  category?: string;
  subCategory?: string;
  // Payment-specific
  notes?: string;
  isEndorsement?: boolean; // True if this is an endorsement-based payment
}

interface StatementData {
  openingBalance: number;
  filteredTransactions: StatementItem[];
  rowsWithBalance: StatementItem[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
}

/**
 * Hook to compute statement data from ledger entries and payments
 * Handles:
 * - Combining ledger entries and payments into unified statement items
 * - Calculating debit/credit for loans, advances, income, and expenses
 * - Filtering by date range
 * - Computing running balances
 */
export function useStatementData(
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  client: Client | null,
  dateFrom: Date | undefined,
  dateTo: Date | undefined
) {
  // Memoize allTransactions - expensive computation that combines ledger entries and payments
  const allTransactions = useMemo((): StatementItem[] => {
    return [
      // Ledger entries (invoices) plus their discounts and writeoffs
      ...ledgerEntries.flatMap((e) => {
        const rows: StatementItem[] = [];
        const isAdvance = isAdvanceEntry(e);
        const isLoan = isLoanTransaction(e.type, e.category);

        // Skip advances that were created from multi-allocation payments
        // These have linkedPaymentId and their cash movement is already captured
        // in the payment record (avoids double-counting the advance amount)
        if (isAdvance && e.linkedPaymentId) {
          return [];
        }

        // Determine debit/credit based on entry type
        let debit = 0;
        let credit = 0;
        if (isLoan) {
          // Loans: direction based on subcategory
          const loanType = getLoanType(e.category);
          if (isInitialLoan(e.subCategory)) {
            // Initial loans:
            // - Loan Given (قروض ممنوحة / منح قرض): We lent money → debit (they owe us)
            // - Loan Received (قروض مستلمة / استلام قرض): We borrowed → credit (we owe them)
            if (loanType === "receivable") {
              debit = e.amount; // We lent money, they owe us
            } else if (loanType === "payable") {
              credit = e.amount; // We borrowed, we owe them
            }
          } else {
            // Loan repayments/collections:
            // - Loan Collection (تحصيل قرض): They paid us back → credit (reduces what they owe)
            // - Loan Repayment (سداد قرض): We paid back → debit (reduces what we owe)
            if (loanType === "receivable") {
              credit = e.amount; // They paid back
            } else if (loanType === "payable") {
              debit = e.amount; // We paid back
            }
          }
        } else if (isAdvance) {
          // Advances have INVERTED debit/credit vs their entry type
          // Customer advance (سلفة عميل): We received cash, but we OWE them goods → credit (لنا)
          // Supplier advance (سلفة مورد): We paid cash, they OWE us goods → debit (عليه)
          // Show FULL amount - the "مدفوع من سلفة" row on invoices is informational only
          if (e.category === "سلفة عميل") {
            credit = e.amount; // We owe them (liability) - full amount received
          } else if (e.category === "سلفة مورد") {
            debit = e.amount; // They owe us (asset) - full amount paid
          }
        } else if (e.type === "دخل" || e.type === "إيراد") {
          debit = e.amount;
        } else if (e.type === "مصروف") {
          credit = e.amount;
        }

        rows.push({
          id: e.id,
          transactionId: e.transactionId,
          source: 'ledger' as const,
          date: e.date,
          isPayment: false,
          entryType: isAdvance ? 'سلفة' : (isLoan ? 'قرض' : e.type),
          description: e.description,
          category: e.category,
          subCategory: e.subCategory,
          debit,
          credit,
        });

        // Row 2: Discount from ledger entry (if any) - reduces what client owes
        if (e.totalDiscount && e.totalDiscount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
          rows.push({
            id: `${e.id}-discount`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,  // Display as payment-like row
            entryType: 'خصم',
            description: 'خصم تسوية',
            category: e.category,
            debit: 0,
            credit: e.totalDiscount,  // Credit reduces debt
          });
        }

        // Row 3: Writeoff from ledger entry (if any) - reduces what client owes
        if (e.writeoffAmount && e.writeoffAmount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
          rows.push({
            id: `${e.id}-writeoff`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,  // Display as payment-like row
            entryType: 'شطب',
            description: 'شطب دين معدوم',
            category: e.category,
            debit: 0,
            credit: e.writeoffAmount,  // Credit reduces debt
          });
        }

        // Row 4: Expense discount (if any) - reduces what we owe supplier (DEBIT)
        if (e.totalDiscount && e.totalDiscount > 0 && e.type === "مصروف") {
          rows.push({
            id: `${e.id}-discount`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,
            entryType: 'خصم مورد',
            description: 'خصم من المورد',
            category: e.category,
            debit: e.totalDiscount,  // DEBIT reduces liability (opposite of income)
            credit: 0,
          });
        }

        // Row 5: Expense writeoff (if any) - reduces what we owe supplier (DEBIT)
        if (e.writeoffAmount && e.writeoffAmount > 0 && e.type === "مصروف") {
          rows.push({
            id: `${e.id}-writeoff`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,
            entryType: 'إعفاء مورد',
            description: 'إعفاء من المورد',
            category: e.category,
            debit: e.writeoffAmount,  // DEBIT reduces liability
            credit: 0,
          });
        }

        // Row 6: Paid from advance (if any) - INFORMATIONAL ONLY
        // Shows that invoice was paid using customer/supplier advance, but doesn't affect balance
        // The advance entry shows FULL amount, so this row is just for clarity
        if (e.totalPaidFromAdvances && e.totalPaidFromAdvances > 0) {
          const isIncome = e.type === "دخل" || e.type === "إيراد";
          rows.push({
            id: `${e.id}-advance-payment`,
            transactionId: e.transactionId,
            source: 'ledger' as const,
            date: e.date,
            isPayment: true,
            entryType: 'معلومات',
            description: isIncome
              ? `مدفوع من سلفة عميل (${e.totalPaidFromAdvances})`
              : `مخصوم من سلفة مورد (${e.totalPaidFromAdvances})`,
            category: e.category,
            debit: 0,   // Informational only - no balance impact
            credit: 0,  // The advance entry already shows full amount
          });
        }

        return rows;
      }),
      // Payments (cash/cheque payments only - discounts/writeoffs come from ledger)
      // Note: Don't include payment.discountAmount here as it's already in ledger.totalDiscount
      ...payments.flatMap((p) => {
        // Only show payments with actual amount (skip discount-only records)
        if (p.amount <= 0) {
          return [];
        }

        // Skip payments linked to advance entries (already shown as سلفة)
        if (p.linkedTransactionId) {
          // linkedTransactionId stores the transactionId, not the document id
          const linkedEntry = ledgerEntries.find(e => e.transactionId === p.linkedTransactionId);
          if (linkedEntry && isAdvanceEntry(linkedEntry)) {
            return []; // Skip advance-related payments
          }
        }

        return [{
          id: p.id,
          source: 'payment' as const,
          date: p.date,
          isPayment: true,
          entryType: p.type,
          description: p.notes || p.description || 'دفعة',
          notes: p.notes,
          isEndorsement: p.isEndorsement || false, // Track endorsement payments
          // Payment received (قبض): goes in دائن (reduces what they owe us)
          // Payment made (صرف): goes in مدين (reduces what we owe them)
          debit: p.type === "صرف" ? p.amount : 0,
          credit: p.type === "قبض" ? p.amount : 0,
        }];
      }),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [ledgerEntries, payments]);

  // Memoize date range calculation
  const dateRange = useMemo(() => getDateRange(allTransactions), [allTransactions]);

  // Memoize filtered transactions and balance calculations
  const statementData = useMemo((): StatementData => {
    // Calculate opening balance
    // Start with client's initial balance (الرصيد الافتتاحي) from their record
    const clientInitialBalance = client?.balance || 0;
    let openingBalance = clientInitialBalance;

    // If date filter is applied, add all transactions BEFORE the "from" date
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      allTransactions.forEach((item) => {
        const itemDate = new Date(item.date);
        itemDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) {
          openingBalance += item.debit - item.credit;
        }
      });
    }

    // Filter transactions by date range
    const filteredTransactions = allTransactions.filter((item) => {
      const itemDate = new Date(item.date);
      itemDate.setHours(0, 0, 0, 0);

      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (itemDate < fromDate) {
          return false;
        }
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate > toDate) {
          return false;
        }
      }
      return true;
    });

    // Calculate totals from filtered transactions
    // Running balance starts from opening balance
    let totalDebit = 0;
    let totalCredit = 0;
    let runningBalance = openingBalance;
    const rowsWithBalance = filteredTransactions.map((t) => {
      totalDebit += t.debit;
      totalCredit += t.credit;
      runningBalance += t.debit - t.credit;
      return { ...t, balance: runningBalance };
    });

    const finalBalance = runningBalance;

    return {
      openingBalance,
      filteredTransactions,
      rowsWithBalance,
      totalDebit,
      totalCredit,
      finalBalance,
    };
  }, [allTransactions, dateFrom, dateTo, client?.balance]);

  return {
    allTransactions,
    dateRange,
    ...statementData,
  };
}
