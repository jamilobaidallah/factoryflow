/**
 * Unit Tests for LedgerStats Component
 *
 * Note: LedgerStats now only shows the Unpaid Receivables card.
 * Income/Expense/Net Balance stats are shown on Dashboard and Reports pages instead.
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

  it('should render the unpaid receivables card', () => {
    render(<LedgerStats entries={[]} />);

    expect(screen.getByText('ذمم غير محصلة')).toBeInTheDocument();
  });

  it('should show zero for empty entries', () => {
    render(<LedgerStats entries={[]} />);

    // Check for "0" appearing in the unpaid amount
    expect(screen.getByText('0')).toBeInTheDocument();
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

  it('should call onUnpaidClick when pressing Enter on the card', () => {
    render(<LedgerStats entries={[mockUnpaidEntry]} onUnpaidClick={mockOnUnpaidClick} />);

    const unpaidCard = screen.getByText('ذمم غير محصلة').closest('article');
    if (unpaidCard) {
      fireEvent.keyDown(unpaidCard, { key: 'Enter' });
    }

    expect(mockOnUnpaidClick).toHaveBeenCalled();
  });

  it('should call onUnpaidClick when pressing Space on the card', () => {
    render(<LedgerStats entries={[mockUnpaidEntry]} onUnpaidClick={mockOnUnpaidClick} />);

    const unpaidCard = screen.getByText('ذمم غير محصلة').closest('article');
    if (unpaidCard) {
      fireEvent.keyDown(unpaidCard, { key: ' ' });
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

  it('should not show count badge when no unpaid entries', () => {
    const { container } = render(<LedgerStats entries={[mockIncomeEntry]} />);

    // Count badge should not exist
    const countBadge = container.querySelector('.bg-amber-500');
    expect(countBadge).not.toBeInTheDocument();
  });

  it('should exclude paid entries from unpaid count', () => {
    const paidEntry: LedgerEntry = {
      ...mockUnpaidEntry,
      id: '5',
      paymentStatus: 'paid',
      remainingBalance: 0,
      totalPaid: 2000,
    };

    const entries = [mockUnpaidEntry, paidEntry];

    render(<LedgerStats entries={entries} />);

    // Only mockUnpaidEntry (2000) should be counted
    expect(screen.getByText('2,000')).toBeInTheDocument();
  });

  it('should exclude equity entries from unpaid receivables', () => {
    // Equity entries should not be counted in unpaid receivables
    const equityWithARAP: LedgerEntry = {
      ...mockEquityEntry,
      isARAPEntry: true,
      paymentStatus: 'unpaid',
      remainingBalance: 5000,
    };

    const entries = [mockUnpaidEntry, equityWithARAP];

    render(<LedgerStats entries={entries} />);

    // Only mockUnpaidEntry (2000) should be counted, not equity
    expect(screen.getByText('2,000')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<LedgerStats entries={[mockUnpaidEntry]} onUnpaidClick={mockOnUnpaidClick} />);

    const unpaidCard = screen.getByText('ذمم غير محصلة').closest('article');
    expect(unpaidCard).toHaveAttribute('role', 'button');
    expect(unpaidCard).toHaveAttribute('tabIndex', '0');
    expect(unpaidCard).toHaveAttribute('aria-label');
  });

  it('should handle entries with missing remainingBalance', () => {
    const entryWithoutBalance: LedgerEntry = {
      ...mockUnpaidEntry,
      remainingBalance: undefined as unknown as number,
    };

    render(<LedgerStats entries={[entryWithoutBalance]} />);

    // Should default to 0 for undefined remainingBalance
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
