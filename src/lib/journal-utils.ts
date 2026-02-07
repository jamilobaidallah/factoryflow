/**
 * Journal Utilities - Pure Functions
 *
 * Extracted from journalService for:
 * - Better testability (no Firestore mocking needed)
 * - Single Responsibility (calculations vs I/O)
 * - Reusability across the codebase
 */

import { AccountType, JournalLine, ACCOUNT_CODES } from '@/types/accounting';
import { AccountMapping } from '@/lib/account-mapping';
import { roundCurrency } from '@/lib/currency';
import { ACCOUNTING_TOLERANCE } from '@/lib/constants';

// ============================================================================
// Input Validation
// ============================================================================

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate userId is present and valid
 */
export function validateUserId(userId: unknown): asserts userId is string {
  if (!userId || typeof userId !== 'string' || !userId.trim()) {
    throw new ValidationError('userId is required and must be a non-empty string');
  }
}

/**
 * Validate amount is a positive number
 */
export function validateAmount(amount: unknown): asserts amount is number {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new ValidationError('amount must be a finite number');
  }
  if (amount <= 0) {
    throw new ValidationError('amount must be greater than zero');
  }
}

/**
 * Validate date is a valid Date object
 */
export function validateDate(date: unknown): asserts date is Date {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    throw new ValidationError('date must be a valid Date object');
  }
}

/**
 * Validate description is present
 */
export function validateDescription(description: unknown): asserts description is string {
  if (!description || typeof description !== 'string' || !description.trim()) {
    throw new ValidationError('description is required and must be a non-empty string');
  }
}

/**
 * Validate journal entry inputs
 */
export function validateJournalEntryInputs(
  userId: string,
  description: string,
  amount: number,
  date: Date
): void {
  validateUserId(userId);
  validateDescription(description);
  validateAmount(amount);
  validateDate(date);
}

// ============================================================================
// Journal Line Creation
// ============================================================================

/**
 * Create standard debit/credit journal lines from an account mapping
 * Pure function - no side effects
 */
export function createJournalLines(
  mapping: AccountMapping,
  amount: number,
  description: string
): JournalLine[] {
  const roundedAmount = roundCurrency(amount);

  return [
    {
      accountCode: mapping.debitAccount,
      accountName: mapping.debitAccount,
      accountNameAr: mapping.debitAccountNameAr,
      debit: roundedAmount,
      credit: 0,
      description,
    },
    {
      accountCode: mapping.creditAccount,
      accountName: mapping.creditAccount,
      accountNameAr: mapping.creditAccountNameAr,
      debit: 0,
      credit: roundedAmount,
      description,
    },
  ];
}

// ============================================================================
// Account Type Detection
// ============================================================================

/**
 * Account code ranges for standard chart of accounts
 */
export const ACCOUNT_RANGES = {
  asset: { min: 1000, max: 1999 },
  liability: { min: 2000, max: 2999 },
  equity: { min: 3000, max: 3999 },
  revenue: { min: 4000, max: 4999 },
  expense: { min: 5000, max: 5999 },
} as const;

/**
 * Determine account type from account code using standard ranges
 * Pure function - no side effects
 */
export function getAccountTypeFromCode(accountCode: string): AccountType {
  const codeNum = parseInt(accountCode, 10);

  if (isNaN(codeNum)) {
    return 'expense'; // Safe default
  }

  if (codeNum >= ACCOUNT_RANGES.asset.min && codeNum <= ACCOUNT_RANGES.asset.max) {
    return 'asset';
  }
  if (codeNum >= ACCOUNT_RANGES.liability.min && codeNum <= ACCOUNT_RANGES.liability.max) {
    return 'liability';
  }
  if (codeNum >= ACCOUNT_RANGES.equity.min && codeNum <= ACCOUNT_RANGES.equity.max) {
    return 'equity';
  }
  if (codeNum >= ACCOUNT_RANGES.revenue.min && codeNum <= ACCOUNT_RANGES.revenue.max) {
    return 'revenue';
  }

  return 'expense';
}

/**
 * Check if account is a contra-asset (reduces asset value)
 */
export function isContraAsset(accountCode: string): boolean {
  return accountCode === ACCOUNT_CODES.ACCUMULATED_DEPRECIATION;
}

// ============================================================================
// Journal Entry Number Generation
// ============================================================================

/**
 * Generate unique journal entry number
 * Format: JE-YYYYMMDD-HHMMSS-XXX
 *
 * Note: For production, consider using a more robust ID generation
 * strategy like UUID or Firestore auto-ID for true uniqueness.
 */
export function generateJournalEntryNumber(date: Date = new Date()): string {
  const datePart = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = date.toTimeString().slice(0, 8).replace(/:/g, '');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `JE-${datePart}-${timePart}-${random}`;
}

// ============================================================================
// Balance Calculations
// ============================================================================

/**
 * Calculate adjusted balance considering contra-assets
 */
export function calculateAdjustedBalance(
  balance: number,
  accountCode: string
): number {
  return isContraAsset(accountCode) ? -balance : balance;
}

/**
 * Sum balances for a list of accounts
 */
export function sumAccountBalances(
  accounts: Array<{ balance: number }>
): number {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

/**
 * Check if a balance sheet is balanced (Assets = Liabilities + Equity)
 * Uses tolerance for floating point comparison
 */
export function isBalanceSheetBalanced(
  totalAssets: number,
  totalLiabilitiesAndEquity: number,
  tolerance: number = ACCOUNTING_TOLERANCE
): boolean {
  return Math.abs(totalAssets - totalLiabilitiesAndEquity) < tolerance;
}

/**
 * Check if trial balance is balanced (Debits = Credits)
 */
export function isTrialBalanceBalanced(
  totalDebits: number,
  totalCredits: number,
  tolerance: number = ACCOUNTING_TOLERANCE
): boolean {
  return Math.abs(totalDebits - totalCredits) < tolerance;
}
