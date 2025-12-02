/**
 * Unit Tests for Journal Service
 */

import {
  Firestore,
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { JournalLine, ACCOUNT_CODES, validateJournalEntry } from '@/types/accounting';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  runTransaction: jest.fn(),
  writeBatch: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
  },
}));

// Mock firebase config
jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

// Mock dependencies
jest.mock('@/lib/chart-of-accounts', () => ({
  getDefaultAccountsForSeeding: jest.fn(() => [
    {
      code: '1000',
      name: 'Cash',
      nameAr: 'النقدية',
      type: 'asset',
      normalBalance: 'debit',
      isActive: true,
      createdAt: new Date(),
    },
    {
      code: '4000',
      name: 'Revenue',
      nameAr: 'الإيرادات',
      type: 'revenue',
      normalBalance: 'credit',
      isActive: true,
      createdAt: new Date(),
    },
  ]),
}));

jest.mock('@/lib/account-mapping', () => ({
  getAccountMappingForLedgerEntry: jest.fn(() => ({
    debitAccount: '1200',
    creditAccount: '4000',
    debitAccountNameAr: 'ذمم مدينة',
    creditAccountNameAr: 'إيرادات المبيعات',
  })),
  getAccountMappingForPayment: jest.fn((type: string) => ({
    debitAccount: type === 'قبض' ? '1000' : '2000',
    creditAccount: type === 'قبض' ? '1200' : '1000',
    debitAccountNameAr: type === 'قبض' ? 'النقدية' : 'ذمم دائنة',
    creditAccountNameAr: type === 'قبض' ? 'ذمم مدينة' : 'النقدية',
  })),
  getAccountMappingForCOGS: jest.fn(() => ({
    debitAccount: '5000',
    creditAccount: '1300',
    debitAccountNameAr: 'تكلفة البضاعة المباعة',
    creditAccountNameAr: 'المخزون',
  })),
  getAccountMappingForDepreciation: jest.fn(() => ({
    debitAccount: '5400',
    creditAccount: '1510',
    debitAccountNameAr: 'مصاريف الإهلاك',
    creditAccountNameAr: 'مجمع الإهلاك',
  })),
  getAccountNameAr: jest.fn((code: string) => {
    const names: Record<string, string> = {
      '1000': 'النقدية',
      '1200': 'ذمم مدينة',
      '1300': 'المخزون',
      '2000': 'ذمم دائنة',
      '4000': 'إيرادات المبيعات',
      '5000': 'تكلفة البضاعة المباعة',
    };
    return names[code] || 'حساب';
  }),
}));

jest.mock('@/lib/currency', () => ({
  roundCurrency: jest.fn((n: number) => Math.round(n * 100) / 100),
  safeAdd: jest.fn((a: number, b: number) => a + b),
  safeSubtract: jest.fn((a: number, b: number) => a - b),
}));

jest.mock('@/lib/firestore-utils', () => ({
  convertFirestoreDates: jest.fn((data: unknown) => data),
}));

const mockCollection = collection as jest.Mock;
const mockDoc = doc as jest.Mock;
const mockAddDoc = addDoc as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockQuery = query as jest.Mock;
const mockOrderBy = orderBy as jest.Mock;
const mockWriteBatch = writeBatch as jest.Mock;

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
});
