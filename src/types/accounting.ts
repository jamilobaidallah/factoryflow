/**
 * Double-Entry Bookkeeping Types
 *
 * Implements standard accounting concepts:
 * - Chart of Accounts with account types
 * - Journal entries with debit/credit pairs
 * - Self-balancing verification
 */

/**
 * Account Types (5 fundamental types)
 *
 * Normal Balance:
 * - Asset, Expense: Debit (increases with debit)
 * - Liability, Equity, Revenue: Credit (increases with credit)
 */
export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

/**
 * Normal balance side for an account
 */
export type NormalBalance = 'debit' | 'credit';

/**
 * Account in Chart of Accounts
 */
export interface Account {
  id: string;
  code: string;           // e.g., "1000", "1200", "4000"
  name: string;           // English name
  nameAr: string;         // Arabic name
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  parentCode?: string;    // For sub-accounts
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Account for Firestore storage (dates as any for Timestamp compatibility)
 */
export interface AccountDocument {
  code: string;
  name: string;
  nameAr: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  parentCode?: string;
  description?: string;
  createdAt: Date;
  updatedAt?: Date;
}

/**
 * Single line in a journal entry
 * Each line represents either a debit or credit to an account
 */
export interface JournalLine {
  accountCode: string;
  accountName: string;    // Denormalized for display
  accountNameAr: string;  // Arabic name for display
  debit: number;          // Amount if debit, 0 if credit
  credit: number;         // Amount if credit, 0 if debit
  description?: string;   // Line-level description
}

/**
 * Journal Entry Status
 */
export type JournalEntryStatus = 'draft' | 'posted' | 'reversed';

/**
 * Journal Entry (double-entry record)
 *
 * Rule: Sum of debits MUST equal sum of credits
 */
export interface JournalEntry {
  id: string;
  entryNumber: string;    // JE-YYYYMMDD-HHMMSS-XXX format
  date: Date;
  description: string;
  lines: JournalLine[];
  status: JournalEntryStatus;
  linkedTransactionId?: string;   // Links to original ledger entry
  linkedPaymentId?: string;       // Links to payment if applicable
  linkedDocumentType?: 'ledger' | 'payment' | 'cheque' | 'depreciation' | 'inventory';
  reversedById?: string;          // If reversed, ID of reversing entry
  reversesEntryId?: string;       // If this reverses another entry
  createdAt: Date;
  updatedAt?: Date;
  postedAt?: Date;
}

/**
 * Journal Entry for Firestore storage
 */
export interface JournalEntryDocument {
  entryNumber: string;
  date: Date;
  description: string;
  lines: JournalLine[];
  status: JournalEntryStatus;
  linkedTransactionId?: string;
  linkedPaymentId?: string;
  linkedDocumentType?: 'ledger' | 'payment' | 'cheque' | 'depreciation' | 'inventory';
  reversedById?: string;
  reversesEntryId?: string;
  createdAt: Date;
  updatedAt?: Date;
  postedAt?: Date;
}

/**
 * Account Balance (calculated from journal entries)
 */
export interface AccountBalance {
  accountCode: string;
  accountName: string;
  accountNameAr: string;
  accountType: AccountType;
  totalDebits: number;
  totalCredits: number;
  balance: number;        // Calculated based on normal balance
}

/**
 * Trial Balance Summary
 */
export interface TrialBalanceSummary {
  accounts: AccountBalance[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
  difference: number;     // Should be 0 if balanced
  asOfDate: Date;
}

/**
 * Balance Sheet Section
 */
export interface BalanceSheetSection {
  title: string;
  titleAr: string;
  accounts: AccountBalance[];
  total: number;
}

/**
 * Balance Sheet Report
 */
export interface BalanceSheet {
  asOfDate: Date;
  assets: BalanceSheetSection;
  liabilities: BalanceSheetSection;
  equity: BalanceSheetSection;
  totalAssets: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  difference: number;
}

/**
 * Helper to determine normal balance for account type
 */
export function getNormalBalance(type: AccountType): NormalBalance {
  switch (type) {
    case 'asset':
    case 'expense':
      return 'debit';
    case 'liability':
    case 'equity':
    case 'revenue':
      return 'credit';
  }
}

/**
 * Calculate account balance based on normal balance side
 *
 * For debit-normal accounts: balance = debits - credits
 * For credit-normal accounts: balance = credits - debits
 */
export function calculateAccountBalance(
  totalDebits: number,
  totalCredits: number,
  normalBalance: NormalBalance
): number {
  if (normalBalance === 'debit') {
    return totalDebits - totalCredits;
  }
  return totalCredits - totalDebits;
}

/**
 * Validate journal entry lines (debits must equal credits)
 */
export function validateJournalEntry(lines: JournalLine[]): {
  isValid: boolean;
  totalDebits: number;
  totalCredits: number;
  difference: number;
} {
  const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0);
  const difference = Math.abs(totalDebits - totalCredits);

  // Allow for small floating point differences (use 0.001 tolerance)
  const isValid = difference < 0.001;

  return {
    isValid,
    totalDebits,
    totalCredits,
    difference
  };
}

/**
 * Account code ranges by type
 */
export const ACCOUNT_CODE_RANGES = {
  asset: { min: 1000, max: 1999 },
  liability: { min: 2000, max: 2999 },
  equity: { min: 3000, max: 3999 },
  revenue: { min: 4000, max: 4999 },
  expense: { min: 5000, max: 5999 }
} as const;

/**
 * Standard account codes (constants)
 */
export const ACCOUNT_CODES = {
  // Assets
  CASH: '1000',
  BANK: '1100',
  ACCOUNTS_RECEIVABLE: '1200',
  INVENTORY: '1300',
  PREPAID_EXPENSES: '1400',
  FIXED_ASSETS: '1500',
  ACCUMULATED_DEPRECIATION: '1510',
  LOANS_RECEIVABLE: '1600',      // قروض ممنوحة (Loans Given - Asset)

  // Liabilities
  ACCOUNTS_PAYABLE: '2000',
  ACCRUED_EXPENSES: '2100',
  NOTES_PAYABLE: '2200',
  LOANS_PAYABLE: '2300',         // قروض مستلمة (Loans Received - Liability)

  // Equity
  OWNER_CAPITAL: '3000',
  OWNER_DRAWINGS: '3100',
  RETAINED_EARNINGS: '3200',

  // Revenue
  SALES_REVENUE: '4000',
  SERVICE_REVENUE: '4100',
  OTHER_INCOME: '4200',
  // Contra-Revenue
  SALES_DISCOUNT: '4300',

  // Expenses
  COST_OF_GOODS_SOLD: '5000',
  PURCHASE_DISCOUNT: '5050',
  SALARIES_EXPENSE: '5100',
  RENT_EXPENSE: '5200',
  UTILITIES_EXPENSE: '5300',
  DEPRECIATION_EXPENSE: '5400',
  OTHER_EXPENSES: '5500',
  BAD_DEBT_EXPENSE: '5600'
} as const;
