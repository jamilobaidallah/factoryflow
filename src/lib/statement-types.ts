/**
 * Shared types for client statement exports (PDF, Excel)
 */

export interface StatementTransaction {
  date: Date;
  type?: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface PendingCheque {
  chequeNumber: string;
  bankName: string;
  dueDate: Date;
  amount: number;
}

export interface ExportStatementData {
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  dateFrom?: Date;
  dateTo?: Date;
  openingBalance: number;
  transactions: StatementTransaction[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  pendingCheques?: PendingCheque[];
  expectedBalanceAfterCheques?: number;
}
