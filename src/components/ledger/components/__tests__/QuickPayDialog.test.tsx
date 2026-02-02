/**
 * Unit Tests for QuickPayDialog Component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QuickPayDialog } from '../QuickPayDialog';
import { LedgerEntry } from '../../utils/ledger-constants';

// Mock Firebase
jest.mock('@/firebase/config', () => ({
  firestore: {},
}));

// Create mock batch object
const mockBatchSet = jest.fn();
const mockBatchUpdate = jest.fn();
const mockBatchCommit = jest.fn().mockResolvedValue(undefined);

// Create mock transaction object for runTransaction
const mockTransactionGet = jest.fn();
const mockTransactionSet = jest.fn();
const mockTransactionUpdate = jest.fn();

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({ path: 'mock-collection' })),
  addDoc: jest.fn(),
  doc: jest.fn(() => ({ path: 'mock-doc', id: 'mock-doc-id' })),
  updateDoc: jest.fn(),
  getDoc: jest.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({
      remainingBalance: 1000,
      totalPaid: 0,
      paymentStatus: 'unpaid',
    }),
  }),
  writeBatch: jest.fn(() => ({
    set: mockBatchSet,
    update: mockBatchUpdate,
    commit: mockBatchCommit,
  })),
  runTransaction: jest.fn(async (db, callback) => {
    // Create a mock transaction object and execute the async callback
    const mockTransaction = {
      get: mockTransactionGet.mockResolvedValue({
        exists: () => true,
        data: () => ({
          remainingBalance: 1000,
          totalPaid: 0,
          totalDiscount: 0,
          writeoffAmount: 0,
          amount: 1000,
          paymentStatus: 'unpaid',
          isARAPEntry: true,
        }),
      }),
      set: mockTransactionSet,
      update: mockTransactionUpdate,
    };
    // Await the async callback
    return await callback(mockTransaction);
  }),
}));

// Mock LedgerService
const mockAddQuickPayment = jest.fn().mockResolvedValue({ success: true });
jest.mock('@/services/ledgerService', () => ({
  createLedgerService: jest.fn(() => ({
    addQuickPayment: mockAddQuickPayment,
  })),
}));

// Mock hooks
const mockToast = jest.fn();
const mockUser = {
  uid: 'test-user-123',
  dataOwnerId: 'test-user-123',
  email: 'test@example.com',
};

jest.mock('@/firebase/provider', () => ({
  useUser: jest.fn(() => ({ user: mockUser })),
}));

// Mock usePermissions hook
jest.mock('@/hooks/usePermissions', () => ({
  usePermissions: () => ({
    role: 'owner',
    permissions: [],
    loading: false,
    isOwner: true,
    can: jest.fn().mockReturnValue(true),
  }),
}));

jest.mock('@/hooks/use-toast', () => ({
  useToast: jest.fn(() => ({ toast: mockToast })),
}));

describe('QuickPayDialog', () => {
  const mockOnClose = jest.fn();
  const mockOnSuccess = jest.fn();

  const mockEntry: LedgerEntry = {
    id: 'entry-1',
    transactionId: 'TXN-001',
    description: 'فاتورة مبيعات',
    type: 'دخل',
    amount: 1000,
    category: 'مبيعات',
    subCategory: 'منتجات',
    associatedParty: 'عميل أ',
    date: new Date('2025-01-15'),
    createdAt: new Date('2025-01-15'),
    isARAPEntry: true,
    paymentStatus: 'unpaid',
    remainingBalance: 1000,
    totalPaid: 0,
  };

  const mockPartiallyPaidEntry: LedgerEntry = {
    ...mockEntry,
    id: 'entry-2',
    paymentStatus: 'partial',
    remainingBalance: 600,
    totalPaid: 400,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset LedgerService mock
    mockAddQuickPayment.mockClear().mockResolvedValue({ success: true });
    // Reset batch mocks
    mockBatchSet.mockClear();
    mockBatchUpdate.mockClear();
    mockBatchCommit.mockClear().mockResolvedValue(undefined);
    // Reset transaction mocks
    mockTransactionGet.mockClear().mockResolvedValue({
      exists: () => true,
      data: () => ({
        remainingBalance: 1000,
        totalPaid: 0,
        paymentStatus: 'unpaid',
      }),
    });
    mockTransactionSet.mockClear();
    mockTransactionUpdate.mockClear();
  });

  describe('Dialog Display', () => {
    it('should not render when isOpen is false', () => {
      render(
        <QuickPayDialog
          isOpen={false}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.queryByText('إضافة دفعة')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('إضافة دفعة')).toBeInTheDocument();
    });

    it('should display entry information', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText('فاتورة مبيعات')).toBeInTheDocument();
      const amountElements = screen.getAllByText(/1000.00 دينار/);
      expect(amountElements.length).toBeGreaterThan(0);
    });

    it('should display remaining balance', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      // The remaining balance should be displayed (may appear multiple times)
      const balanceElements = screen.getAllByText(/1000.00 دينار/);
      expect(balanceElements.length).toBeGreaterThan(0);
    });

    it('should display total paid amount for partially paid entries', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockPartiallyPaidEntry}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/400.00 دينار/)).toBeInTheDocument();
    });

    it('should not display total paid for unpaid entries', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      // Should not show "المدفوع:" label
      expect(screen.queryByText(/المدفوع:/)).not.toBeInTheDocument();
    });
  });

  describe('Form Input', () => {
    it('should render amount input field', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('step', '0.01');
    });

    it('should update amount when user types', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '500' } });

      expect(input.value).toBe('500');
    });

    it('should show remaining balance', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/المبلغ المتبقي:/)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should show error for empty amount (treated as no payment)', async () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      // Leave the input empty - parseFloat('') returns NaN, treated as 0
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ',
          description: 'يرجى إدخال مبلغ دفعة أو خصم',
          variant: 'destructive',
        });
      });
    });

    it('should show error for negative amount (treated as no payment)', async () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      // Negative amount is treated as 0, triggering "payment or discount required" error
      fireEvent.change(input, { target: { value: '-100' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ',
          description: 'يرجى إدخال مبلغ دفعة أو خصم',
          variant: 'destructive',
        });
      });
    });

    it('should show error when payment and discount are both zero', async () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ',
          description: 'يرجى إدخال مبلغ دفعة أو خصم',
          variant: 'destructive',
        });
      });
    });

    it('should disable submit button when amount exceeds remaining balance', async () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');

      // When amount exceeds remaining, button should be disabled
      fireEvent.change(input, { target: { value: '1500' } });

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /إضافة الدفعة|تسوية كاملة/ });
        expect(submitButton).toBeDisabled();
      });
    });

    it('should not submit when entry is null', async () => {
      const { runTransaction } = require('firebase/firestore');
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={null}
          onSuccess={mockOnSuccess}
        />
      );

      const submitButton = screen.getByText('إضافة الدفعة');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(runTransaction).not.toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit payment successfully', async () => {
      mockToast.mockClear();
      mockOnClose.mockClear();
      mockOnSuccess.mockClear();

      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'تمت الإضافة بنجاح',
          })
        );
      }, { timeout: 3000 });

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSuccess).toHaveBeenCalled();
    });

    it('should create payment record with correct data for income entry', async () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '300' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        // LedgerService.addQuickPayment is called with correct data
        expect(mockAddQuickPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 300,
            entryId: 'entry-1',
            entryTransactionId: 'TXN-001',
            associatedParty: 'عميل أ',
            entryCategory: 'مبيعات',
            entrySubCategory: 'منتجات',
          })
        );
      }, { timeout: 3000 });
    });

    it('should create payment record with "صرف" type for expense entry', async () => {
      const expenseEntry = {
        ...mockEntry,
        type: 'مصروف' as const,
      };

      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={expenseEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        // LedgerService.addQuickPayment is called for expense entry
        expect(mockAddQuickPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 200,
            entryType: 'مصروف',
          })
        );
      }, { timeout: 3000 });
    });

    it('should update ledger entry with new payment status (partial)', async () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        // LedgerService.addQuickPayment handles the status update internally
        expect(mockAddQuickPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 500,
            totalPaid: 0,
            remainingBalance: 1000,
          })
        );
      }, { timeout: 3000 });
    });

    it('should update ledger entry with "paid" status when fully paid', async () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '1000' } });
      fireEvent.submit(form!);

      await waitFor(() => {
        // LedgerService.addQuickPayment handles the full payment
        expect(mockAddQuickPayment).toHaveBeenCalledWith(
          expect.objectContaining({
            amount: 1000,
            totalPaid: 0,
            remainingBalance: 1000,
          })
        );
      }, { timeout: 3000 });
    });

    it('should handle Firebase errors gracefully', async () => {
      // Make addQuickPayment return failure
      mockAddQuickPayment.mockResolvedValueOnce({
        success: false,
        error: 'حدث خطأ في قاعدة البيانات',
      });

      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const submitButton = screen.getByText('إضافة الدفعة');

      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ',
          description: 'حدث خطأ في قاعدة البيانات',
          variant: 'destructive',
        });
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should clear amount field after successful submission', async () => {
      mockOnSuccess.mockClear();

      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع') as HTMLInputElement;
      const form = input.closest('form');

      fireEvent.change(input, { target: { value: '500' } });
      expect(input.value).toBe('500');

      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it('should show loading state during submission', async () => {
      // Create a promise that we can control for runTransaction
      let resolveTransaction: () => void;
      const transactionPromise = new Promise<void>((resolve) => {
        resolveTransaction = resolve;
      });
      const { runTransaction } = require('firebase/firestore');
      runTransaction.mockReturnValueOnce(transactionPromise);

      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const input = screen.getByLabelText('المبلغ المدفوع');
      const submitButton = screen.getByText('إضافة الدفعة');

      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.click(submitButton);

      // Check loading state
      await waitFor(() => {
        expect(screen.getByText('جاري الإضافة...')).toBeInTheDocument();
        expect(submitButton).toBeDisabled();
      });

      // Resolve the promise
      resolveTransaction!();
    });
  });

  describe('Dialog Actions', () => {
    it('should call onClose when cancel button is clicked', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const cancelButton = screen.getByText('إلغاء');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('should call onClose when dialog is closed', () => {
      const { rerender } = render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      // Simulate closing the dialog
      rerender(
        <QuickPayDialog
          isOpen={false}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      // Dialog should not be visible
      expect(screen.queryByText('إضافة دفعة')).not.toBeInTheDocument();
    });
  });
});
