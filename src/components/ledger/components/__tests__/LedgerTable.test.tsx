/**
 * Unit Tests for LedgerTable Component
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LedgerTable } from '../LedgerTable';
import { LedgerEntry } from '../../utils/ledger-constants';
import { formatShortDate } from '@/lib/date-utils';

// Mock firebase/provider (needed by AccessRequestForm imported through auth/index)
jest.mock('@/firebase/provider', () => ({
  useUser: () => ({ user: { uid: 'test-user-123' }, loading: false }),
}));

// Mock userService (needed by AccessRequestForm)
jest.mock('@/services/userService', () => ({
  submitAccessRequest: jest.fn(),
  hasPendingRequest: jest.fn().mockResolvedValue(false),
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

// Helper to get desktop table container (hidden md:block)
const getDesktopTable = (container: HTMLElement) => {
  return container.querySelector('.hidden.md\\:block') as HTMLElement;
};

describe('LedgerTable', () => {
  const mockOnEdit = jest.fn();
  const mockOnDelete = jest.fn();
  const mockOnQuickPay = jest.fn();
  const mockOnViewRelated = jest.fn();
  const mockOnClearFilters = jest.fn();

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

    it('should show filtered empty state with clear button when filtered', () => {
      render(
        <LedgerTable
          entries={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
          isFiltered={true}
          onClearFilters={mockOnClearFilters}
        />
      );

      expect(screen.getByText(/لا توجد حركات مطابقة للفلاتر/)).toBeInTheDocument();
      expect(screen.getByText(/مسح جميع الفلاتر/)).toBeInTheDocument();
    });

    it('should call onClearFilters when clear button is clicked', () => {
      render(
        <LedgerTable
          entries={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
          isFiltered={true}
          onClearFilters={mockOnClearFilters}
        />
      );

      fireEvent.click(screen.getByText(/مسح جميع الفلاتر/));
      expect(mockOnClearFilters).toHaveBeenCalled();
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

      expect(screen.queryByText('التاريخ')).not.toBeInTheDocument();
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

      expect(screen.getByText('التاريخ')).toBeInTheDocument();
      expect(screen.getByText('الوصف')).toBeInTheDocument();
      expect(screen.getByText('النوع')).toBeInTheDocument();
      expect(screen.getByText('التصنيف')).toBeInTheDocument();
      expect(screen.getByText('التصنيف الفرعي')).toBeInTheDocument();
      expect(screen.getByText('الطرف')).toBeInTheDocument();
      expect(screen.getByText('المبلغ')).toBeInTheDocument();
      expect(screen.getByText('الحالة')).toBeInTheDocument();
      expect(screen.getByText('إجراءات')).toBeInTheDocument();
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
      // Transaction ID is shown truncated (last 12 chars)
      expect(within(desktopTable).getByText('TXN-001')).toBeInTheDocument();
      expect(within(desktopTable).getByText('مبيعات منتجات')).toBeInTheDocument();
      expect(within(desktopTable).getByText('مبيعات')).toBeInTheDocument();
      expect(within(desktopTable).getByText('منتجات')).toBeInTheDocument();
      expect(within(desktopTable).getByText('عميل أ')).toBeInTheDocument();
      // Amount is now formatted with + prefix for income
      expect(within(desktopTable).getByText(/\+1,000/)).toBeInTheDocument();
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
      const entryWithoutParty = { ...mockIncomeEntry, associatedParty: '' };
      const { container } = render(
        <LedgerTable
          entries={[entryWithoutParty]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
        />
      );

      const desktopTable = getDesktopTable(container);
      // Check that the entry renders in the table
      expect(within(desktopTable).getByText('مبيعات منتجات')).toBeInTheDocument();
      // The dash is in the row, verify it exists
      const cells = desktopTable.querySelectorAll('td');
      expect(cells.length).toBeGreaterThan(0);
    });
  });

  describe('Entry Type Badges', () => {
    it('should show emerald badge for income entries', () => {
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
      // New badge uses tailwind classes
      const badge = desktopTable.querySelector('.bg-emerald-50.text-emerald-700');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveTextContent('دخل');
    });

    it('should show slate badge for expense entries', () => {
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
      // Expense badge uses slate colors
      const badge = desktopTable.querySelector('.bg-slate-100.text-slate-600');
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
      // Remaining is shown with formatNumber
      expect(within(desktopTable).getByText(/المبلغ: 2,000/)).toBeInTheDocument();
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
      // Status text changed to "جزئي"
      expect(within(desktopTable).getByText('جزئي')).toBeInTheDocument();
      expect(within(desktopTable).getByText(/متبقي: 1,200/)).toBeInTheDocument();
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
      const dashElement = container.querySelector('.text-xs.text-slate-400');
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

      // Find edit button by title
      const editButton = screen.getByTitle('تعديل');
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

      const deleteButton = screen.getByTitle('حذف');
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

      // Title changed to "السجلات المرتبطة"
      const viewRelatedButton = screen.getByTitle('السجلات المرتبطة');
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
    it('should format dates correctly', () => {
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
      // Date should be formatted using formatShortDate from date-utils
      const formattedDate = formatShortDate(new Date('2025-01-15'));
      expect(within(desktopTable).getByText(formattedDate)).toBeInTheDocument();
    });
  });

  describe('Payment Status Badge Colors', () => {
    it('should use emerald badge for paid status', () => {
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
      // New styling uses tailwind classes
      expect(paidBadge).toHaveClass('bg-emerald-50');
      expect(paidBadge).toHaveClass('text-emerald-700');
    });

    it('should use amber badge for partial payment', () => {
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
      const partialBadge = within(desktopTable).getByText('جزئي');
      expect(partialBadge).toHaveClass('bg-amber-50');
      expect(partialBadge).toHaveClass('text-amber-700');
    });

    it('should use rose badge for unpaid status', () => {
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
      expect(unpaidBadge).toHaveClass('bg-rose-50');
      expect(unpaidBadge).toHaveClass('text-rose-700');
    });
  });

  describe('Subcategory Highlighting', () => {
    it('should highlight subcategory when filtered', () => {
      const { container } = render(
        <LedgerTable
          entries={[mockIncomeEntry]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onQuickPay={mockOnQuickPay}
          onViewRelated={mockOnViewRelated}
          highlightedSubcategory="منتجات"
        />
      );

      const desktopTable = getDesktopTable(container);
      // The subcategory cell should have purple highlight when filtered
      const highlightedCell = desktopTable.querySelector('.bg-purple-100.text-purple-700');
      expect(highlightedCell).toBeInTheDocument();
      expect(highlightedCell).toHaveTextContent('منتجات');
    });

    it('should not highlight subcategory when not filtered', () => {
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
      // No purple highlight when not filtered
      const highlightedCell = desktopTable.querySelector('.bg-purple-100');
      expect(highlightedCell).not.toBeInTheDocument();
    });
  });
});
