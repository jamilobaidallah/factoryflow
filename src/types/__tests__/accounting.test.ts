/**
 * Unit Tests for Accounting Types and Helper Functions
 */

import {
  getNormalBalance,
  calculateAccountBalance,
  validateJournalEntry,
  ACCOUNT_CODES,
  ACCOUNT_CODE_RANGES,
  AccountType,
  JournalLine,
} from '../accounting';

describe('Accounting Types', () => {
  describe('getNormalBalance', () => {
    it('should return "debit" for asset accounts', () => {
      expect(getNormalBalance('asset')).toBe('debit');
    });

    it('should return "debit" for expense accounts', () => {
      expect(getNormalBalance('expense')).toBe('debit');
    });

    it('should return "credit" for liability accounts', () => {
      expect(getNormalBalance('liability')).toBe('credit');
    });

    it('should return "credit" for equity accounts', () => {
      expect(getNormalBalance('equity')).toBe('credit');
    });

    it('should return "credit" for revenue accounts', () => {
      expect(getNormalBalance('revenue')).toBe('credit');
    });

    it('should handle all account types', () => {
      const accountTypes: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];
      accountTypes.forEach((type) => {
        const result = getNormalBalance(type);
        expect(['debit', 'credit']).toContain(result);
      });
    });
  });

  describe('calculateAccountBalance', () => {
    describe('debit-normal accounts (assets, expenses)', () => {
      it('should calculate positive balance when debits exceed credits', () => {
        const balance = calculateAccountBalance(1000, 300, 'debit');
        expect(balance).toBe(700);
      });

      it('should calculate negative balance when credits exceed debits', () => {
        const balance = calculateAccountBalance(300, 1000, 'debit');
        expect(balance).toBe(-700);
      });

      it('should return zero when debits equal credits', () => {
        const balance = calculateAccountBalance(500, 500, 'debit');
        expect(balance).toBe(0);
      });

      it('should handle zero values', () => {
        expect(calculateAccountBalance(0, 0, 'debit')).toBe(0);
        expect(calculateAccountBalance(100, 0, 'debit')).toBe(100);
        expect(calculateAccountBalance(0, 100, 'debit')).toBe(-100);
      });
    });

    describe('credit-normal accounts (liabilities, equity, revenue)', () => {
      it('should calculate positive balance when credits exceed debits', () => {
        const balance = calculateAccountBalance(300, 1000, 'credit');
        expect(balance).toBe(700);
      });

      it('should calculate negative balance when debits exceed credits', () => {
        const balance = calculateAccountBalance(1000, 300, 'credit');
        expect(balance).toBe(-700);
      });

      it('should return zero when credits equal debits', () => {
        const balance = calculateAccountBalance(500, 500, 'credit');
        expect(balance).toBe(0);
      });

      it('should handle zero values', () => {
        expect(calculateAccountBalance(0, 0, 'credit')).toBe(0);
        expect(calculateAccountBalance(100, 0, 'credit')).toBe(-100);
        expect(calculateAccountBalance(0, 100, 'credit')).toBe(100);
      });
    });

    describe('decimal handling', () => {
      it('should handle decimal amounts correctly', () => {
        const balance = calculateAccountBalance(1000.50, 500.25, 'debit');
        expect(balance).toBe(500.25);
      });

      it('should handle small decimal differences', () => {
        const balance = calculateAccountBalance(0.1 + 0.2, 0.3, 'debit');
        expect(Math.abs(balance)).toBeLessThan(0.0001);
      });
    });
  });

  describe('validateJournalEntry', () => {
    it('should validate balanced journal entry', () => {
      const lines: JournalLine[] = [
        { accountCode: '1000', accountName: 'Cash', accountNameAr: 'النقدية', debit: 1000, credit: 0 },
        { accountCode: '4000', accountName: 'Revenue', accountNameAr: 'الإيرادات', debit: 0, credit: 1000 },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
      expect(result.difference).toBe(0);
    });

    it('should invalidate unbalanced journal entry', () => {
      const lines: JournalLine[] = [
        { accountCode: '1000', accountName: 'Cash', accountNameAr: 'النقدية', debit: 1000, credit: 0 },
        { accountCode: '4000', accountName: 'Revenue', accountNameAr: 'الإيرادات', debit: 0, credit: 500 },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(false);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(500);
      expect(result.difference).toBe(500);
    });

    it('should handle multiple lines with same totals', () => {
      const lines: JournalLine[] = [
        { accountCode: '1000', accountName: 'Cash', accountNameAr: 'النقدية', debit: 500, credit: 0 },
        { accountCode: '1100', accountName: 'Bank', accountNameAr: 'البنك', debit: 500, credit: 0 },
        { accountCode: '4000', accountName: 'Revenue', accountNameAr: 'الإيرادات', debit: 0, credit: 1000 },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
    });

    it('should handle empty lines array', () => {
      const result = validateJournalEntry([]);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(0);
      expect(result.totalCredits).toBe(0);
      expect(result.difference).toBe(0);
    });

    it('should handle very small floating point differences', () => {
      const lines: JournalLine[] = [
        { accountCode: '1000', accountName: 'Cash', accountNameAr: 'النقدية', debit: 0.1 + 0.2, credit: 0 },
        { accountCode: '4000', accountName: 'Revenue', accountNameAr: 'الإيرادات', debit: 0, credit: 0.3 },
      ];

      const result = validateJournalEntry(lines);
      // Should be valid due to tolerance
      expect(result.isValid).toBe(true);
    });

    it('should handle compound journal entry', () => {
      // Expense with AP and immediate partial payment
      const lines: JournalLine[] = [
        { accountCode: '5100', accountName: 'Salaries', accountNameAr: 'الرواتب', debit: 5000, credit: 0 },
        { accountCode: '2000', accountName: 'AP', accountNameAr: 'ذمم دائنة', debit: 0, credit: 3000 },
        { accountCode: '1000', accountName: 'Cash', accountNameAr: 'النقدية', debit: 0, credit: 2000 },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(5000);
      expect(result.totalCredits).toBe(5000);
    });

    it('should detect imbalance in complex entry', () => {
      const lines: JournalLine[] = [
        { accountCode: '1000', accountName: 'Cash', accountNameAr: 'النقدية', debit: 100, credit: 0 },
        { accountCode: '1100', accountName: 'Bank', accountNameAr: 'البنك', debit: 200, credit: 0 },
        { accountCode: '4000', accountName: 'Revenue', accountNameAr: 'الإيرادات', debit: 0, credit: 150 },
        { accountCode: '4100', accountName: 'Service', accountNameAr: 'خدمات', debit: 0, credit: 100 },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(false);
      expect(result.totalDebits).toBe(300);
      expect(result.totalCredits).toBe(250);
      expect(result.difference).toBe(50);
    });
  });

  describe('ACCOUNT_CODES constants', () => {
    it('should have all asset accounts in correct range', () => {
      const assetCodes = [
        ACCOUNT_CODES.CASH,
        ACCOUNT_CODES.BANK,
        ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
        ACCOUNT_CODES.INVENTORY,
        ACCOUNT_CODES.PREPAID_EXPENSES,
        ACCOUNT_CODES.FIXED_ASSETS,
        ACCOUNT_CODES.ACCUMULATED_DEPRECIATION,
      ];

      assetCodes.forEach((code) => {
        const num = parseInt(code);
        expect(num).toBeGreaterThanOrEqual(ACCOUNT_CODE_RANGES.asset.min);
        expect(num).toBeLessThanOrEqual(ACCOUNT_CODE_RANGES.asset.max);
      });
    });

    it('should have all liability accounts in correct range', () => {
      const liabilityCodes = [
        ACCOUNT_CODES.ACCOUNTS_PAYABLE,
        ACCOUNT_CODES.ACCRUED_EXPENSES,
        ACCOUNT_CODES.NOTES_PAYABLE,
      ];

      liabilityCodes.forEach((code) => {
        const num = parseInt(code);
        expect(num).toBeGreaterThanOrEqual(ACCOUNT_CODE_RANGES.liability.min);
        expect(num).toBeLessThanOrEqual(ACCOUNT_CODE_RANGES.liability.max);
      });
    });

    it('should have all equity accounts in correct range', () => {
      const equityCodes = [
        ACCOUNT_CODES.OWNER_CAPITAL,
        ACCOUNT_CODES.OWNER_DRAWINGS,
        ACCOUNT_CODES.RETAINED_EARNINGS,
      ];

      equityCodes.forEach((code) => {
        const num = parseInt(code);
        expect(num).toBeGreaterThanOrEqual(ACCOUNT_CODE_RANGES.equity.min);
        expect(num).toBeLessThanOrEqual(ACCOUNT_CODE_RANGES.equity.max);
      });
    });

    it('should have all revenue accounts in correct range', () => {
      const revenueCodes = [
        ACCOUNT_CODES.SALES_REVENUE,
        ACCOUNT_CODES.SERVICE_REVENUE,
        ACCOUNT_CODES.OTHER_INCOME,
      ];

      revenueCodes.forEach((code) => {
        const num = parseInt(code);
        expect(num).toBeGreaterThanOrEqual(ACCOUNT_CODE_RANGES.revenue.min);
        expect(num).toBeLessThanOrEqual(ACCOUNT_CODE_RANGES.revenue.max);
      });
    });

    it('should have all expense accounts in correct range', () => {
      const expenseCodes = [
        ACCOUNT_CODES.COST_OF_GOODS_SOLD,
        ACCOUNT_CODES.SALARIES_EXPENSE,
        ACCOUNT_CODES.RENT_EXPENSE,
        ACCOUNT_CODES.UTILITIES_EXPENSE,
        ACCOUNT_CODES.DEPRECIATION_EXPENSE,
        ACCOUNT_CODES.OTHER_EXPENSES,
      ];

      expenseCodes.forEach((code) => {
        const num = parseInt(code);
        expect(num).toBeGreaterThanOrEqual(ACCOUNT_CODE_RANGES.expense.min);
        expect(num).toBeLessThanOrEqual(ACCOUNT_CODE_RANGES.expense.max);
      });
    });

    it('should have unique account codes', () => {
      const codes = Object.values(ACCOUNT_CODES);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('ACCOUNT_CODE_RANGES', () => {
    it('should have non-overlapping ranges', () => {
      const ranges = Object.values(ACCOUNT_CODE_RANGES);
      for (let i = 0; i < ranges.length; i++) {
        for (let j = i + 1; j < ranges.length; j++) {
          const range1 = ranges[i];
          const range2 = ranges[j];
          // Check no overlap
          const overlap = range1.min <= range2.max && range2.min <= range1.max;
          expect(overlap).toBe(false);
        }
      }
    });

    it('should have each range span exactly 1000', () => {
      Object.values(ACCOUNT_CODE_RANGES).forEach((range) => {
        expect(range.max - range.min).toBe(999);
      });
    });
  });
});
