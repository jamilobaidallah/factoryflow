/**
 * Unit Tests for AR/AP Utilities
 */

import {
  calculatePaymentStatus,
  isValidTransactionId,
  formatCurrency,
  validatePaymentAmount,
  updateARAPOnPaymentAdd,
  reverseARAPOnPaymentDelete,
} from '../arap-utils';
import { PAYMENT_STATUSES } from '../definitions';
import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  runTransaction,
} from 'firebase/firestore';

// Mock transaction object
const mockTransactionGet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockTransaction = {
  get: mockTransactionGet,
  update: mockTransactionUpdate,
};

// Mock runTransaction to execute the callback with our mock transaction
const mockRunTransaction = jest.fn(
  async (_firestore: unknown, callback: (transaction: typeof mockTransaction) => Promise<unknown>) => {
    return callback(mockTransaction);
  }
);

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  doc: jest.fn(),
  runTransaction: (firestore: unknown, callback: (transaction: unknown) => Promise<unknown>) =>
    mockRunTransaction(firestore, callback),
}));

const mockCollection = collection as jest.Mock;
const mockQuery = query as jest.Mock;
const mockWhere = where as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;
const mockDoc = doc as jest.Mock;

// Mock Firestore instance
const mockFirestore = {} as Firestore;

describe('AR/AP Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTransactionGet.mockReset();
    mockTransactionUpdate.mockReset();
    mockRunTransaction.mockReset();
    // Restore default runTransaction behavior
    mockRunTransaction.mockImplementation(async (firestore, callback) => {
      return callback(mockTransaction);
    });
  });

  describe('calculatePaymentStatus', () => {
    it('should return "paid" when fully paid', () => {
      const status = calculatePaymentStatus(1000, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should return "paid" when overpaid', () => {
      const status = calculatePaymentStatus(1500, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should return "unpaid" when nothing paid', () => {
      const status = calculatePaymentStatus(0, 1000);
      expect(status).toBe(PAYMENT_STATUSES.UNPAID);
    });

    it('should return "partial" when partially paid', () => {
      const status = calculatePaymentStatus(500, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });

    it('should handle decimal amounts correctly', () => {
      const status = calculatePaymentStatus(499.99, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });

    it('should handle very small amounts', () => {
      const status = calculatePaymentStatus(0.01, 1000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });
  });

  describe('isValidTransactionId', () => {
    it('should validate correct transaction ID format', () => {
      expect(isValidTransactionId('TXN-20251122-123456-789')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidTransactionId('TXN-123')).toBe(false);
      expect(isValidTransactionId('INVALID')).toBe(false);
      expect(isValidTransactionId('TXN-2025-123456-789')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(isValidTransactionId('')).toBe(false);
      expect(isValidTransactionId('   ')).toBe(false);
    });

    it('should handle transaction IDs with whitespace', () => {
      expect(isValidTransactionId('  TXN-20251122-123456-789  ')).toBe(true);
    });

    it('should reject null or undefined', () => {
      expect(isValidTransactionId(null as any)).toBe(false);
      expect(isValidTransactionId(undefined as any)).toBe(false);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency with default symbol', () => {
      expect(formatCurrency(1000)).toBe('1000.00 دينار');
    });

    it('should format currency with custom symbol', () => {
      expect(formatCurrency(1000, 'USD')).toBe('1000.00 USD');
    });

    it('should handle decimal places correctly', () => {
      expect(formatCurrency(1234.56)).toBe('1234.56 دينار');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(1234.567)).toBe('1234.57 دينار');
    });

    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('0.00 دينار');
    });

    it('should handle negative numbers', () => {
      expect(formatCurrency(-500)).toBe('-500.00 دينار');
    });
  });

  describe('validatePaymentAmount', () => {
    it('should validate positive amounts', () => {
      const result = validatePaymentAmount(100);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject zero', () => {
      const result = validatePaymentAmount(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('المبلغ يجب أن يكون أكبر من صفر');
    });

    it('should reject negative amounts', () => {
      const result = validatePaymentAmount(-100);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('المبلغ يجب أن يكون أكبر من صفر');
    });

    it('should reject NaN', () => {
      const result = validatePaymentAmount(NaN);
      expect(result.isValid).toBe(false);
    });

    it('should reject amounts that are too large', () => {
      const result = validatePaymentAmount(1000000000);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('المبلغ كبير جداً');
    });

    it('should accept very small positive amounts', () => {
      const result = validatePaymentAmount(0.01);
      expect(result.isValid).toBe(true);
    });

    it('should accept decimal amounts', () => {
      const result = validatePaymentAmount(123.45);
      expect(result.isValid).toBe(true);
    });

    it('should accept amount at boundary', () => {
      const result = validatePaymentAmount(999999999);
      expect(result.isValid).toBe(true);
    });

    it('should reject amount just over boundary', () => {
      const result = validatePaymentAmount(1000000000);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe('المبلغ كبير جداً');
    });

    it('should handle Infinity', () => {
      const result = validatePaymentAmount(Infinity);
      expect(result.isValid).toBe(false);
    });
  });

  describe('calculatePaymentStatus - additional edge cases', () => {
    it('should handle negative transaction amounts', () => {
      const status = calculatePaymentStatus(100, -100);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle both amounts as zero', () => {
      const status = calculatePaymentStatus(0, 0);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle negative total paid', () => {
      const status = calculatePaymentStatus(-50, 1000);
      expect(status).toBe(PAYMENT_STATUSES.UNPAID);
    });

    it('should handle exact remaining of zero', () => {
      const status = calculatePaymentStatus(500.00, 500.00);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle floating point precision issues', () => {
      // 0.1 + 0.2 in JavaScript is 0.30000000000000004
      const status = calculatePaymentStatus(0.1 + 0.2, 0.3);
      expect(status).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle very large amounts', () => {
      const status = calculatePaymentStatus(500000000, 1000000000);
      expect(status).toBe(PAYMENT_STATUSES.PARTIAL);
    });
  });

  describe('formatCurrency - additional edge cases', () => {
    it('should handle very large numbers', () => {
      expect(formatCurrency(1000000000)).toBe('1000000000.00 دينار');
    });

    it('should handle very small decimals', () => {
      expect(formatCurrency(0.001)).toBe('0.00 دينار');
    });

    it('should handle empty currency string', () => {
      expect(formatCurrency(100, '')).toBe('100.00 ');
    });

    it('should handle special characters in currency', () => {
      expect(formatCurrency(100, '€')).toBe('100.00 €');
    });
  });

  describe('isValidTransactionId - additional edge cases', () => {
    it('should reject IDs with letters in date section', () => {
      expect(isValidTransactionId('TXN-2025112A-123456-789')).toBe(false);
    });

    it('should reject IDs with extra digits', () => {
      expect(isValidTransactionId('TXN-202511220-123456-789')).toBe(false);
    });

    it('should reject IDs with missing digits', () => {
      expect(isValidTransactionId('TXN-2025112-123456-789')).toBe(false);
    });

    it('should reject IDs with wrong prefix', () => {
      expect(isValidTransactionId('TX-20251122-123456-789')).toBe(false);
      expect(isValidTransactionId('TXNN-20251122-123456-789')).toBe(false);
    });

    it('should reject IDs with extra sections', () => {
      expect(isValidTransactionId('TXN-20251122-123456-789-000')).toBe(false);
    });

    it('should reject IDs with wrong separators', () => {
      expect(isValidTransactionId('TXN_20251122_123456_789')).toBe(false);
    });
  });

  describe('updateARAPOnPaymentAdd', () => {
    const mockLedgerDocId = 'ledger-doc-123';
    const mockUserId = 'user-123';
    const mockTransactionIdValue = 'TXN-20251122-123456-789';

    // Creates mock query snapshot (for getDocs - finding the document ID)
    const createMockQuerySnapshot = (data: Record<string, unknown> | null) => {
      if (data === null) {
        return { empty: true, docs: [] };
      }
      return {
        empty: false,
        docs: [
          {
            id: mockLedgerDocId,
            data: () => data,
          },
        ],
      };
    };

    // Creates mock transaction document snapshot (for transaction.get())
    const createMockTransactionSnapshot = (data: Record<string, unknown> | null) => {
      if (data === null) {
        return {
          exists: () => false,
          data: () => null,
        };
      }
      return {
        exists: () => true,
        data: () => data,
      };
    };

    it('should successfully update AR/AP when payment is added', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 500,
        amount: 1000,
      };

      // Mock the query to find document ID
      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');

      // Mock the transaction read
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(700);
      expect(result.newRemainingBalance).toBe(300);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.PARTIAL);
      expect(mockTransactionUpdate).toHaveBeenCalled();
    });

    it('should return paid status when payment completes the balance', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 800,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(1000);
      expect(result.newRemainingBalance).toBe(0);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should handle overpayment correctly', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 800,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        500
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(1300);
      expect(result.newRemainingBalance).toBe(-300);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.PAID);
    });

    it('should fail when ledger entry is not found', async () => {
      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(null));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        'TXN-99999999-999999-999',
        200
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('لم يتم العثور على حركة مالية');
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it('should fail when AR/AP tracking is not enabled', async () => {
      const ledgerData = {
        isARAPEntry: false,
        totalPaid: 500,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('لا تتبع نظام الذمم');
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it('should handle Firestore error gracefully', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('حدث خطأ');
    });

    it('should trim whitespace from transaction ID', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 0,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        '  TXN-20251122-123456-789  ',
        500
      );

      expect(result.success).toBe(true);
      expect(mockWhere).toHaveBeenCalledWith(
        'transactionId',
        '==',
        'TXN-20251122-123456-789'
      );
    });

    it('should handle first payment on unpaid entry', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 0,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        100
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(100);
      expect(result.newRemainingBalance).toBe(900);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.PARTIAL);
    });

    it('should handle missing totalPaid field (defaults to 0)', async () => {
      const ledgerData = {
        isARAPEntry: true,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        300
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(300);
    });

    it('should handle missing amount field (defaults to 0)', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 0,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await updateARAPOnPaymentAdd(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        100
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(100);
      expect(result.newRemainingBalance).toBe(-100);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.PAID);
    });
  });

  describe('reverseARAPOnPaymentDelete', () => {
    const mockLedgerDocId = 'ledger-doc-456';
    const mockUserId = 'user-456';
    const mockTransactionIdValue = 'TXN-20251122-654321-123';

    // Creates mock query snapshot (for getDocs - finding the document ID)
    const createMockQuerySnapshot = (data: Record<string, unknown> | null) => {
      if (data === null) {
        return { empty: true, docs: [] };
      }
      return {
        empty: false,
        docs: [
          {
            id: mockLedgerDocId,
            data: () => data,
          },
        ],
      };
    };

    // Creates mock transaction document snapshot (for transaction.get())
    const createMockTransactionSnapshot = (data: Record<string, unknown> | null) => {
      if (data === null) {
        return {
          exists: () => false,
          data: () => null,
        };
      }
      return {
        exists: () => true,
        data: () => data,
      };
    };

    it('should successfully reverse payment and update balance', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 700,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(500);
      expect(result.newRemainingBalance).toBe(500);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.PARTIAL);
      expect(mockTransactionUpdate).toHaveBeenCalled();
    });

    it('should change status to unpaid when all payments reversed', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 200,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(0);
      expect(result.newRemainingBalance).toBe(1000);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.UNPAID);
    });

    it('should not allow totalPaid to go below 0', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 100,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        500
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(0);
      expect(result.newRemainingBalance).toBe(1000);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.UNPAID);
    });

    it('should fail when ledger entry is not found', async () => {
      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(null));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        'TXN-99999999-999999-999',
        200
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('لم يتم العثور على حركة مالية');
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it('should fail when AR/AP tracking is not enabled', async () => {
      const ledgerData = {
        isARAPEntry: false,
        totalPaid: 500,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('لا تتبع نظام الذمم');
      expect(mockTransactionUpdate).not.toHaveBeenCalled();
    });

    it('should handle Firestore error gracefully', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('حدث خطأ');
    });

    it('should trim whitespace from transaction ID', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 500,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        '  TXN-20251122-654321-123  ',
        100
      );

      expect(result.success).toBe(true);
      expect(mockWhere).toHaveBeenCalledWith(
        'transactionId',
        '==',
        'TXN-20251122-654321-123'
      );
    });

    it('should change status from paid to partial on reversal', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 1000,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        300
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(700);
      expect(result.newRemainingBalance).toBe(300);
      expect(result.newStatus).toBe(PAYMENT_STATUSES.PARTIAL);
    });

    it('should handle missing totalPaid field (defaults to 0)', async () => {
      const ledgerData = {
        isARAPEntry: true,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(0);
    });

    it('should handle missing amount field (defaults to 0)', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 500,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      mockTransactionGet.mockResolvedValue(createMockTransactionSnapshot(ledgerData));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(true);
      expect(result.newTotalPaid).toBe(300);
      expect(result.newRemainingBalance).toBe(-300);
    });

    it('should handle transaction failure', async () => {
      const ledgerData = {
        isARAPEntry: true,
        totalPaid: 500,
        amount: 1000,
      };

      mockGetDocs.mockResolvedValue(createMockQuerySnapshot(ledgerData));
      mockDoc.mockReturnValue('mock-doc-ref');
      // Make the transaction fail
      mockRunTransaction.mockRejectedValue(new Error('Transaction failed'));

      const result = await reverseARAPOnPaymentDelete(
        mockFirestore,
        mockUserId,
        mockTransactionIdValue,
        200
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('حدث خطأ');
    });
  });
});
