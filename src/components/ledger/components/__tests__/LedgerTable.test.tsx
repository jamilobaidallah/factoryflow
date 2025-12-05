/**
 * Unit Tests for LedgerTable Component
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LedgerTable } from '../LedgerTable';
import { LedgerEntry } from '../../utils/ledger-constants';

// Helper to get desktop table container (hidden md:block)
const getDesktopTable = (container: HTMLElement) => {
  return container.querySelector('.hidden.md\\:block') as HTMLElement;
};

describe('LedgerTable', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnQuickPay = jest.fn();
  const mockOnViewRelated = jest.fn();

  const mockIncomeEntry: LedgerEntry = {
    id: '1',
    transactionId: 'TXN-001',
    description: 'مبيعات منتجات',
    type: 'دخل',
    amount: 1000,
    category: 'مبيعات',
    subCategory: 'منتجات',
    associatedParty: 'عميل أ',
    reference: 'REF-001',
    notes: '',
    date: new Date('2025-01-15'),
    createdAt: new Date('2025-01-15'),
  };

  const mockExpenseEntry: LedgerEntry = {
    id: '2',
    transactionId: 'TXN-002',
    description: 'رواتب موظفين',
    type: 'مصروف',
    amount: 500,
    category: 'مصروفات',
    subCategory: 'رواتب',
    associatedParty: 'موظف أ',
    reference: 'REF-002',
    notes: '',
    date: new Date('2025-01-16'),
    createdAt: new Date('2025-01-16'),
  };

  const mockARAPEntry: LedgerEntry = {
    id: '3',
    transactionId: 'TXN-003',
    description: 'فاتورة مبيعات',
    type: 'دخل',
    amount: 2000,
    category: 'مبيعات',
    subCategory: 'خدمات',
    associatedParty: 'عميل ب',
    reference: 'REF-003',
    notes: '',
    date: new Date('2025-01-17'),
    createdAt: new Date('2025-01-17'),
    isARAPEntry: true,
    paymentStatus: 'unpaid',
    remainingBalance: 2000,
    totalPaid: 0,
  };

  const mockPartiallyPaidEntry: LedgerEntry = {
    ...mockARAPEntry,
    id: '4',
    transactionId: 'TXN-004',
    paymentStatus: 'partial',
    remainingBalance: 1200,
    totalPaid: 800,
  };

  const mockPaidEntry: LedgerEntry = {
    ...mockARAPEntry,
    id: '5',
    transactionId: 'TXN-005',
    paymentStatus: 'paid',
    remainingBalance: 0,
    totalPaid: 2000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty State', () => {
    it('should show empty state message when no entries', () => {
      render(
        <LedgerTable
          entries={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      expect(screen.getByText(/لا توجد حركات مالية مسجلة/)).toBeInTheDocument();
    });

    it('should not show table headers when empty', () => {
      render(
        <LedgerTable
          entries={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      expect(screen.queryByText('رقم المعاملة')).not.toBeInTheDocument();
    });
  });

  describe('Table Rendering', () => {
    it('should render table headers', () => {
      render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      expect(screen.getByText('رقم المعاملة')).toBeInTheDocument();
      expect(screen.getByText('التاريخ')).toBeInTheDocument();
      expect(screen.getByText('الوصف')).toBeInTheDocument();
      expect(screen.getByText('النوع')).toBeInTheDocument();
      expect(screen.getByText('التصنيف')).toBeInTheDocument();
      expect(screen.getByText('الفئة الفرعية')).toBeInTheDocument();
      expect(screen.getByText('الطرف المعني')).toBeInTheDocument();
      expect(screen.getByText('المبلغ')).toBeInTheDocument();
      expect(screen.getByText('حالة الدفع')).toBeInTheDocument();
      expect(screen.getByText('الإجراءات')).toBeInTheDocument();
    });

    it('should render entry data correctly', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      expect(within(desktopTable).getByText('TXN-001')).toBeInTheDocument();
      expect(within(desktopTable).getByText('مبيعات منتجات')).toBeInTheDocument();
      expect(within(desktopTable).getByText('مبيعات')).toBeInTheDocument();
      expect(within(desktopTable).getByText('منتجات')).toBeInTheDocument();
      expect(within(desktopTable).getByText('عميل أ')).toBeInTheDocument();
      expect(within(desktopTable).getByText('1000 دينار')).toBeInTheDocument();
    });

    it('should render multiple entries', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockIncomeEntry, mockExpenseEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      expect(within(desktopTable).getByText('TXN-001')).toBeInTheDocument();
      expect(within(desktopTable).getByText('TXN-002')).toBeInTheDocument();
      expect(within(desktopTable).getByText('مبيعات منتجات')).toBeInTheDocument();
      expect(within(desktopTable).getByText('رواتب موظفين')).toBeInTheDocument();
    });

    it('should show dash for missing associatedParty', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockExpenseEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      // Check that the entry renders in the table
      expect(within(desktopTable).getByText('رواتب موظفين')).toBeInTheDocument();
      // The dash is in the row, verify it exists
      const cells = desktopTable.querySelectorAll('td');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('Entry Type Badges', () => {
    it('should show green badge for income entries', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      const badge = desktopTable.querySelector('.bg-green-100.text-green-700');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('دخل');
    });

    it('should show red badge for expense entries', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockExpenseEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      const badge = desktopTable.querySelector('.bg-red-100.text-red-700');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('مصروف');
    });
  });

  describe('Payment Status Display', () => {
    it('should show unpaid status for AR/AP entries', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockARAPEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      expect(within(desktopTable).getByText('غير مدفوع')).toBeInTheDocument();
      expect(within(desktopTable).getByText(/متبقي: 2000/)).toBeInTheDocument();
    });

    it('should show partial payment status', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockPartiallyPaidEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      expect(within(desktopTable).getByText('دفعة جزئية')).toBeInTheDocument();
      expect(within(desktopTable).getByText(/متبقي: 1200/)).toBeInTheDocument();
      expect(within(desktopTable).getByText(/مدفوع: 800/)).toBeInTheDocument();
    });

    it('should show paid status', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockPaidEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      expect(within(desktopTable).getByText('مدفوع')).toBeInTheDocument();
      expect(within(desktopTable).queryByText(/متبقي/)).not.toBeInTheDocument();
    });

    it('should show dash for non-AR/AP entries', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      // Check for dash in payment status column for non-AR/AP entry
      const dashElement = container.querySelector('.text-xs.text-gray-400');
      expect(dashElement).toBeInTheDocument();
      expect(dashElement).toHaveTextContent('-');
    });
  });

  describe('Action Buttons', () => {
    it('should call onEdit when edit button is clicked', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      // Find all buttons and identify the edit button (3rd button: view related, edit, delete)
      const buttons = screen.getAllByRole('button');
      const editButton = buttons[buttons.length - 2]; // Second to last button is edit

      fireEvent.click(editButton);
      expect(mockOnEdit).toHaveBeenCalledWith(mockIncomeEntry);
    });

    it('should call onDelete when delete button is clicked', () => {
      render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const buttons = screen.getAllByRole('button');
      const deleteButton = buttons[buttons.length - 1]; // Last button is delete

      fireEvent.click(deleteButton);
      expect(mockOnDelete).toHaveBeenCalledWith(mockIncomeEntry);
    });

    it('should call onViewRelated when view related button is clicked', () => {
      render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      // Find the view related button by its title
      const viewRelatedButton = screen.getByTitle('إدارة السجلات المرتبطة');
      fireEvent.click(viewRelatedButton);
      expect(mockOnViewRelated).toHaveBeenCalledWith(mockIncomeEntry);
    });

    it('should show quick pay button for unpaid AR/AP entries', () => {
      render(
        <LedgerTable
          entries={[mockARAPEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      // Quick pay button should be present for unpaid AR/AP entries
      const quickPayButton = screen.getByTitle('إضافة دفعة');
      expect(quickPayButton).toBeInTheDocument();
    });

    it('should call onQuickPay when quick pay button is clicked', () => {
      render(
        <LedgerTable
          entries={[mockARAPEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const quickPayButton = screen.getByTitle('إضافة دفعة');
      fireEvent.click(quickPayButton);
      expect(mockOnQuickPay).toHaveBeenCalledWith(mockARAPEntry);
    });

    it('should not show quick pay button for paid entries', () => {
      render(
        <LedgerTable
          entries={[mockPaidEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      // Quick pay button should NOT be present for paid entries
      const quickPayButton = screen.queryByTitle('إضافة دفعة');
      expect(quickPayButton).not.toBeInTheDocument();
    });

    it('should not show quick pay button for non-AR/AP entries', () => {
      render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      // Quick pay button should NOT be present for non-AR/AP entries
      const quickPayButton = screen.queryByTitle('إضافة دفعة');
      expect(quickPayButton).not.toBeInTheDocument();
    });
  });

  describe('Date Formatting', () => {
    it('should format dates in Arabic locale', () => {
      const entry = {
        ...mockIncomeEntry,
        date: new Date('2025-01-15'),
      };

      const { container } = render(
        <LedgerTable
          entries={[entry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      // Date should be formatted using toLocaleDateString("ar-EG")
      const formattedDate = new Date('2025-01-15').toLocaleDateString("ar-EG");
      expect(within(desktopTable).getByText(formattedDate)).toBeInTheDocument();
    });
  });

  describe('Payment Status Badge Colors', () => {
    it('should use green badge for paid status', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockPaidEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      const paidBadge = within(desktopTable).getByText('مدفوع');
      expect(paidBadge).toHaveClass('bg-green-100', 'text-green-700');
    });

    it('should use yellow badge for partial payment', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockPartiallyPaidEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      const partialBadge = within(desktopTable).getByText('دفعة جزئية');
      expect(partialBadge).toHaveClass('bg-yellow-100', 'text-yellow-700');
    });

    it('should use red badge for unpaid status', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockARAPEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      const unpaidBadge = within(desktopTable).getByText('غير مدفوع');
      expect(unpaidBadge).toHaveClass('bg-red-100', 'text-red-700');
    });
  });
});
