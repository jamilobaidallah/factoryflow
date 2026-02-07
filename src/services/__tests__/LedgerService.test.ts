/**
 * Comprehensive Unit Tests for LedgerService
 *
 * Tests cover:
 * - Simple ledger entry creation
 * - Ledger entry with related records (cheques, payments, inventory)
 * - AR/AP tracking and payment status
 * - Update operations
 * - Delete operations (including cascade cleanup)
 * - Quick payment functionality
 * - Bad debt write-off
 * - Edge cases and error handling
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  onSnapshot,
  getCountFromServer,
  increment,
} from 'firebase/firestore';

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
  limit: jest.fn(),
  startAfter: jest.fn(),
  writeBatch: jest.fn(),
  runTransaction: jest.fn(),
  onSnapshot: jest.fn(),
  getCountFromServer: jest.fn(),
  increment: jest.fn((n) => ({ _increment: n })),
  arrayRemove: jest.fn(),
  Timestamp: {
    fromDate: jest.fn((date: Date) => ({ toDate: () => date })),
  },
}));

// Mock firebase config
jest.mock('@/firebase/config', () => ({
  firestore: {},
  storage: {},
}));

// Mock firebase storage
jest.mock('firebase/storage', () => ({
  ref: jest.fn(),
  uploadBytes: jest.fn(),
  getDownloadURL: jest.fn(() => Promise.resolve('https://example.com/image.jpg')),
  StorageError: class StorageError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

// Mock journalService
jest.mock('@/services/journalService', () => ({
  addJournalEntryToBatch: jest.fn(),
  addCOGSJournalEntryToBatch: jest.fn(),
  addPaymentJournalEntryToBatch: jest.fn(),
  createJournalEntryForBadDebt: jest.fn(() => Promise.resolve()),
}));

// Mock journal posting engine
const mockPost = jest.fn().mockResolvedValue({ success: true, entryNumber: 'JE-001' });
jest.mock('@/services/journal', () => ({
  createJournalPostingEngine: jest.fn(() => ({
    post: mockPost,
  })),
  getEntriesByTransactionId: jest.fn().mockResolvedValue([]),
}));

// Mock activityLogService
jest.mock('@/services/activityLogService', () => ({
  logActivity: jest.fn(() => Promise.resolve()),
}));

// Mock error handling
jest.mock('@/lib/error-handling', () => ({
  handleError: jest.fn((error) => ({
    message: error?.message || 'Unknown error',
    type: 'UNKNOWN',
  })),
  ErrorType: {
    VALIDATION: 'VALIDATION',
    PERMISSION: 'PERMISSION',
    RATE_LIMITED: 'RATE_LIMITED',
    UNKNOWN: 'UNKNOWN',
  },
}));

// Mock errors
jest.mock('@/lib/errors', () => ({
  assertNonNegative: jest.fn((value) => {
    if (value < 0) {throw new Error('DATA_INTEGRITY_ERROR');}
    return value;
  }),
  isDataIntegrityError: jest.fn((error) => error?.message?.includes('DATA_INTEGRITY_ERROR')),
}));

// Mock currency utilities
jest.mock('@/lib/currency', () => ({
  parseAmount: jest.fn((value) => parseFloat(String(value)) || 0),
  safeAdd: jest.fn((a, b) => (a || 0) + (b || 0)),
  safeSubtract: jest.fn((a, b) => (a || 0) - (b || 0)),
  roundCurrency: jest.fn((n) => Math.round(n * 100) / 100),
}));

// Mock AR/AP utilities
jest.mock('@/lib/arap-utils', () => ({
  calculatePaymentStatus: jest.fn((totalPaid, amount, discount, writeoff) => {
    const remaining = amount - totalPaid - (discount || 0) - (writeoff || 0);
    if (remaining <= 0) {return 'paid';}
    if (totalPaid > 0) {return 'partial';}
    return 'unpaid';
  }),
  calculateRemainingBalance: jest.fn((amount, totalPaid, discount, writeoff) =>
    amount - totalPaid - (discount || 0) - (writeoff || 0)
  ),
}));

// Mock firestore-utils
jest.mock('@/lib/firestore-utils', () => ({
  convertFirestoreDates: jest.fn((data) => data),
}));

// Mock constants
jest.mock('@/lib/constants', () => ({
  CHEQUE_TYPES: { INCOMING: 'وارد', OUTGOING: 'صادر' },
  CHEQUE_STATUS_AR: { PENDING: 'قيد الانتظار', CASHED: 'محصل', BOUNCED: 'مرتجع', ENDORSED: 'مجيّر' },
  PAYMENT_TYPES: { RECEIPT: 'قبض', DISBURSEMENT: 'صرف' },
  LOAN_CATEGORIES: { GIVEN: 'قروض ممنوحة', RECEIVED: 'قروض مستلمة' },
  QUERY_LIMITS: {
    CLIENTS: 500,
    LEDGER_ENTRIES: 10000,
    PAYMENTS: 10000,
    PENDING_CHEQUES: 5000,
    DASHBOARD_ENTRIES: 5000,
    DEFAULT_PAGE_SIZE: 50,
    PARTNERS: 100,
    ADVANCES: 500,
    OVERTIME_ENTRIES: 1000,
    LEDGER_FAVORITES: 50,
    JOURNAL_ENTRIES: 10000,
    ACCOUNTS: 500,
  },
}));

// Mock ledger helpers
jest.mock('@/components/ledger/utils/ledger-helpers', () => ({
  getCategoryType: jest.fn((category) => {
    if (category === 'مبيعات' || category === 'إيرادات') {return 'دخل';}
    if (category === 'مصروف' || category === 'رواتب') {return 'مصروف';}
    return 'دخل';
  }),
  generateTransactionId: jest.fn(() => 'TXN-' + Math.random().toString(36).substr(2, 9)),
  LOAN_CATEGORIES: { GIVEN: 'قروض ممنوحة', RECEIVED: 'قروض مستلمة' },
  isAdvanceTransaction: jest.fn((category) => category === 'سلفة عميل' || category === 'سلفة مورد'),
  isFixedAssetTransaction: jest.fn((category) => category === 'أصول ثابتة'),
  getJournalTemplateForTransaction: jest.fn((entryType) => {
    return entryType === 'دخل' ? 'LEDGER_INCOME' : 'LEDGER_EXPENSE';
  }),
  getPaymentTypeForTransaction: jest.fn((entryType) => {
    return entryType === 'دخل' ? 'قبض' : 'صرف';
  }),
}));

// Mock handlers
jest.mock('../ledger/handlers/chequeHandlers', () => ({
  handleIncomingCheckBatch: jest.fn(),
  handleOutgoingCheckBatch: jest.fn(),
}));

jest.mock('../ledger/handlers/paymentHandlers', () => ({
  handleImmediateSettlementBatch: jest.fn(),
  handleInitialPaymentBatch: jest.fn(),
}));

jest.mock('../ledger/handlers/inventoryHandlers', () => ({
  handleInventoryUpdate: jest.fn(() => Promise.resolve({ success: true })),
  rollbackInventoryChanges: jest.fn(() => Promise.resolve()),
}));

jest.mock('../ledger/handlers/fixedAssetHandlers', () => ({
  handleFixedAssetBatch: jest.fn(),
}));

jest.mock('../ledger/handlers/advanceHandlers', () => ({
  handleAdvanceAllocationBatch: jest.fn(() =>
    Promise.resolve({ totalPaidFromAdvances: 0, paidFromAdvances: [], journalPromises: [] })
  ),
}));

// Import after mocks
import { LedgerService, createLedgerService } from '../ledger/LedgerService';
import type { LedgerFormData } from '@/components/ledger/types/ledger';

// Type assertions for mocks
const mockCollection = collection as jest.Mock;
const mockDoc = doc as jest.Mock;
const mockWriteBatch = writeBatch as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockGetDocs = getDocs as jest.Mock;
const mockRunTransaction = runTransaction as jest.Mock;
const mockOnSnapshot = onSnapshot as jest.Mock;
const mockGetCountFromServer = getCountFromServer as jest.Mock;

// Helper to create mock batch
const createMockBatch = () => ({
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  commit: jest.fn(() => Promise.resolve()),
});

// Helper to create mock QuerySnapshot (Firebase-compatible)
interface MockDoc {
  ref: { id: string };
  id: string;
  data: () => Record<string, unknown>;
}
const createMockQuerySnapshot = (docs: MockDoc[] = []) => ({
  docs,
  empty: docs.length === 0,
  forEach: (fn: (doc: MockDoc) => void) => docs.forEach(fn),
});

// Helper to create mock form data
const createMockFormData = (overrides: Partial<LedgerFormData> = {}): LedgerFormData => ({
  description: 'Test transaction',
  amount: '1000',
  category: 'مبيعات',
  subCategory: '',
  associatedParty: 'Test Client',
  ownerName: '',
  date: '2024-01-15',
  trackARAP: false,
  immediateSettlement: true,
  ...overrides,
});

describe('LedgerService', () => {
  let service: LedgerService;
  const mockUserId = 'test-user-123';
  const mockUserEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LedgerService(mockUserId, mockUserEmail, 'owner');

    // Default mock implementations
    mockCollection.mockReturnValue({ id: 'mock-collection' });
    mockDoc.mockReturnValue({ id: 'mock-doc-id' });

    // Reset journal posting mock
    mockPost.mockResolvedValue({ success: true, entryNumber: 'JE-001' });
  });

  // ============================================
  // Constructor Tests
  // ============================================

  describe('Constructor', () => {
    it('should create service with all parameters', () => {
      const svc = new LedgerService('user1', 'user@test.com', 'accountant');
      expect(svc).toBeInstanceOf(LedgerService);
    });

    it('should create service with only userId', () => {
      const svc = new LedgerService('user1');
      expect(svc).toBeInstanceOf(LedgerService);
    });

    it('should use factory function', () => {
      const svc = createLedgerService('user1', 'user@test.com', 'owner');
      expect(svc).toBeInstanceOf(LedgerService);
    });
  });

  // ============================================
  // Simple Ledger Entry Tests
  // ============================================

  describe('createSimpleLedgerEntry', () => {
    it('should create a simple income ledger entry', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockDoc.mockReturnValue({ id: 'new-entry-id' });

      const formData = createMockFormData({
        description: 'Cash sale',
        amount: '500',
        category: 'مبيعات',
      });

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(true);
      expect(result.data).toBe('new-entry-id');
      expect(mockBatch.set).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should create a simple expense ledger entry', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockDoc.mockReturnValue({ id: 'expense-entry-id' });

      const formData = createMockFormData({
        description: 'Office supplies',
        amount: '200',
        category: 'مصروف',
      });

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(true);
      expect(result.data).toBe('expense-entry-id');
    });

    it('should handle batch commit failure', async () => {
      const mockBatch = createMockBatch();
      mockBatch.commit.mockRejectedValue(new Error('Commit failed'));
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData();

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle zero amount', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockDoc.mockReturnValue({ id: 'zero-entry' });

      const formData = createMockFormData({ amount: '0' });

      const result = await service.createSimpleLedgerEntry(formData);

      // Zero amount should still be allowed (the validation happens at form level)
      expect(mockBatch.set).toHaveBeenCalled();
    });

    it('should store immediateSettlement and isARAPEntry flags', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({ immediateSettlement: false });

      await service.createSimpleLedgerEntry(formData);

      // Check that the batch.set was called with correct data
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          immediateSettlement: false,
          isARAPEntry: false,
        })
      );
    });
  });

  // ============================================
  // Ledger Entry with Related Records Tests
  // ============================================

  describe('createLedgerEntryWithRelated', () => {
    it('should create entry with AR/AP tracking', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockDoc.mockReturnValue({ id: 'arap-entry-id' });

      const formData = createMockFormData({
        trackARAP: true,
        immediateSettlement: false,
      });

      const result = await service.createLedgerEntryWithRelated(formData, {});

      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          isARAPEntry: true,
          paymentStatus: 'unpaid',
        })
      );
    });

    it('should create entry with immediate settlement (fully paid)', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({
        trackARAP: true,
        immediateSettlement: true,
        amount: '1000',
      });

      const result = await service.createLedgerEntryWithRelated(formData, {});

      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          totalPaid: 1000,
          paymentStatus: 'paid',
          remainingBalance: 0,
        })
      );
    });

    it('should create entry with initial payment (partial)', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({
        trackARAP: true,
        immediateSettlement: false,
        amount: '1000',
      });

      const options = {
        hasInitialPayment: true,
        initialPaymentAmount: '300',
      };

      const result = await service.createLedgerEntryWithRelated(formData, options);

      expect(result.success).toBe(true);
    });

    it('should validate initial payment not exceeding total', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({
        amount: '100',
      });

      const options = {
        hasInitialPayment: true,
        initialPaymentAmount: '200', // Exceeds total
      };

      const result = await service.createLedgerEntryWithRelated(formData, options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('أكبر من المبلغ الإجمالي');
    });

    it('should handle inventory rollback on batch failure', async () => {
      const { rollbackInventoryChanges } = require('../ledger/handlers/inventoryHandlers');
      const { handleInventoryUpdate } = require('../ledger/handlers/inventoryHandlers');

      handleInventoryUpdate.mockResolvedValue({
        success: true,
        inventoryChange: { itemId: 'item-1', quantityDelta: 10 },
      });

      const mockBatch = createMockBatch();
      mockBatch.commit.mockRejectedValue(new Error('Batch failed'));
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData();
      const options = {
        hasInventoryUpdate: true,
        inventoryFormData: {
          itemId: '',
          itemName: 'Test Item',
          quantity: '10',
          unit: 'kg',
          thickness: '',
          width: '',
          length: '',
          shippingCost: '',
          otherCosts: '',
        },
      };

      const result = await service.createLedgerEntryWithRelated(formData, options);

      expect(result.success).toBe(false);
      expect(rollbackInventoryChanges).toHaveBeenCalled();
    });

    it('should handle advance allocation', async () => {
      const { handleAdvanceAllocationBatch } = require('../ledger/handlers/advanceHandlers');
      handleAdvanceAllocationBatch.mockResolvedValue({
        totalPaidFromAdvances: 500,
        paidFromAdvances: [{ advanceId: 'adv-1', amount: 500, date: new Date() }],
        journalPromises: [],
      });

      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({
        trackARAP: true,
        immediateSettlement: false,
        amount: '1000',
      });

      const options = {
        advanceAllocations: [{
          advanceId: 'adv-1',
          advanceTransactionId: 'TXN-ADV-001',
          amount: 500,
          originalAdvanceAmount: 1000,
          remainingAfterAllocation: 500,
        }],
      };

      const result = await service.createLedgerEntryWithRelated(formData, options);

      expect(result.success).toBe(true);
      expect(mockBatch.update).toHaveBeenCalled();
    });
  });

  // ============================================
  // Update Operations Tests
  // ============================================

  describe('updateLedgerEntry', () => {
    it('should update basic fields', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          amount: 1000,
          isARAPEntry: false,
        }),
      });
      mockGetDocs.mockResolvedValue({ docs: [], forEach: jest.fn() });

      const formData = createMockFormData({
        description: 'Updated description',
        amount: '1500',
      });

      const result = await service.updateLedgerEntry('entry-123', formData);

      expect(result.success).toBe(true);
      expect(mockBatch.update).toHaveBeenCalled();
    });

    it('should recalculate AR/AP when amount changes', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          amount: 1000,
          isARAPEntry: true,
          totalPaid: 500,
          totalDiscount: 0,
          writeoffAmount: 0,
          paymentStatus: 'partial',
        }),
      });
      // Use createMockQuerySnapshot to include 'empty' property
      mockGetDocs.mockResolvedValue(createMockQuerySnapshot());

      const formData = createMockFormData({ amount: '1500' });

      const result = await service.updateLedgerEntry('entry-123', formData, 'TXN-123');

      expect(result.success).toBe(true);
      // Should recalculate remainingBalance and paymentStatus
      expect(mockBatch.update).toHaveBeenCalled();
    });

    it('should reverse advance allocations when editing', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          amount: 1000,
          isARAPEntry: true,
          paidFromAdvances: [
            { advanceId: 'adv-1', advanceTransactionId: 'TXN-ADV-1', amount: 300 },
          ],
          totalPaidFromAdvances: 300,
          totalPaid: 300,
        }),
      });
      // Use createMockQuerySnapshot to include 'empty' property
      mockGetDocs.mockResolvedValue(createMockQuerySnapshot());

      const formData = createMockFormData({ amount: '1000' });

      const result = await service.updateLedgerEntry('entry-123', formData, 'TXN-123');

      expect(result.success).toBe(true);
      // Should have reversed the advance allocation
      expect(mockBatch.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          totalPaid: expect.any(Object), // increment(-300)
          remainingBalance: expect.any(Object),
        })
      );
    });

    it('should sync associated party to linked payments', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ amount: 1000 }),
      });

      const mockPaymentDocs = [
        { ref: { id: 'pay-1' }, data: () => ({ notes: 'Payment 1' }) },
      ];
      mockGetDocs.mockResolvedValue({
        docs: mockPaymentDocs,
        forEach: (fn: (doc: typeof mockPaymentDocs[0]) => void) => mockPaymentDocs.forEach(fn),
      });

      const formData = createMockFormData({ associatedParty: 'New Client Name' });

      const result = await service.updateLedgerEntry('entry-123', formData, 'TXN-123');

      expect(result.success).toBe(true);
    });
  });

  describe('updateARAPTracking', () => {
    it('should update AR/AP fields', async () => {
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const result = await service.updateARAPTracking('entry-123', 500, 500, 'partial');

      expect(result.success).toBe(true);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          totalPaid: 500,
          remainingBalance: 500,
          paymentStatus: 'partial',
        })
      );
    });

    it('should handle update failure', async () => {
      (updateDoc as jest.Mock).mockRejectedValue(new Error('Update failed'));

      const result = await service.updateARAPTracking('entry-123', 500, 500, 'partial');

      expect(result.success).toBe(false);
    });
  });

  // ============================================
  // Delete Operations Tests
  // ============================================

  describe('deleteLedgerEntry', () => {
    const mockEntry = {
      id: 'entry-123',
      transactionId: 'TXN-123',
      description: 'Test entry',
      amount: 1000,
      type: 'دخل',
      category: 'مبيعات',
    };

    it('should delete entry and related records', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDocs.mockResolvedValue({ docs: [], forEach: jest.fn() });

      const result = await service.deleteLedgerEntry(mockEntry as any);

      expect(result.success).toBe(true);
      expect(mockBatch.delete).toHaveBeenCalled();
      expect(mockBatch.commit).toHaveBeenCalled();
    });

    it('should delete related payments', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const mockPayments = [{ ref: { id: 'pay-1' } }, { ref: { id: 'pay-2' } }];
      mockGetDocs
        .mockResolvedValueOnce({ docs: mockPayments, forEach: (fn: (doc: typeof mockPayments[0]) => void) => mockPayments.forEach(fn) }) // payments
        .mockResolvedValue({ docs: [], forEach: jest.fn() }); // other queries

      const result = await service.deleteLedgerEntry(mockEntry as any);

      expect(result.success).toBe(true);
      expect(result.deletedRelatedCount).toBeGreaterThan(0);
    });

    it('should delete related cheques', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const mockCheques = [{ ref: { id: 'chq-1' } }];
      mockGetDocs
        .mockResolvedValueOnce({ docs: [], forEach: jest.fn() }) // payments
        .mockResolvedValueOnce({ docs: mockCheques, forEach: (fn: (doc: typeof mockCheques[0]) => void) => mockCheques.forEach(fn) }) // cheques
        .mockResolvedValue({ docs: [], forEach: jest.fn() }); // other queries

      const result = await service.deleteLedgerEntry(mockEntry as any);

      expect(result.success).toBe(true);
    });

    it('should prevent deleting advance with active allocations', async () => {
      const { isAdvanceTransaction } = require('@/components/ledger/utils/ledger-helpers');
      isAdvanceTransaction.mockReturnValue(true);

      const advanceEntry = {
        ...mockEntry,
        category: 'سلفة عميل',
        totalPaid: 500, // Has active allocations
      };

      const result = await service.deleteLedgerEntry(advanceEntry as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('لا يمكن حذف سلفة');
    });

    it('should reverse advance allocations when deleting invoice', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDocs.mockResolvedValue({ docs: [], forEach: jest.fn() });

      const entryWithAdvances = {
        ...mockEntry,
        paidFromAdvances: [
          { advanceId: 'adv-1', amount: 300 },
          { advanceId: 'adv-2', amount: 200 },
        ],
      };

      const result = await service.deleteLedgerEntry(entryWithAdvances as any);

      expect(result.success).toBe(true);
      // Should have called batch.update for each advance
      expect(mockBatch.update).toHaveBeenCalledTimes(2);
    });

    it('should handle data integrity error (negative inventory)', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);
      mockGetDocs.mockResolvedValue({ docs: [], forEach: jest.fn() });
      mockBatch.commit.mockRejectedValue(new Error('DATA_INTEGRITY_ERROR'));

      const result = await service.deleteLedgerEntry(mockEntry as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('سلامة البيانات');
    });
  });

  // ============================================
  // Payment Operations Tests
  // ============================================

  describe('addPaymentToEntry', () => {
    const mockEntry = {
      id: 'entry-123',
      transactionId: 'TXN-123',
      description: 'Invoice',
      amount: 1000,
      type: 'دخل',
      associatedParty: 'Test Client',
      isARAPEntry: true,
      totalPaid: 0,
      remainingBalance: 1000,
    };

    it('should add payment to AR/AP entry', async () => {
      mockRunTransaction.mockImplementation(async (firestore, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              ...mockEntry,
              isARAPEntry: true,
              totalPaid: 0,
              remainingBalance: 1000,
              amount: 1000,
            }),
          }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      const result = await service.addPaymentToEntry(mockEntry as any, {
        amount: '500',
        notes: 'Partial payment',
      } as any);

      expect(result.success).toBe(true);
    });

    it('should reject payment exceeding remaining balance', async () => {
      mockRunTransaction.mockImplementation(async (firestore, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              isARAPEntry: true,
              totalPaid: 800,
              remainingBalance: 200,
              amount: 1000,
            }),
          }),
        };
        return callback(mockTransaction);
      });

      const result = await service.addPaymentToEntry(mockEntry as any, {
        amount: '300', // Exceeds remaining 200
        notes: '',
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('المبلغ المتبقي');
    });

    it('should handle non-existent entry', async () => {
      mockRunTransaction.mockImplementation(async (firestore, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => false,
          }),
        };
        return callback(mockTransaction);
      });

      const result = await service.addPaymentToEntry(mockEntry as any, {
        amount: '500',
        notes: '',
      } as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain('غير موجود');
    });
  });

  describe('addQuickPayment', () => {
    it('should add quick payment with discount', async () => {
      mockRunTransaction.mockImplementation(async (firestore, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              amount: 1000,
              totalPaid: 0,
              totalDiscount: 0,
              remainingBalance: 1000,
              writeoffAmount: 0,
            }),
          }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      const result = await service.addQuickPayment({
        entryId: 'entry-123',
        entryTransactionId: 'TXN-123',
        entryDescription: 'Test invoice',
        entryType: 'دخل',
        entryAmount: 1000,
        entryCategory: 'مبيعات',
        entrySubCategory: '',
        associatedParty: 'Test Client',
        totalPaid: 0,
        remainingBalance: 1000,
        amount: 800,
        discountAmount: 100,
        discountReason: 'Early payment',
        isARAPEntry: true,
      });

      expect(result.success).toBe(true);
    });

    it('should reject payment + discount exceeding remaining', async () => {
      mockRunTransaction.mockImplementation(async (firestore, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              amount: 1000,
              totalPaid: 500,
              totalDiscount: 200,
              remainingBalance: 300,
              writeoffAmount: 0,
            }),
          }),
        };
        return callback(mockTransaction);
      });

      const result = await service.addQuickPayment({
        entryId: 'entry-123',
        entryTransactionId: 'TXN-123',
        entryDescription: 'Test',
        entryType: 'دخل',
        entryAmount: 1000,
        entryCategory: 'مبيعات',
        entrySubCategory: '',
        associatedParty: 'Client',
        totalPaid: 500,
        remainingBalance: 300,
        amount: 200,
        discountAmount: 200, // Total 400 > remaining 300
        isARAPEntry: true,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('أكبر من المتبقي');
    });

    it('should handle loan disbursement payment type', async () => {
      mockRunTransaction.mockImplementation(async (firestore, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              amount: 1000,
              totalPaid: 0,
              totalDiscount: 0,
              remainingBalance: 1000,
              writeoffAmount: 0,
            }),
          }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      const result = await service.addQuickPayment({
        entryId: 'entry-123',
        entryTransactionId: 'TXN-123',
        entryDescription: 'Loan repayment',
        entryType: 'قرض',
        entryAmount: 1000,
        entryCategory: 'قروض مستلمة', // Received loan = disbursement
        entrySubCategory: '',
        associatedParty: 'Bank',
        totalPaid: 0,
        remainingBalance: 1000,
        amount: 500,
        isARAPEntry: true,
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================
  // Write-Off Tests
  // ============================================

  describe('writeOffBadDebt', () => {
    it('should write off bad debt', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const result = await service.writeOffBadDebt({
        entryId: 'entry-123',
        entryTransactionId: 'TXN-123',
        entryDescription: 'Test invoice',
        entryType: 'دخل',
        entryCategory: 'مبيعات',
        associatedParty: 'Bad Client',
        entryAmount: 1000,
        totalPaid: 200,
        totalDiscount: 0,
        remainingBalance: 800,
        currentWriteoff: 0,
        writeoffAmount: 500,
        writeoffReason: 'Client bankrupt',
        writeoffBy: 'test@example.com',
      });

      expect(result.success).toBe(true);
      expect(mockBatch.update).toHaveBeenCalled();
      expect(mockBatch.set).toHaveBeenCalled(); // Payment record
    });

    it('should reject writeoff exceeding remaining balance', async () => {
      const result = await service.writeOffBadDebt({
        entryId: 'entry-123',
        entryTransactionId: 'TXN-123',
        entryDescription: 'Test invoice',
        entryType: 'دخل',
        entryCategory: 'مبيعات',
        associatedParty: 'Client',
        entryAmount: 1000,
        totalPaid: 800,
        totalDiscount: 100,
        remainingBalance: 100,
        currentWriteoff: 0,
        writeoffAmount: 200, // Exceeds remaining 100
        writeoffReason: 'Bad debt',
        writeoffBy: 'user@test.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('أكبر من المتبقي');
    });

    it('should reject zero writeoff amount', async () => {
      const result = await service.writeOffBadDebt({
        entryId: 'entry-123',
        entryTransactionId: 'TXN-123',
        entryDescription: 'Test invoice',
        entryType: 'دخل',
        entryCategory: 'مبيعات',
        associatedParty: 'Client',
        entryAmount: 1000,
        totalPaid: 0,
        totalDiscount: 0,
        remainingBalance: 1000,
        currentWriteoff: 0,
        writeoffAmount: 0,
        writeoffReason: 'Bad debt',
        writeoffBy: 'user@test.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('أكبر من صفر');
    });

    it('should reject empty writeoff reason', async () => {
      const result = await service.writeOffBadDebt({
        entryId: 'entry-123',
        entryTransactionId: 'TXN-123',
        entryDescription: 'Test invoice',
        entryType: 'دخل',
        entryCategory: 'مبيعات',
        associatedParty: 'Client',
        entryAmount: 1000,
        totalPaid: 0,
        totalDiscount: 0,
        remainingBalance: 1000,
        currentWriteoff: 0,
        writeoffAmount: 500,
        writeoffReason: '', // Empty reason
        writeoffBy: 'user@test.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('سبب الشطب مطلوب');
    });
  });

  // ============================================
  // Read Operations Tests
  // ============================================

  describe('subscribeLedgerEntries', () => {
    it('should subscribe to ledger entries', () => {
      const mockUnsubscribe = jest.fn();
      mockOnSnapshot.mockReturnValue(mockUnsubscribe);

      const onData = jest.fn();
      const onError = jest.fn();

      const unsubscribe = service.subscribeLedgerEntries(50, onData, onError);

      expect(mockOnSnapshot).toHaveBeenCalled();
      expect(unsubscribe).toBe(mockUnsubscribe);
    });

    it('should call onData with entries', () => {
      mockOnSnapshot.mockImplementation((query, onNext) => {
        const mockSnapshot = {
          forEach: (fn: Function) => {
            fn({
              id: 'entry-1',
              data: () => ({ description: 'Test', amount: 100 }),
            });
          },
        };
        onNext(mockSnapshot);
        return jest.fn();
      });

      const onData = jest.fn();
      service.subscribeLedgerEntries(50, onData);

      expect(onData).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'entry-1' }),
        ]),
        expect.anything()
      );
    });
  });

  describe('getTotalCount', () => {
    it('should return total count', async () => {
      mockGetCountFromServer.mockResolvedValue({
        data: () => ({ count: 150 }),
      });

      const count = await service.getTotalCount();

      expect(count).toBe(150);
    });
  });

  describe('getAllLedgerEntries', () => {
    it('should return all entries for export', async () => {
      mockGetDocs.mockResolvedValue({
        forEach: (fn: Function) => {
          fn({ id: 'e1', data: () => ({ description: 'Entry 1' }) });
          fn({ id: 'e2', data: () => ({ description: 'Entry 2' }) });
        },
      });

      const entries = await service.getAllLedgerEntries();

      expect(entries).toHaveLength(2);
      expect(entries[0].id).toBe('e1');
    });
  });

  // ============================================
  // Edge Cases and Error Handling
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty associated party', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({ associatedParty: '' });

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(true);
    });

    it('should handle very large amounts', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({ amount: '999999999.99' });

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(true);
    });

    it('should handle decimal amounts correctly', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({ amount: '123.456' });

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(true);
    });

    it('should handle Arabic text in description', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({
        description: 'مبيعات للعميل أحمد محمد',
        associatedParty: 'أحمد محمد',
      });

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(true);
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          description: 'مبيعات للعميل أحمد محمد',
        })
      );
    });

    it('should handle special characters in description', async () => {
      const mockBatch = createMockBatch();
      mockWriteBatch.mockReturnValue(mockBatch);

      const formData = createMockFormData({
        description: 'Special chars: @#$%^&*()_+-=[]{}|;\':",./<>?',
      });

      const result = await service.createSimpleLedgerEntry(formData);

      expect(result.success).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should use transaction for payment to prevent race conditions', async () => {
      const mockEntry = {
        id: 'entry-123',
        transactionId: 'TXN-123',
        type: 'دخل',
        amount: 1000,
        isARAPEntry: true,
        remainingBalance: 1000,
      };

      mockRunTransaction.mockImplementation(async (firestore, callback) => {
        const mockTransaction = {
          get: jest.fn().mockResolvedValue({
            exists: () => true,
            data: () => ({
              isARAPEntry: true,
              totalPaid: 0,
              remainingBalance: 1000,
              amount: 1000,
            }),
          }),
          set: jest.fn(),
          update: jest.fn(),
        };
        return callback(mockTransaction);
      });

      await service.addPaymentToEntry(mockEntry as any, { amount: '500', notes: '' } as any);

      // Verify transaction was used instead of batch
      expect(mockRunTransaction).toHaveBeenCalled();
    });
  });
});
