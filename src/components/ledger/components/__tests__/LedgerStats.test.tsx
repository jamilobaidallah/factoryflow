/**
 * Unit Tests for LedgerStats Component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LedgerStats } from '../LedgerStats';
import { LedgerEntry } from '../../utils/ledger-constants';

describe('LedgerStats', () => {
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

  it('should render all three stat cards', () => {
    render(<LedgerStats entries={[]} />);

    expect(screen.getByText('إجمالي الدخل')).toBeInTheDocument();
    expect(screen.getByText('إجمالي المصروفات')).toBeInTheDocument();
    expect(screen.getByText('الرصيد الصافي')).toBeInTheDocument();
  });

  it('should show zero values for empty entries', () => {
    render(<LedgerStats entries={[]} />);

    // Check for "0.00 دينار" appearing 3 times (income, expenses, balance)
    const zeroValues = screen.getAllByText('0.00 دينار');
    expect(zeroValues).toHaveLength(3);
  });

  it('should calculate total income correctly', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      { ...mockIncomeEntry, id: '3', amount: 500 },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Check the income card specifically
    const incomeCard = container.querySelector('.text-green-600');
    expect(incomeCard).toHaveTextContent('1500.00 دينار');
  });

  it('should calculate total expenses correctly', () => {
    const entries = [
      { ...mockExpenseEntry, amount: 300 },
      { ...mockExpenseEntry, id: '3', amount: 200 },
    ];

    render(<LedgerStats entries={entries} />);

    expect(screen.getByText('500.00 دينار')).toBeInTheDocument();
  });

  it('should calculate net balance correctly', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      { ...mockExpenseEntry, amount: 400 },
    ];

    render(<LedgerStats entries={entries} />);

    // Net balance should be 1000 - 400 = 600
    expect(screen.getByText('600.00 دينار')).toBeInTheDocument();
  });

  it('should show positive balance in blue', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 1000 },
      { ...mockExpenseEntry, amount: 400 },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Find the net balance element
    const balanceElement = container.querySelector('.text-blue-600');
    expect(balanceElement).toBeInTheDocument();
    expect(balanceElement).toHaveTextContent('600.00 دينار');
  });

  it('should show negative balance in orange', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 400 },
      { ...mockExpenseEntry, amount: 1000 },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Find the net balance element
    const balanceElement = container.querySelector('.text-orange-600');
    expect(balanceElement).toBeInTheDocument();
    expect(balanceElement).toHaveTextContent('-600.00 دينار');
  });

  it('should handle mixed income and expense entries', () => {
    const entries = [
      { ...mockIncomeEntry, id: '1', amount: 1000 },
      { ...mockExpenseEntry, id: '2', amount: 300 },
      { ...mockIncomeEntry, id: '3', amount: 500 },
      { ...mockExpenseEntry, id: '4', amount: 200 },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Total income: 1000 + 500 = 1500
    // Total expenses: 300 + 200 = 500
    // Net balance: 1500 - 500 = 1000
    expect(screen.getByText('1500.00 دينار')).toBeInTheDocument();
    expect(screen.getByText('500.00 دينار')).toBeInTheDocument();

    // Check net balance specifically
    const balanceCard = container.querySelector('.text-blue-600');
    expect(balanceCard).toHaveTextContent('1000.00 دينار');
  });

  it('should ignore entries with missing amount', () => {
    const entries = [
      { ...mockIncomeEntry, amount: 800 },
      { ...mockIncomeEntry, id: '3', amount: undefined as any },
    ];

    const { container } = render(<LedgerStats entries={entries} />);

    // Should only count the 800 (income section)
    const incomeCards = container.querySelectorAll('.text-green-600');
    expect(incomeCards[0]).toHaveTextContent('800.00 دينار');
  });
});
