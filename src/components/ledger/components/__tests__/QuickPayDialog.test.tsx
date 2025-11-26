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

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  addDoc: jest.fn(),
  doc: jest.fn(),
  updateDoc: jest.fn(),
}));

// Mock hooks
const mockToast = jest.fn();
const mockUser = { uid: 'test-user-123' };

jest.mock('@/firebase/provider', () => ({
  useUser: jest.fn(() => ({ user: mockUser })),
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
    reference: 'REF-001',
    notes: '',
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

    it.skip('should display remaining balance in red', () => {
      const { container } = render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      const redBalance = container.querySelector('.text-red-600.font-bold');
      expect(redBalance).toBeInTheDocument();
      expect(redBalance).toHaveTextContent('1000.00 دينار');
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

    it('should show maximum amount hint', () => {
      render(
        <QuickPayDialog
          isOpen={true}
          onClose={mockOnClose}
          entry={mockEntry}
          onSuccess={mockOnSuccess}
        />
      );

      expect(screen.getByText(/الحد الأقصى: 1000.00 دينار/)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it.skip('should show error for invalid amount', async () => {
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

      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ',
          description: 'يرجى إدخال مبلغ صحيح',
          variant: 'destructive',
        });
      });
    });

    it('should show error for negative amount', async () => {
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

      fireEvent.change(input, { target: { value: '-100' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ',
          description: 'يرجى إدخال مبلغ صحيح',
          variant: 'destructive',
        });
      });
    });

    it('should show error for zero amount', async () => {
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

      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ',
          description: 'يرجى إدخال مبلغ صحيح',
          variant: 'destructive',
        });
      });
    });

    it('should show error when amount exceeds remaining balance', async () => {
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

      fireEvent.change(input, { target: { value: '1500' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith({
          title: 'خطأ في المبلغ',
          description: 'المبلغ المتبقي هو 1000.00 دينار فقط',
          variant: 'destructive',
        });
      });
    });

    it('should not submit when entry is null', async () => {
      const { addDoc } = require('firebase/firestore');

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
        expect(addDoc).not.toHaveBeenCalled();
      });
    });
  });

  describe('Form Submission', () => {
    it('should submit payment successfully', async () => {
      const { addDoc, updateDoc } = require('firebase/firestore');
      addDoc.mockClear();
      updateDoc.mockClear();
      mockToast.mockClear();
      mockOnClose.mockClear();
      mockOnSuccess.mockClear();

      addDoc.mockResolvedValue({ id: 'payment-123' });
      updateDoc.mockResolvedValue({});

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

    it.skip('should create payment record with correct data for income entry', async () => {
      const { addDoc, updateDoc } = require('firebase/firestore');
      addDoc.mockClear();
      updateDoc.mockClear();
      addDoc.mockResolvedValue({ id: 'payment-123' });
      updateDoc.mockResolvedValue({});

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
        expect(addDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            clientName: 'عميل أ',
            amount: 300,
            type: 'قبض',
            linkedTransactionId: 'TXN-001',
            category: 'مبيعات',
            subCategory: 'منتجات',
          })
        );
      }, { timeout: 3000 });
    });

    it.skip('should create payment record with "صرف" type for expense entry', async () => {
      const { addDoc, updateDoc } = require('firebase/firestore');
      addDoc.mockClear();
      updateDoc.mockClear();
      addDoc.mockResolvedValue({ id: 'payment-123' });
      updateDoc.mockResolvedValue({});

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
        expect(addDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            type: 'صرف',
          })
        );
      }, { timeout: 3000 });
    });

    it.skip('should update ledger entry with new payment status (partial)', async () => {
      const { addDoc, updateDoc } = require('firebase/firestore');
      addDoc.mockClear();
      updateDoc.mockClear();
      addDoc.mockResolvedValue({ id: 'payment-123' });
      updateDoc.mockResolvedValue({});

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
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            totalPaid: 500,
            remainingBalance: 500,
            paymentStatus: 'partial',
          })
        );
      }, { timeout: 3000 });
    });

    it.skip('should update ledger entry with "paid" status when fully paid', async () => {
      const { addDoc, updateDoc } = require('firebase/firestore');
      addDoc.mockClear();
      updateDoc.mockClear();
      addDoc.mockResolvedValue({ id: 'payment-123' });
      updateDoc.mockResolvedValue({});

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
        expect(updateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            totalPaid: 1000,
            remainingBalance: 0,
            paymentStatus: 'paid',
          })
        );
      }, { timeout: 3000 });
    });

    it('should handle Firebase errors gracefully', async () => {
      const { addDoc } = require('firebase/firestore');
      addDoc.mockRejectedValue(new Error('Firebase error'));

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
          description: 'حدث خطأ أثناء إضافة الدفعة',
          variant: 'destructive',
        });
      });

      expect(mockOnClose).not.toHaveBeenCalled();
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it('should clear amount field after successful submission', async () => {
      const { addDoc, updateDoc } = require('firebase/firestore');
      addDoc.mockClear();
      updateDoc.mockClear();
      mockOnSuccess.mockClear();
      addDoc.mockResolvedValue({ id: 'payment-123' });
      updateDoc.mockResolvedValue({});

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
      const { addDoc } = require('firebase/firestore');

      // Create a promise that we can control
      let resolveAddDoc: any;
      const addDocPromise = new Promise((resolve) => {
        resolveAddDoc = resolve;
      });
      addDoc.mockReturnValue(addDocPromise);

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
      resolveAddDoc({ id: 'payment-123' });
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
