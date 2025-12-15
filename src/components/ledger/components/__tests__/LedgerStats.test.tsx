/**
 * Unit Tests for LedgerStats Component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LedgerStats } from '../LedgerStats';
import { LedgerEntry } from '../../utils/ledger-constants';

describe('LedgerStats', () => {
  const mockOnUnpaidClick = jest.fn();

  const mockIncomeEntry: LedgerEntry = {
    id: '1',
    transactionId: 'TXN-001',
    description: 'مبيعات',
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
    description: 'مصروفات',
    type: 'مصروف',
    amount: 500,
    category: 'مصروفات',
    subCategory: 'رواتب',
    associatedParty: 'مورد أ',
    reference: 'REF-002',
    notes: '',
    date: new Date('2025-01-16'),
    createdAt: new Date('2025-01-16'),
  };

  const mockUnpaidEntry: LedgerEntry = {
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

  const mockEquityEntry: LedgerEntry = {
    id: '4',
    transactionId: 'TXN-004',
    description: 'رأس مال',
    type: 'حركة رأس مال',
    amount: 5000,
    category: 'رأس المال',
    subCategory: 'رأس مال مالك',
    associatedParty: '',
    reference: 'REF-004',
    notes: '',
    date: new Date('2025-01-18'),
    createdAt: new Date('2025-01-18'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render all four stat cards', () => {
    render(<LedgerStats entries={[]} />);

    expect(screen.getByText('إجمالي الدخل')).toBeInTheDocument();
    expect(screen.getByText('إجمالي المصروفات')).toBeInTheDocument();
    expect(screen.getByText('الرصيد الصافي')).toBeInTheDocument();
    expect(screen.getByText('ذمم غير محصلة')).toBeInTheDocument();
  });

  it('should show zero values for empty entries', () => {
    render(<LedgerStats entries={[]} />);

    // Check for "0" appearing in the stats
    const zeroValues = screen.getAllByText('0');
    expect(zeroValues.length).toBeGreaterThanOrEqual(4);
  });

  it('should calculate total income correctly', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      { ...mockIncomeEntry, id: '3', amount: 500 },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Total income: 1000 + 500 = 1,500 (specifically in the p.text-emerald-600 value)
    const incomeValue = container.querySelector('p.text-emerald-600');
    expect(incomeValue).toHaveTextContent('1,500');
  });

  it('should calculate total expenses correctly', () => {
    const entries = [
      { ...mockExpenseEntry, amount: 300 },
      { ...mockExpenseEntry, id: '3', amount: 200 },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Total expenses: 300 + 200 = 500 (specifically in the p.text-rose-600 value)
    const expenseValue = container.querySelector('p.text-rose-600');
    expect(expenseValue).toHaveTextContent('500');
  });

  it('should calculate net balance correctly', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      { ...mockExpenseEntry, amount: 400 },
    ];

    render(<LedgerStats entries={entries} />);

    // Net balance should be 1000 - 400 = 600
    expect(screen.getByText('600')).toBeInTheDocument();
  });

  it('should show profit label for positive balance', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      { ...mockExpenseEntry, amount: 400 },
    ];

    render(<LedgerStats entries={entries} />);

    expect(screen.getByText('ربح')).toBeInTheDocument();
  });

  it('should show loss label for negative balance', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 400 },
      { ...mockExpenseEntry, amount: 1000 },
    ];

    render(<LedgerStats entries={entries} />);

    expect(screen.getByText('خسارة')).toBeInTheDocument();
  });

  it('should handle mixed income and expense entries', () => {
    const entries = [
      { ...mockIncomeEntry, id: '1', amount: 1000 },
      { ...mockExpenseEntry, id: '2', amount: 300 },
      { ...mockIncomeEntry, id: '3', amount: 500 },
      { ...mockExpenseEntry, id: '4', amount: 200 },
    ];

    render(<LedgerStats entries={entries} />);

    // Total income: 1000 + 500 = 1,500
    expect(screen.getByText('1,500')).toBeInTheDocument();
    // Total expenses: 300 + 200 = 500
    expect(screen.getByText('500')).toBeInTheDocument();
    // Net balance: 1,500 - 500 = 1,000
    expect(screen.getByText('1,000')).toBeInTheDocument();
  });

  it('should ignore entries with missing amount', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 800 },
      { ...mockIncomeEntry, id: '3', amount: undefined as unknown as number },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Should only count the 800 (specifically in the p.text-emerald-600 income value)
    const incomeValue = container.querySelector('p.text-emerald-600');
    expect(incomeValue).toHaveTextContent('800');
  });

  it('should count unpaid AR/AP entries', () => {
    const entries = [
      mockUnpaidEntry,
      { ...mockUnpaidEntry, id: '4', paymentStatus: 'partial' as const, remainingBalance: 500 },
    ];

    render(<LedgerStats entries={entries} />);

    // Unpaid amount: 2000 + 500 = 2,500
    expect(screen.getByText('2,500')).toBeInTheDocument();
  });

  it('should call onUnpaidClick when unpaid card is clicked', () => {
    render(<LedgerStats entries={[mockUnpaidEntry]} onUnpaidClick={mockOnUnpaidClick} />);

    // Find and click the unpaid card
    const unpaidCard = screen.getByText('ذمم غير محصلة').closest('article');
    if (unpaidCard) {
      fireEvent.click(unpaidCard);
    }

    expect(mockOnUnpaidClick).toHaveBeenCalled();
  });

  it('should show click hint when there are unpaid entries', () => {
    render(<LedgerStats entries={[mockUnpaidEntry]} />);

    expect(screen.getByText('اضغط للعرض ←')).toBeInTheDocument();
  });

  it('should show "no receivables" when no unpaid entries', () => {
    render(<LedgerStats entries={[mockIncomeEntry]} />);

    expect(screen.getByText('لا توجد ذمم')).toBeInTheDocument();
  });

  it('should use emerald theme for income card', () => {
    const { container } = render(<LedgerStats entries={[mockIncomeEntry]} />);

    // Income value should be emerald colored
    const incomeValue = container.querySelector('.text-emerald-600');
    expect(incomeValue).toBeInTheDocument();
  });

  it('should use rose theme for expense card', () => {
    const { container } = render(<LedgerStats entries={[mockExpenseEntry]} />);

    // Expense value should be rose colored
    const expenseValue = container.querySelector('.text-rose-600');
    expect(expenseValue).toBeInTheDocument();
  });

  it('should show unpaid count badge when there are unpaid entries', () => {
    const entries = [
      mockUnpaidEntry,
      { ...mockUnpaidEntry, id: '4', paymentStatus: 'partial' as const },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Count badge should show 2
    const countBadge = container.querySelector('.bg-amber-500');
    expect(countBadge).toBeInTheDocument();
    expect(countBadge).toHaveTextContent('2');
  });

  it('should exclude equity entries from P&L calculations', () => {
    // Equity entries (رأس المال) should NOT be counted in income, expenses, or net balance
    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      { ...mockExpenseEntry, amount: 400 },
      mockEquityEntry, // 5000 - should NOT affect totals
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Income should only be 1000 (not including equity's 5000)
    const incomeValue = container.querySelector('p.text-emerald-600');
    expect(incomeValue).toHaveTextContent('1,000');

    // Expenses should only be 400
    const expenseValue = container.querySelector('p.text-rose-600');
    expect(expenseValue).toHaveTextContent('400');

    // Net balance should be 600 (1000 - 400), not affected by equity
    expect(screen.getByText('600')).toBeInTheDocument();
  });

  it('should exclude equity entries by category (backward compatibility)', () => {
    // Old data might have equity under "رأس المال" category with type "دخل"
    const oldEquityEntry: LedgerEntry = {
      ...mockIncomeEntry,
      id: '5',
      type: 'دخل', // Old format used income type
      category: 'رأس المال', // But category indicates equity
      amount: 3000,
    };

    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      oldEquityEntry, // Should be excluded by category
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Income should only be 1000 (excluding the 3000 equity by category)
    const incomeValue = container.querySelector('p.text-emerald-600');
    expect(incomeValue).toHaveTextContent('1,000');
  });
});
