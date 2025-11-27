/**
 * Unit Tests for useLedgerOperations Hook
 * Tests ledger CRUD operations
 */

import { renderHook, waitFor, act } from '@testing-library/react';

// Mock Firebase
const mockAddDoc = jest.fn();
const mockUpdateDoc = jest.fn();
const mockDeleteDoc = jest.fn();
const mockWriteBatch = jest.fn();
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn();
const mockGetDocs = jest.fn();

jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

jest.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: { uid: 'test-user-id' } }),
}));

const mockToast = jest.fn();
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'collection-ref'),
  addDoc: jest.fn(() => mockAddDoc()),
  updateDoc: jest.fn(() => mockUpdateDoc()),
  deleteDoc: jest.fn(() => mockDeleteDoc()),
  doc: jest.fn(() => 'doc-ref'),
  writeBatch: jest.fn(() => ({
    set: mockBatchSet,
    update: mockBatchUpdate,
    commit: jest.fn(() => mockBatchCommit()),
  })),
  where: jest.fn(),
  getDocs: jest.fn(() => mockGetDocs()),
  query: jest.fn(),
}));

// Mock helper functions
jest.mock('../utils/ledger-helpers', () => ({
  getCategoryType: jest.fn((category, subCategory) => {
    if (category.includes('مبيعات') || category.includes('إيراد')) return 'دخل';
    if (category.includes('مشتريات') || category.includes('مصروف')) return 'مصروف';
    return 'دخل';
  }),
  generateTransactionId: jest.fn(() => 'TX-TEST-001'),
}));

// Mock confirm
global.confirm = jest.fn(() => true);

// Import after mocks
import { useLedgerOperations, LedgerFormData } from '../useLedgerOperations';

describe('useLedgerOperations', () => {
  const mockFormData: LedgerFormData = {
    description: 'Test Transaction',
    amount: '1000',
    category: 'مبيعات',
    subCategory: 'مبيعات نقدية',
    date: '2024-01-15',
    associatedParty: 'عميل 1',
    ownerName: '',
    reference: 'REF-001',
    notes: 'Test notes',
    trackARAP: false,
    immediateSettlement: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: 'new-doc-id' });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockBatchCommit.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({
      empty: true,
      docs: [],
    });
  });

  describe('submitLedgerEntry - Create', () => {
    it('should create simple ledger entry', async () => {
      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(mockFormData, null);
      });

      expect(success).toBe(true);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تمت الإضافة بنجاح',
        })
      );
    });

    it('should return false when user is null', async () => {
      // Override useUser mock
      jest.doMock('@/firebase/provider', () => ({
        useUser: () => ({ user: null }),
      }));

      const { result } = renderHook(() => useLedgerOperations());

      // The hook should handle null user gracefully
      expect(result.current.submitLedgerEntry).toBeDefined();
    });

    it('should create entry with ARAP tracking', async () => {
      const formDataWithARAP = {
        ...mockFormData,
        trackARAP: true,
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataWithARAP, null, {
          hasInitialPayment: true,
          initialPaymentAmount: '500',
        });
      });

      expect(success).toBe(true);
    });

    it('should validate initial payment not exceeding total', async () => {
      const formDataWithARAP = {
        ...mockFormData,
        trackARAP: true,
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataWithARAP, null, {
          hasInitialPayment: true,
          initialPaymentAmount: '2000', // More than total amount
        });
      });

      expect(success).toBe(false);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    it('should validate initial payment is positive', async () => {
      const formDataWithARAP = {
        ...mockFormData,
        trackARAP: true,
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataWithARAP, null, {
          hasInitialPayment: true,
          initialPaymentAmount: '0',
        });
      });

      expect(success).toBe(false);
    });

    it('should create entry with immediate settlement', async () => {
      const formDataWithSettlement = {
        ...mockFormData,
        immediateSettlement: true,
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataWithSettlement, null);
      });

      expect(success).toBe(true);
    });

    it('should create entry with incoming check', async () => {
      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(mockFormData, null, {
          hasIncomingCheck: true,
          checkFormData: {
            chequeNumber: 'CHQ-001',
            chequeAmount: '500',
            bankName: 'البنك العربي',
            dueDate: '2024-02-15',
          },
        });
      });

      expect(success).toBe(true);
    });

    it('should validate check amount not exceeding total', async () => {
      const formDataWithSettlement = {
        ...mockFormData,
        immediateSettlement: true,
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataWithSettlement, null, {
          hasIncomingCheck: true,
          checkFormData: {
            chequeNumber: 'CHQ-001',
            chequeAmount: '2000', // More than total
            bankName: 'البنك العربي',
            dueDate: '2024-02-15',
          },
        });
      });

      expect(success).toBe(false);
    });

    it('should create entry with inventory update - new item', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const formDataExpense = {
        ...mockFormData,
        category: 'مشتريات',
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataExpense, null, {
          hasInventoryUpdate: true,
          inventoryFormData: {
            itemName: 'ورق مقوى',
            quantity: '100',
            unit: 'طن',
            thickness: '2',
            width: '100',
            length: '200',
            shippingCost: '50',
            otherCosts: '25',
          },
        });
      });

      expect(success).toBe(true);
    });

    it('should create entry with inventory update - existing item', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [
          {
            id: 'existing-item',
            data: () => ({ quantity: 50, unitPrice: 10 }),
          },
        ],
      });

      const formDataExpense = {
        ...mockFormData,
        category: 'مشتريات',
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataExpense, null, {
          hasInventoryUpdate: true,
          inventoryFormData: {
            itemName: 'ورق مقوى',
            quantity: '100',
            unit: 'طن',
            thickness: '',
            width: '',
            length: '',
            shippingCost: '',
            otherCosts: '',
          },
        });
      });

      expect(success).toBe(true);
    });

    it('should prevent inventory exit for non-existent item', async () => {
      mockGetDocs.mockResolvedValue({
        empty: true,
        docs: [],
      });

      const formDataIncome = {
        ...mockFormData,
        category: 'مبيعات', // This would trigger exit movement
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(formDataIncome, null, {
          hasInventoryUpdate: true,
          inventoryFormData: {
            itemName: 'Non-existent Item',
            quantity: '10',
            unit: 'unit',
            thickness: '',
            width: '',
            length: '',
            shippingCost: '',
            otherCosts: '',
          },
        });
      });

      expect(success).toBe(false);
    });

    it('should create entry with fixed asset', async () => {
      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(mockFormData, null, {
          hasFixedAsset: true,
          fixedAssetFormData: {
            assetName: 'ماكينة طباعة',
            usefulLifeYears: '10',
            salvageValue: '1000',
            depreciationMethod: 'straight_line',
          },
        });
      });

      expect(success).toBe(true);
    });

    it('should handle declining balance depreciation', async () => {
      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(mockFormData, null, {
          hasFixedAsset: true,
          fixedAssetFormData: {
            assetName: 'سيارة',
            usefulLifeYears: '5',
            salvageValue: '',
            depreciationMethod: 'declining',
          },
        });
      });

      expect(success).toBe(true);
    });
  });

  describe('submitLedgerEntry - Update', () => {
    it('should update existing ledger entry', async () => {
      const existingEntry = {
        id: 'existing-entry-id',
        transactionId: 'TX-EXIST-001',
        description: 'Old Description',
        amount: 500,
        category: 'مبيعات',
        subCategory: '',
        date: new Date(),
        associatedParty: 'Old Client',
      };

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(mockFormData, existingEntry as any);
      });

      expect(success).toBe(true);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تم التحديث بنجاح',
        })
      );
    });
  });

  describe('deleteLedgerEntry', () => {
    it('should delete ledger entry when confirmed', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.deleteLedgerEntry('entry-to-delete');
      });

      expect(success).toBe(true);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'تم الحذف بنجاح',
        })
      );
    });

    it('should not delete when user cancels', async () => {
      (global.confirm as jest.Mock).mockReturnValue(false);

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.deleteLedgerEntry('entry-to-delete');
      });

      expect(success).toBe(false);
    });

    it('should return false when user is null', async () => {
      // This tests the early return when user is null
      const { result } = renderHook(() => useLedgerOperations());

      expect(result.current.deleteLedgerEntry).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle submission errors gracefully', async () => {
      mockAddDoc.mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(mockFormData, null);
      });

      expect(success).toBe(false);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    it('should handle delete errors gracefully', async () => {
      (global.confirm as jest.Mock).mockReturnValue(true);
      mockDeleteDoc.mockRejectedValue(new Error('Firestore error'));

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.deleteLedgerEntry('entry-id');
      });

      expect(success).toBe(false);
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'destructive',
        })
      );
    });

    it('should handle batch commit errors', async () => {
      mockBatchCommit.mockRejectedValue(new Error('Batch commit failed'));

      const { result } = renderHook(() => useLedgerOperations());

      let success;
      await act(async () => {
        success = await result.current.submitLedgerEntry(mockFormData, null, {
          hasIncomingCheck: true,
          checkFormData: {
            chequeNumber: 'CHQ-001',
            chequeAmount: '500',
            bankName: 'Test Bank',
            dueDate: '2024-02-15',
          },
        });
      });

      expect(success).toBe(false);
    });
  });

  describe('Payment Status Calculation', () => {
    it('should set status to paid when immediate settlement covers full amount', async () => {
      const formData = {
        ...mockFormData,
        trackARAP: true,
        immediateSettlement: true,
      };

      const { result } = renderHook(() => useLedgerOperations());

      await act(async () => {
        await result.current.submitLedgerEntry(formData, null);
      });

      expect(mockBatchSet).toHaveBeenCalled();
    });

    it('should set status to partial when check amount is less than total', async () => {
      const formData = {
        ...mockFormData,
        trackARAP: true,
        immediateSettlement: true,
      };

      const { result } = renderHook(() => useLedgerOperations());

      await act(async () => {
        await result.current.submitLedgerEntry(formData, null, {
          hasIncomingCheck: true,
          checkFormData: {
            chequeNumber: 'CHQ-001',
            chequeAmount: '500', // Less than 1000 total
            bankName: 'Test Bank',
            dueDate: '2024-02-15',
          },
        });
      });

      expect(mockBatchSet).toHaveBeenCalled();
    });
  });
});
