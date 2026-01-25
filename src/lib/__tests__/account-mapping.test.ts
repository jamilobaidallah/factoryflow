/**
 * Unit Tests for Account Mapping Utilities
 */

import {
  getAccountMappingForAdvancePayment,
  getAccountMappingForPayment,
  isAdvanceCategory,
} from '../account-mapping';
import { ACCOUNT_CODES } from '@/types/accounting';

describe('getAccountMappingForAdvancePayment', () => {
  describe('Supplier Advance Payment (refund received)', () => {
    it('should return DR Cash, CR Supplier Advances for supplier advance', () => {
      const mapping = getAccountMappingForAdvancePayment('سلفة مورد');

      expect(mapping.debitAccount).toBe(ACCOUNT_CODES.CASH);
      expect(mapping.creditAccount).toBe(ACCOUNT_CODES.SUPPLIER_ADVANCES);
    });

    it('should have correct Arabic account names for supplier advance', () => {
      const mapping = getAccountMappingForAdvancePayment('سلفة مورد');

      expect(mapping.debitAccountNameAr).toBe('النقدية');
      expect(mapping.creditAccountNameAr).toBe('سلفات موردين');
    });
  });

  describe('Customer Advance Payment (refund paid)', () => {
    it('should return DR Customer Advances, CR Cash for customer advance', () => {
      const mapping = getAccountMappingForAdvancePayment('سلفة عميل');

      expect(mapping.debitAccount).toBe(ACCOUNT_CODES.CUSTOMER_ADVANCES);
      expect(mapping.creditAccount).toBe(ACCOUNT_CODES.CASH);
    });

    it('should have correct Arabic account names for customer advance', () => {
      const mapping = getAccountMappingForAdvancePayment('سلفة عميل');

      expect(mapping.debitAccountNameAr).toBe('سلفات عملاء');
      expect(mapping.creditAccountNameAr).toBe('النقدية');
    });
  });
});

describe('getAccountMappingForPayment', () => {
  it('should return DR Cash, CR AR for receipt (قبض)', () => {
    const mapping = getAccountMappingForPayment('قبض');

    expect(mapping.debitAccount).toBe(ACCOUNT_CODES.CASH);
    expect(mapping.creditAccount).toBe(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE);
  });

  it('should return DR AP, CR Cash for disbursement (صرف)', () => {
    const mapping = getAccountMappingForPayment('صرف');

    expect(mapping.debitAccount).toBe(ACCOUNT_CODES.ACCOUNTS_PAYABLE);
    expect(mapping.creditAccount).toBe(ACCOUNT_CODES.CASH);
  });
});

describe('isAdvanceCategory', () => {
  it('should return true for supplier advance category', () => {
    expect(isAdvanceCategory('سلفة مورد')).toBe(true);
  });

  it('should return true for customer advance category', () => {
    expect(isAdvanceCategory('سلفة عميل')).toBe(true);
  });

  it('should return false for regular income category', () => {
    expect(isAdvanceCategory('إيرادات المبيعات')).toBe(false);
  });

  it('should return false for regular expense category', () => {
    expect(isAdvanceCategory('مصاريف تشغيلية')).toBe(false);
  });
});

describe('Advance Payment vs Regular Payment Comparison', () => {
  it('should use different credit accounts for supplier advance vs regular receipt', () => {
    const advanceMapping = getAccountMappingForAdvancePayment('سلفة مورد');
    const regularMapping = getAccountMappingForPayment('قبض');

    // Both debit Cash
    expect(advanceMapping.debitAccount).toBe(ACCOUNT_CODES.CASH);
    expect(regularMapping.debitAccount).toBe(ACCOUNT_CODES.CASH);

    // But credit different accounts
    expect(advanceMapping.creditAccount).toBe(ACCOUNT_CODES.SUPPLIER_ADVANCES); // 1350
    expect(regularMapping.creditAccount).toBe(ACCOUNT_CODES.ACCOUNTS_RECEIVABLE); // 1200
  });

  it('should use different debit accounts for customer advance vs regular disbursement', () => {
    const advanceMapping = getAccountMappingForAdvancePayment('سلفة عميل');
    const regularMapping = getAccountMappingForPayment('صرف');

    // Both credit Cash
    expect(advanceMapping.creditAccount).toBe(ACCOUNT_CODES.CASH);
    expect(regularMapping.creditAccount).toBe(ACCOUNT_CODES.CASH);

    // But debit different accounts
    expect(advanceMapping.debitAccount).toBe(ACCOUNT_CODES.CUSTOMER_ADVANCES); // 2150
    expect(regularMapping.debitAccount).toBe(ACCOUNT_CODES.ACCOUNTS_PAYABLE); // 2000
  });
});
