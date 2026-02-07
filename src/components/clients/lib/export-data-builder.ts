import {
  isLoanTransaction,
  isInitialLoan,
  getLoanType,
} from '@/components/ledger/utils/ledger-helpers';
import { isAdvanceEntry, type LedgerEntry, type Payment, type Cheque } from '../hooks';
import { filterPendingCheques, calculateBalanceAfterCheques } from './statement-helpers';

export interface ExportTransaction {
  date: Date;
  type?: "Invoice" | "Payment";
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface ExportData {
  transactions: ExportTransaction[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  pendingCheques: Array<{
    chequeNumber: string;
    bankName: string;
    dueDate: Date;
    amount: number;
    type: string;
  }>;
  balanceAfterCheques: number;
}

/**
 * Build export data from ledger entries, payments, and cheques
 * This shared function is used by both Excel and PDF exports
 */
export function buildExportData(
  ledgerEntries: LedgerEntry[],
  payments: Payment[],
  cheques: Cheque[],
  clientInitialBalance: number
): ExportData {
  // Build transaction rows from ledger entries (including discounts and writeoffs)
  const allTxns: ExportTransaction[] = [
    ...ledgerEntries.flatMap((e) => {
      const rows: ExportTransaction[] = [];
      const isAdvance = isAdvanceEntry(e);
      const isLoan = isLoanTransaction(e.type, e.category);

      // Skip advances that were created from multi-allocation payments
      // These have linkedPaymentId and their cash movement is already captured
      // in the payment record (avoids double-counting the advance amount)
      if (isAdvance && e.linkedPaymentId) {
        return [];
      }

      // Calculate debit/credit based on transaction type
      let debit = 0;
      let credit = 0;
      if (isAdvance) {
        // Customer advance (سلفة عميل): We received cash, we owe them goods → credit
        // Supplier advance (سلفة مورد): We paid cash, they owe us goods → debit
        if (e.category === "سلفة عميل") {
          credit = e.amount;
        } else if (e.category === "سلفة مورد") {
          debit = e.amount;
        }
      } else if (isLoan) {
        const loanType = getLoanType(e.category);
        if (isInitialLoan(e.subCategory)) {
          if (loanType === "receivable") {
            debit = e.amount;
          } else if (loanType === "payable") {
            credit = e.amount;
          }
        } else {
          if (loanType === "receivable") {
            credit = e.amount;
          } else if (loanType === "payable") {
            debit = e.amount;
          }
        }
      } else if (e.type === "دخل" || e.type === "إيراد") {
        debit = e.amount;
      } else if (e.type === "مصروف") {
        credit = e.amount;
      }

      // Row 1: The invoice/loan/advance itself
      rows.push({
        date: e.date,
        type: "Invoice" as const,
        description: e.description,
        debit,
        credit,
        balance: 0,
      });

      // Row 2: Discount (if any) - reduces what client owes
      if (e.totalDiscount && e.totalDiscount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
        rows.push({
          date: e.date,
          type: "Payment" as const,
          description: "خصم تسوية",
          debit: 0,
          credit: e.totalDiscount,
          balance: 0,
        });
      }

      // Row 3: Writeoff (if any) - reduces what client owes
      if (e.writeoffAmount && e.writeoffAmount > 0 && (e.type === "دخل" || e.type === "إيراد")) {
        rows.push({
          date: e.date,
          type: "Payment" as const,
          description: "شطب دين معدوم",
          debit: 0,
          credit: e.writeoffAmount,
          balance: 0,
        });
      }

      return rows;
    }),
    ...payments.map((p) => ({
      date: p.date,
      type: "Payment" as const,
      description: p.notes || p.description || '',
      debit: p.type === "صرف" ? p.amount : 0,
      credit: p.type === "قبض" ? p.amount : 0,
      balance: 0,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Calculate running balances
  let runningBalance = clientInitialBalance;
  let totalDebit = 0;
  let totalCredit = 0;

  const txnsWithBalance = allTxns.map((t) => {
    totalDebit += t.debit;
    totalCredit += t.credit;
    runningBalance += t.debit - t.credit;
    return { ...t, balance: runningBalance };
  });

  // Get pending cheques
  const pending = filterPendingCheques(cheques);
  const pendingChequeData = pending.map((c) => ({
    chequeNumber: c.chequeNumber,
    bankName: c.bankName,
    dueDate: c.dueDate || c.issueDate,
    amount: c.amount,
    type: c.type,
  }));

  // Calculate balance after cheques
  const { balanceAfterCheques } = calculateBalanceAfterCheques(runningBalance, pending);

  return {
    transactions: txnsWithBalance,
    totalDebit,
    totalCredit,
    finalBalance: runningBalance,
    pendingCheques: pendingChequeData,
    balanceAfterCheques,
  };
}
