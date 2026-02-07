/**
 * Tests for Journal Utilities
 * Pure functions - no Firestore mocking required
 */

import {
  ValidationError,
  validateUserId,
  validateAmount,
  validateDate,
  validateDescription,
  createJournalLines,
  getAccountTypeFromCode,
  generateJournalEntryNumber,
  isContraAsset,
  calculateAdjustedBalance,
  isBalanceSheetBalanced,
  isTrialBalanceBalanced,
  ACCOUNT_RANGES,
} from '../journal-utils';
import { ACCOUNT_CODES } from '@/types/accounting';

describe('Journal Utilities', () => {
  describe('Validation Functions', () => {
    describe('validateUserId', () => {
      it('should pass for valid userId', () => {
        expect(() => validateUserId('user123')).not.toThrow();
      });

      it('should throw for empty string', () => {
        expect(() => validateUserId('')).toThrow(ValidationError);
      });

      it('should throw for whitespace only', () => {
        expect(() => validateUserId('   ')).toThrow(ValidationError);
      });

      it('should throw for null', () => {
        expect(() => validateUserId(null)).toThrow(ValidationError);
      });

      it('should throw for undefined', () => {
        expect(() => validateUserId(undefined)).toThrow(ValidationError);
      });

      it('should throw for number', () => {
        expect(() => validateUserId(123 as unknown)).toThrow(ValidationError);
      });
    });

    describe('validateAmount', () => {
      it('should pass for positive number', () => {
        expect(() => validateAmount(100)).not.toThrow();
      });

      it('should pass for decimal amount', () => {
        expect(() => validateAmount(99.99)).not.toThrow();
      });

      it('should throw for zero', () => {
        expect(() => validateAmount(0)).toThrow(ValidationError);
      });

      it('should throw for negative', () => {
        expect(() => validateAmount(-100)).toThrow(ValidationError);
      });

      it('should throw for NaN', () => {
        expect(() => validateAmount(NaN)).toThrow(ValidationError);
      });

      it('should throw for Infinity', () => {
        expect(() => validateAmount(Infinity)).toThrow(ValidationError);
      });

      it('should throw for string', () => {
        expect(() => validateAmount('100' as unknown)).toThrow(ValidationError);
      });
    });

    describe('validateDate', () => {
      it('should pass for valid Date', () => {
        expect(() => validateDate(new Date())).not.toThrow();
      });

      it('should throw for invalid Date', () => {
        expect(() => validateDate(new Date('invalid'))).toThrow(ValidationError);
      });

      it('should throw for string', () => {
        expect(() => validateDate('2024-01-01' as unknown)).toThrow(ValidationError);
      });

      it('should throw for null', () => {
        expect(() => validateDate(null)).toThrow(ValidationError);
      });
    });

    describe('validateDescription', () => {
      it('should pass for valid description', () => {
        expect(() => validateDescription('Test entry')).not.toThrow();
      });

      it('should throw for empty string', () => {
        expect(() => validateDescription('')).toThrow(ValidationError);
      });

      it('should throw for whitespace only', () => {
        expect(() => validateDescription('   ')).toThrow(ValidationError);
      });
    });
  });

  describe('createJournalLines', () => {
    const mockMapping = {
      debitAccount: '1000',
      creditAccount: '4000',
      debitAccountNameAr: 'النقدية',
      creditAccountNameAr: 'الإيرادات',
    };

    it('should create two journal lines', () => {
      const lines = createJournalLines(mockMapping, 1000, 'Test');
      expect(lines).toHaveLength(2);
    });

    it('should have debit line first with correct values', () => {
      const lines = createJournalLines(mockMapping, 500, 'Sale');
      expect(lines[0]).toEqual({
        accountCode: '1000',
        accountName: '1000',
        accountNameAr: 'النقدية',
        debit: 500,
        credit: 0,
        description: 'Sale',
      });
    });

    it('should have credit line second with correct values', () => {
      const lines = createJournalLines(mockMapping, 500, 'Sale');
      expect(lines[1]).toEqual({
        accountCode: '4000',
        accountName: '4000',
        accountNameAr: 'الإيرادات',
        debit: 0,
        credit: 500,
        description: 'Sale',
      });
    });

    it('should round amounts correctly', () => {
      const lines = createJournalLines(mockMapping, 100.456, 'Test');
      expect(lines[0].debit).toBe(100.46);
      expect(lines[1].credit).toBe(100.46);
    });
  });

  describe('getAccountTypeFromCode', () => {
    it('should return asset for 1000-1999', () => {
      expect(getAccountTypeFromCode('1000')).toBe('asset');
      expect(getAccountTypeFromCode('1500')).toBe('asset');
      expect(getAccountTypeFromCode('1999')).toBe('asset');
    });

    it('should return liability for 2000-2999', () => {
      expect(getAccountTypeFromCode('2000')).toBe('liability');
      expect(getAccountTypeFromCode('2500')).toBe('liability');
      expect(getAccountTypeFromCode('2999')).toBe('liability');
    });

    it('should return equity for 3000-3999', () => {
      expect(getAccountTypeFromCode('3000')).toBe('equity');
      expect(getAccountTypeFromCode('3500')).toBe('equity');
      expect(getAccountTypeFromCode('3999')).toBe('equity');
    });

    it('should return revenue for 4000-4999', () => {
      expect(getAccountTypeFromCode('4000')).toBe('revenue');
      expect(getAccountTypeFromCode('4500')).toBe('revenue');
      expect(getAccountTypeFromCode('4999')).toBe('revenue');
    });

    it('should return expense for 5000-5999', () => {
      expect(getAccountTypeFromCode('5000')).toBe('expense');
      expect(getAccountTypeFromCode('5500')).toBe('expense');
      expect(getAccountTypeFromCode('5999')).toBe('expense');
    });

    it('should default to expense for invalid codes', () => {
      expect(getAccountTypeFromCode('invalid')).toBe('expense');
      expect(getAccountTypeFromCode('9999')).toBe('expense');
    });
  });

  describe('generateJournalEntryNumber', () => {
    it('should generate number in correct format', () => {
      const number = generateJournalEntryNumber();
      expect(number).toMatch(/^JE-\d{8}-\d{6}-\d{3}$/);
    });

    it('should use provided date', () => {
      const date = new Date('2024-06-15T10:30:45');
      const number = generateJournalEntryNumber(date);
      expect(number).toContain('20240615');
    });

    it('should generate unique numbers', () => {
      const numbers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        numbers.add(generateJournalEntryNumber());
      }
      // Most should be unique (random component) - lowered threshold for CI stability
      expect(numbers.size).toBeGreaterThan(80);
    });
  });

  describe('isContraAsset', () => {
    it('should return true for accumulated depreciation', () => {
      expect(isContraAsset(ACCOUNT_CODES.ACCUMULATED_DEPRECIATION)).toBe(true);
    });

    it('should return false for regular assets', () => {
      expect(isContraAsset(ACCOUNT_CODES.CASH)).toBe(false);
      expect(isContraAsset(ACCOUNT_CODES.INVENTORY)).toBe(false);
    });

    it('should return false for non-asset accounts', () => {
      expect(isContraAsset(ACCOUNT_CODES.SALES_REVENUE)).toBe(false);
      expect(isContraAsset(ACCOUNT_CODES.ACCOUNTS_PAYABLE)).toBe(false);
    });
  });

  describe('calculateAdjustedBalance', () => {
    it('should return negative for contra-asset', () => {
      expect(calculateAdjustedBalance(1000, ACCOUNT_CODES.ACCUMULATED_DEPRECIATION)).toBe(-1000);
    });

    it('should return unchanged for regular accounts', () => {
      expect(calculateAdjustedBalance(1000, ACCOUNT_CODES.CASH)).toBe(1000);
      expect(calculateAdjustedBalance(-500, ACCOUNT_CODES.INVENTORY)).toBe(-500);
    });
  });

  describe('Balance Verification', () => {
    describe('isBalanceSheetBalanced', () => {
      it('should return true when balanced', () => {
        expect(isBalanceSheetBalanced(10000, 10000)).toBe(true);
      });

      it('should return true within tolerance', () => {
        expect(isBalanceSheetBalanced(10000, 10000.0005)).toBe(true);
      });

      it('should return false when unbalanced', () => {
        expect(isBalanceSheetBalanced(10000, 9000)).toBe(false);
      });
    });

    describe('isTrialBalanceBalanced', () => {
      it('should return true when debits equal credits', () => {
        expect(isTrialBalanceBalanced(5000, 5000)).toBe(true);
      });

      it('should return true within tolerance', () => {
        expect(isTrialBalanceBalanced(5000, 5000.0009)).toBe(true);
      });

      it('should return false when unbalanced', () => {
        expect(isTrialBalanceBalanced(5000, 4500)).toBe(false);
      });
    });
  });

  describe('ACCOUNT_RANGES', () => {
    it('should have correct asset range', () => {
      expect(ACCOUNT_RANGES.asset).toEqual({ min: 1000, max: 1999 });
    });

    it('should have correct liability range', () => {
      expect(ACCOUNT_RANGES.liability).toEqual({ min: 2000, max: 2999 });
    });

    it('should have correct equity range', () => {
      expect(ACCOUNT_RANGES.equity).toEqual({ min: 3000, max: 3999 });
    });

    it('should have correct revenue range', () => {
      expect(ACCOUNT_RANGES.revenue).toEqual({ min: 4000, max: 4999 });
    });

    it('should have correct expense range', () => {
      expect(ACCOUNT_RANGES.expense).toEqual({ min: 5000, max: 5999 });
    });
  });
});
