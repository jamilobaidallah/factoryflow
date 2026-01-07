/**
 * Comprehensive Unit Tests for Payment Handlers
 *
 * Tests cover:
 * - handleImmediateSettlementBatch: Full payment at transaction creation
 * - handleInitialPaymentBatch: Partial payment when AR/AP tracking enabled
 * - Payment type determination (receipt vs disbursement)
 * - Customer and supplier advance handling
 * - Edge cases (zero amounts, missing data)
 */

import { doc } from 'firebase/firestore';
import { handleImmediateSettlementBatch, handleInitialPaymentBatch } from '../paymentHandlers';
import type { HandlerContext } from '../../types';
import type { LedgerFormData } from '@/components/ledger/types/ledger';

// Mock Firebase Firestore
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => ({ id: 'mock-payment-id' })),
}));

// Mock constants
jest.mock('@/lib/constants', () => ({
  PAYMENT_TYPES: { RECEIPT: 'قبض', DISBURSEMENT: 'صرف' },
}));

const mockDoc = doc as jest.Mock;

// Helper to create mock form data
const createMockFormData = (overrides: Partial<LedgerFormData> = {}): LedgerFormData => ({
  description: 'Test transaction',
  amount: '1000',
  category: 'مبيعات',
  subCategory: '',
  associatedParty: 'Test Client',
  ownerName: '',
  date: '2024-01-15',
  reference: '',
  notes: '',
  trackARAP: false,
  immediateSettlement: true,
  ...overrides,
});

// Helper to create mock handler context
const createMockContext = (
  formData: LedgerFormData,
  entryType: string = 'دخل'
): HandlerContext => {
  const mockBatch = {
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn(),
  };

  return {
    batch: mockBatch as any,
    transactionId: 'TXN-TEST-123',
    formData,
    entryType,
    userId: 'test-user-123',
    refs: {
      ledger: { id: 'ledger' } as any,
      cheques: { id: 'cheques' } as any,
      payments: { id: 'payments' } as any,
      inventory: { id: 'inventory' } as any,
      inventoryMovements: { id: 'inventory_movements' } as any,
      fixedAssets: { id: 'fixed_assets' } as any,
    },
  };
};

describe('Payment Handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDoc.mockReturnValue({ id: 'mock-payment-id' });
  });

  // ============================================
  // handleImmediateSettlementBatch Tests
  // ============================================

  describe('handleImmediateSettlementBatch', () => {
    describe('Income (دخل) Entries', () => {
      it('should create receipt payment for income entry with cash', () => {
        const formData = createMockFormData({
          description: 'Cash sale',
          category: 'مبيعات',
          associatedParty: 'Customer A',
          date: '2024-01-15',
        });
        const ctx = createMockContext(formData, 'دخل');

        handleImmediateSettlementBatch(ctx, 1000, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          { id: 'mock-payment-id' },
          expect.objectContaining({
            clientName: 'Customer A',
            amount: 1000,
            type: 'قبض', // Receipt
            method: 'cash',
            linkedTransactionId: 'TXN-TEST-123',
            notes: expect.stringContaining('تسوية فورية نقدية'),
            category: 'مبيعات',
          })
        );
      });

      it('should create receipt payment for income entry with cheque', () => {
        const formData = createMockFormData({
          description: 'Cheque sale',
          category: 'مبيعات',
        });
        const ctx = createMockContext(formData, 'دخل');

        handleImmediateSettlementBatch(ctx, 2000, 'cheque');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 2000,
            type: 'قبض',
            method: 'cheque',
            notes: expect.stringContaining('تسوية فورية بشيك'),
          })
        );
      });
    });

    describe('Expense (مصروف) Entries', () => {
      it('should create disbursement payment for expense entry', () => {
        const formData = createMockFormData({
          description: 'Office rent',
          category: 'إيجار',
          associatedParty: 'Landlord',
        });
        const ctx = createMockContext(formData, 'مصروف');

        handleImmediateSettlementBatch(ctx, 500, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            clientName: 'Landlord',
            amount: 500,
            type: 'صرف', // Disbursement
            method: 'cash',
          })
        );
      });
    });

    describe('Customer Advance (سلفة عميل) Entries', () => {
      it('should create receipt payment for customer advance', () => {
        // Customer advance: customer pays us cash upfront
        // Entry type will be "دخل" but we want to ensure receipt
        const formData = createMockFormData({
          description: 'Customer advance payment',
          category: 'سلفة عميل',
          associatedParty: 'Customer B',
        });
        const ctx = createMockContext(formData, 'دخل');

        handleImmediateSettlementBatch(ctx, 3000, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 3000,
            type: 'قبض', // Receipt - we receive cash from customer
            category: 'سلفة عميل',
          })
        );
      });
    });

    describe('Supplier Advance (سلفة مورد) Entries', () => {
      it('should create disbursement payment for supplier advance', () => {
        // Supplier advance: we pay supplier cash upfront
        // Entry type will be "مصروف" but we want to ensure disbursement
        const formData = createMockFormData({
          description: 'Advance to supplier',
          category: 'سلفة مورد',
          associatedParty: 'Supplier X',
        });
        const ctx = createMockContext(formData, 'مصروف');

        handleImmediateSettlementBatch(ctx, 5000, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 5000,
            type: 'صرف', // Disbursement - we pay cash to supplier
            category: 'سلفة مورد',
          })
        );
      });
    });

    describe('Edge Cases', () => {
      it('should not create payment for zero amount', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, 0, 'cash');

        expect(ctx.batch.set).not.toHaveBeenCalled();
      });

      it('should not create payment for negative amount', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, -100, 'cash');

        expect(ctx.batch.set).not.toHaveBeenCalled();
      });

      it('should use "غير محدد" when associatedParty is empty', () => {
        const formData = createMockFormData({ associatedParty: '' });
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, 1000, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            clientName: 'غير محدد',
          })
        );
      });

      it('should handle undefined associatedParty', () => {
        const formData = createMockFormData({ associatedParty: undefined as any });
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, 1000, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            clientName: 'غير محدد',
          })
        );
      });

      it('should default to cash method when not specified', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        // Call without specifying method
        handleImmediateSettlementBatch(ctx, 1000);

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            method: 'cash',
            notes: expect.stringContaining('تسوية فورية نقدية'),
          })
        );
      });

      it('should include correct date from form data', () => {
        const formData = createMockFormData({ date: '2024-06-15' });
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, 1000, 'cash');

        const setCall = (ctx.batch.set as jest.Mock).mock.calls[0][1];
        expect(setCall.date).toEqual(new Date('2024-06-15'));
      });

      it('should include subCategory in payment record', () => {
        const formData = createMockFormData({
          category: 'مبيعات',
          subCategory: 'بيع جملة',
        });
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, 1000, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            category: 'مبيعات',
            subCategory: 'بيع جملة',
          })
        );
      });

      it('should handle decimal amounts', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, 1234.56, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 1234.56,
          })
        );
      });

      it('should handle very large amounts', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleImmediateSettlementBatch(ctx, 999999999.99, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 999999999.99,
          })
        );
      });
    });
  });

  // ============================================
  // handleInitialPaymentBatch Tests
  // ============================================

  describe('handleInitialPaymentBatch', () => {
    describe('Income (دخل) Entries', () => {
      it('should create receipt payment for partial income payment', () => {
        const formData = createMockFormData({
          description: 'Invoice with partial payment',
          category: 'مبيعات',
          associatedParty: 'Customer C',
        });
        const ctx = createMockContext(formData, 'دخل');

        handleInitialPaymentBatch(ctx, 500);

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            clientName: 'Customer C',
            amount: 500,
            type: 'قبض', // Receipt
            linkedTransactionId: 'TXN-TEST-123',
            notes: expect.stringContaining('دفعة أولية'),
          })
        );
      });
    });

    describe('Expense (مصروف) Entries', () => {
      it('should create disbursement payment for partial expense payment', () => {
        const formData = createMockFormData({
          description: 'Utility bill partial payment',
          category: 'كهرباء',
          associatedParty: 'Electric Company',
        });
        const ctx = createMockContext(formData, 'مصروف');

        handleInitialPaymentBatch(ctx, 300);

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 300,
            type: 'صرف', // Disbursement
            notes: expect.stringContaining('دفعة أولية'),
          })
        );
      });
    });

    describe('Customer Advance (سلفة عميل) Entries', () => {
      it('should create receipt for customer advance initial payment', () => {
        const formData = createMockFormData({
          description: 'Partial customer advance',
          category: 'سلفة عميل',
          associatedParty: 'Customer D',
        });
        const ctx = createMockContext(formData, 'دخل');

        handleInitialPaymentBatch(ctx, 2000);

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 2000,
            type: 'قبض',
            category: 'سلفة عميل',
          })
        );
      });
    });

    describe('Supplier Advance (سلفة مورد) Entries', () => {
      it('should create disbursement for supplier advance initial payment', () => {
        const formData = createMockFormData({
          description: 'Partial supplier advance',
          category: 'سلفة مورد',
          associatedParty: 'Supplier Y',
        });
        const ctx = createMockContext(formData, 'مصروف');

        handleInitialPaymentBatch(ctx, 1500);

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            amount: 1500,
            type: 'صرف',
            category: 'سلفة مورد',
          })
        );
      });
    });

    describe('Edge Cases', () => {
      it('should not create payment for zero amount', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleInitialPaymentBatch(ctx, 0);

        expect(ctx.batch.set).not.toHaveBeenCalled();
      });

      it('should not create payment for negative amount', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleInitialPaymentBatch(ctx, -50);

        expect(ctx.batch.set).not.toHaveBeenCalled();
      });

      it('should use "غير محدد" when associatedParty is empty', () => {
        const formData = createMockFormData({ associatedParty: '' });
        const ctx = createMockContext(formData);

        handleInitialPaymentBatch(ctx, 100);

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            clientName: 'غير محدد',
          })
        );
      });

      it('should include createdAt timestamp', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleInitialPaymentBatch(ctx, 100);

        const setCall = (ctx.batch.set as jest.Mock).mock.calls[0][1];
        expect(setCall.createdAt).toBeInstanceOf(Date);
      });

      it('should use doc from refs.payments', () => {
        const formData = createMockFormData();
        const ctx = createMockContext(formData);

        handleInitialPaymentBatch(ctx, 100);

        expect(mockDoc).toHaveBeenCalledWith(ctx.refs.payments);
      });
    });
  });

  // ============================================
  // Payment Type Logic Tests
  // ============================================

  describe('Payment Type Determination', () => {
    it('should determine correct payment types for all entry types', () => {
      const testCases = [
        { entryType: 'دخل', category: 'مبيعات', expectedType: 'قبض' },
        { entryType: 'مصروف', category: 'إيجار', expectedType: 'صرف' },
        { entryType: 'دخل', category: 'سلفة عميل', expectedType: 'قبض' },
        { entryType: 'مصروف', category: 'سلفة مورد', expectedType: 'صرف' },
      ];

      testCases.forEach(({ entryType, category, expectedType }) => {
        jest.clearAllMocks();
        const formData = createMockFormData({ category });
        const ctx = createMockContext(formData, entryType);

        handleImmediateSettlementBatch(ctx, 100, 'cash');

        expect(ctx.batch.set).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            type: expectedType,
          })
        );
      });
    });
  });

  // ============================================
  // Integration-like Tests
  // ============================================

  describe('Integration Scenarios', () => {
    it('should handle complete income transaction with immediate settlement', () => {
      const formData = createMockFormData({
        description: 'Full invoice payment',
        amount: '5000',
        category: 'مبيعات',
        subCategory: 'بيع تجزئة',
        associatedParty: 'عميل محمد',
        date: '2024-03-15',
      });
      const ctx = createMockContext(formData, 'دخل');

      handleImmediateSettlementBatch(ctx, 5000, 'cash');

      expect(ctx.batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          clientName: 'عميل محمد',
          amount: 5000,
          type: 'قبض',
          method: 'cash',
          linkedTransactionId: 'TXN-TEST-123',
          category: 'مبيعات',
          subCategory: 'بيع تجزئة',
        })
      );
    });

    it('should handle complete expense transaction with cheque payment', () => {
      const formData = createMockFormData({
        description: 'Monthly supplies purchase',
        amount: '3500',
        category: 'مشتريات',
        subCategory: 'مواد خام',
        associatedParty: 'مورد الحديد',
        date: '2024-03-20',
      });
      const ctx = createMockContext(formData, 'مصروف');

      handleImmediateSettlementBatch(ctx, 3500, 'cheque');

      expect(ctx.batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          clientName: 'مورد الحديد',
          amount: 3500,
          type: 'صرف',
          method: 'cheque',
          notes: expect.stringContaining('تسوية فورية بشيك'),
        })
      );
    });

    it('should handle AR/AP entry with initial partial payment', () => {
      const formData = createMockFormData({
        description: 'Invoice with down payment',
        amount: '10000',
        category: 'مبيعات',
        associatedParty: 'عميل جديد',
        trackARAP: true,
        immediateSettlement: false,
      });
      const ctx = createMockContext(formData, 'دخل');

      // 30% down payment
      handleInitialPaymentBatch(ctx, 3000);

      expect(ctx.batch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          amount: 3000,
          type: 'قبض',
          notes: expect.stringContaining('دفعة أولية'),
        })
      );
    });
  });
});
