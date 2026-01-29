/**
 * Unit Tests for Journal Service
 *
 * Tests for journal entry validation, account codes, and business scenarios.
 * Journal creation/deletion functions have been moved to JournalPostingEngine.
 */

import { JournalLine, ACCOUNT_CODES, validateJournalEntry } from '@/types/accounting';

describe('Journal Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Journal Entry Validation', () => {
    it('should validate balanced journal entry for income', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          accountName: 'Accounts Receivable',
          accountNameAr: 'ذمم مدينة',
          debit: 1000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 1000,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
      expect(result.difference).toBe(0);
    });

    it('should validate balanced journal entry for expense', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.SALARIES_EXPENSE,
          accountName: 'Salaries Expense',
          accountNameAr: 'مصاريف الرواتب',
          debit: 5000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
          accountName: 'Accounts Payable',
          accountNameAr: 'ذمم دائنة',
          debit: 0,
          credit: 5000,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });

    it('should validate balanced journal entry for payment receipt', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 500,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          accountName: 'Accounts Receivable',
          accountNameAr: 'ذمم مدينة',
          debit: 0,
          credit: 500,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });

    it('should validate balanced journal entry for payment disbursement', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
          accountName: 'Accounts Payable',
          accountNameAr: 'ذمم دائنة',
          debit: 300,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 0,
          credit: 300,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });

    it('should validate balanced journal entry for COGS', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
          accountName: 'Cost of Goods Sold',
          accountNameAr: 'تكلفة البضاعة المباعة',
          debit: 750,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.INVENTORY,
          accountName: 'Inventory',
          accountNameAr: 'المخزون',
          debit: 0,
          credit: 750,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });

    it('should validate balanced journal entry for depreciation', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.DEPRECIATION_EXPENSE,
          accountName: 'Depreciation Expense',
          accountNameAr: 'مصاريف الإهلاك',
          debit: 200,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCUMULATED_DEPRECIATION,
          accountName: 'Accumulated Depreciation',
          accountNameAr: 'مجمع الإهلاك',
          debit: 0,
          credit: 200,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });

    it('should reject unbalanced journal entry', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 1000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 900,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(false);
      expect(result.difference).toBe(100);
    });

    it('should handle multiple debit and credit lines', () => {
      // Sale with multiple payment methods
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 500,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.BANK,
          accountName: 'Bank',
          accountNameAr: 'البنك',
          debit: 300,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          accountName: 'Accounts Receivable',
          accountNameAr: 'ذمم مدينة',
          debit: 200,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 1000,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(1000);
      expect(result.totalCredits).toBe(1000);
    });
  });

  describe('Account Code Constants', () => {
    it('should have all required asset account codes', () => {
      expect(ACCOUNT_CODES.CASH).toBe('1000');
      expect(ACCOUNT_CODES.BANK).toBe('1100');
      expect(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE).toBe('1200');
      expect(ACCOUNT_CODES.INVENTORY).toBe('1300');
      expect(ACCOUNT_CODES.PREPAID_EXPENSES).toBe('1400');
      expect(ACCOUNT_CODES.FIXED_ASSETS).toBe('1500');
      expect(ACCOUNT_CODES.ACCUMULATED_DEPRECIATION).toBe('1510');
    });

    it('should have all required liability account codes', () => {
      expect(ACCOUNT_CODES.ACCOUNTS_PAYABLE).toBe('2000');
      expect(ACCOUNT_CODES.ACCRUED_EXPENSES).toBe('2100');
      expect(ACCOUNT_CODES.NOTES_PAYABLE).toBe('2200');
    });

    it('should have all required equity account codes', () => {
      expect(ACCOUNT_CODES.OWNER_CAPITAL).toBe('3000');
      expect(ACCOUNT_CODES.OWNER_DRAWINGS).toBe('3100');
      expect(ACCOUNT_CODES.RETAINED_EARNINGS).toBe('3200');
    });

    it('should have all required revenue account codes', () => {
      expect(ACCOUNT_CODES.SALES_REVENUE).toBe('4000');
      expect(ACCOUNT_CODES.SERVICE_REVENUE).toBe('4100');
      expect(ACCOUNT_CODES.OTHER_INCOME).toBe('4200');
    });

    it('should have all required expense account codes', () => {
      expect(ACCOUNT_CODES.COST_OF_GOODS_SOLD).toBe('5000');
      expect(ACCOUNT_CODES.SALARIES_EXPENSE).toBe('5100');
      expect(ACCOUNT_CODES.RENT_EXPENSE).toBe('5200');
      expect(ACCOUNT_CODES.UTILITIES_EXPENSE).toBe('5300');
      expect(ACCOUNT_CODES.DEPRECIATION_EXPENSE).toBe('5400');
      expect(ACCOUNT_CODES.OTHER_EXPENSES).toBe('5500');
    });
  });

  describe('Account Mapping Integration', () => {
    it('should create correct entry for income with ARAP tracking', () => {
      // Income entry: DR Accounts Receivable, CR Revenue
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          accountName: 'Accounts Receivable',
          accountNameAr: 'ذمم مدينة',
          debit: 1500,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 1500,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      // AR increased (asset normal balance is debit)
      // Revenue increased (revenue normal balance is credit)
    });

    it('should create correct entry for expense with ARAP tracking', () => {
      // Expense entry: DR Expense, CR Accounts Payable
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.RENT_EXPENSE,
          accountName: 'Rent Expense',
          accountNameAr: 'مصاريف الإيجار',
          debit: 2000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
          accountName: 'Accounts Payable',
          accountNameAr: 'ذمم دائنة',
          debit: 0,
          credit: 2000,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      // Expense increased (expense normal balance is debit)
      // AP increased (liability normal balance is credit)
    });

    it('should create correct entry for income with immediate settlement', () => {
      // Cash sale: DR Cash, CR Revenue
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 800,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 800,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });

    it('should create correct entry for expense with immediate settlement', () => {
      // Cash expense: DR Expense, CR Cash
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.UTILITIES_EXPENSE,
          accountName: 'Utilities Expense',
          accountNameAr: 'مصاريف المرافق',
          debit: 150,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 0,
          credit: 150,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Decimal Precision', () => {
    it('should handle exact decimal amounts', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 123.45,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 123.45,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(123.45);
      expect(result.totalCredits).toBe(123.45);
    });

    it('should handle floating point precision issues', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JavaScript
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 0.1 + 0.2,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 0.3,
        },
      ];

      const result = validateJournalEntry(lines);
      // Should be valid due to tolerance of 0.001
      expect(result.isValid).toBe(true);
    });

    it('should reject amounts with significant difference', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 100.00,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 99.99,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(false);
      expect(result.difference).toBeCloseTo(0.01);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero amounts', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 0,
          credit: 0,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
      expect(result.totalDebits).toBe(0);
      expect(result.totalCredits).toBe(0);
    });

    it('should handle very large amounts', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 1000000000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 1000000000,
        },
      ];

      const result = validateJournalEntry(lines);
      expect(result.isValid).toBe(true);
    });

    it('should handle lines with both debit and credit (invalid but handle gracefully)', () => {
      const lines: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 100,
          credit: 50,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Sales Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 50,
        },
      ];

      const result = validateJournalEntry(lines);
      // Totals: debits=100, credits=100 (50+50)
      expect(result.isValid).toBe(true);
    });
  });

  describe('Business Scenario Tests', () => {
    it('should validate complete sales cycle journal entries', () => {
      // 1. Sale on credit: DR AR, CR Revenue
      const saleEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          accountName: 'AR',
          accountNameAr: 'ذمم مدينة',
          debit: 5000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.SALES_REVENUE,
          accountName: 'Revenue',
          accountNameAr: 'إيرادات المبيعات',
          debit: 0,
          credit: 5000,
        },
      ];

      // 2. COGS: DR COGS, CR Inventory
      const cogsEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.COST_OF_GOODS_SOLD,
          accountName: 'COGS',
          accountNameAr: 'تكلفة البضاعة المباعة',
          debit: 3000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.INVENTORY,
          accountName: 'Inventory',
          accountNameAr: 'المخزون',
          debit: 0,
          credit: 3000,
        },
      ];

      // 3. Payment received: DR Cash, CR AR
      const paymentEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 5000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          accountName: 'AR',
          accountNameAr: 'ذمم مدينة',
          debit: 0,
          credit: 5000,
        },
      ];

      expect(validateJournalEntry(saleEntry).isValid).toBe(true);
      expect(validateJournalEntry(cogsEntry).isValid).toBe(true);
      expect(validateJournalEntry(paymentEntry).isValid).toBe(true);
    });

    it('should validate complete purchase cycle journal entries', () => {
      // 1. Purchase on credit: DR Expense/Inventory, CR AP
      const purchaseEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.INVENTORY,
          accountName: 'Inventory',
          accountNameAr: 'المخزون',
          debit: 8000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
          accountName: 'AP',
          accountNameAr: 'ذمم دائنة',
          debit: 0,
          credit: 8000,
        },
      ];

      // 2. Payment made: DR AP, CR Cash
      const paymentEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_PAYABLE,
          accountName: 'AP',
          accountNameAr: 'ذمم دائنة',
          debit: 8000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 0,
          credit: 8000,
        },
      ];

      expect(validateJournalEntry(purchaseEntry).isValid).toBe(true);
      expect(validateJournalEntry(paymentEntry).isValid).toBe(true);
    });

    it('should validate owner equity transactions', () => {
      // Owner capital contribution: DR Cash, CR Owner Capital
      const capitalEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 50000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.OWNER_CAPITAL,
          accountName: 'Owner Capital',
          accountNameAr: 'رأس المال',
          debit: 0,
          credit: 50000,
        },
      ];

      // Owner withdrawal: DR Drawings, CR Cash
      const withdrawalEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.OWNER_DRAWINGS,
          accountName: 'Owner Drawings',
          accountNameAr: 'سحوبات المالك',
          debit: 5000,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.CASH,
          accountName: 'Cash',
          accountNameAr: 'النقدية',
          debit: 0,
          credit: 5000,
        },
      ];

      expect(validateJournalEntry(capitalEntry).isValid).toBe(true);
      expect(validateJournalEntry(withdrawalEntry).isValid).toBe(true);
    });

    it('should validate bad debt writeoff', () => {
      // Bad debt: DR Bad Debt Expense, CR AR
      const badDebtEntry: JournalLine[] = [
        {
          accountCode: ACCOUNT_CODES.BAD_DEBT_EXPENSE,
          accountName: 'Bad Debt Expense',
          accountNameAr: 'مصروف ديون معدومة',
          debit: 2500,
          credit: 0,
        },
        {
          accountCode: ACCOUNT_CODES.ACCOUNTS_RECEIVABLE,
          accountName: 'AR',
          accountNameAr: 'ذمم مدينة',
          debit: 0,
          credit: 2500,
        },
      ];

      expect(validateJournalEntry(badDebtEntry).isValid).toBe(true);
    });
  });
});
