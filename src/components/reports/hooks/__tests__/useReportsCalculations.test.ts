/**
 * Unit Tests for useReportsCalculations Hook
 * Tests all financial calculation logic for reports
 */

import { renderHook } from '@testing-library/react';
import { useReportsCalculations } from '../useReportsCalculations';

describe('useReportsCalculations', () => {
  // Sample test data
  const mockLedgerEntries = [
    {
      id: '1',
      transactionId: 'TX-001',
      description: 'مبيعات منتج أ',
      type: 'دخل',
      amount: 5000,
      category: 'إيرادات المبيعات',
      subCategory: 'مبيعات نقدية',
      associatedParty: 'عميل 1',
      date: new Date('2024-01-15'),
    },
    {
      id: '2',
      transactionId: 'TX-002',
      description: 'رواتب شهر يناير',
      type: 'مصروف',
      amount: 2000,
      category: 'رواتب',
      subCategory: 'رواتب شهرية',
      associatedParty: 'موظف 1',
      date: new Date('2024-01-20'),
    },
    {
      id: '3',
      transactionId: 'TX-003',
      description: 'رأس مال مالك',
      type: 'دخل',
      amount: 10000,
      category: 'رأس المال',
      subCategory: 'استثمار',
      associatedParty: 'المالك',
      date: new Date('2024-01-01'),
    },
    {
      id: '4',
      transactionId: 'TX-004',
      description: 'سحب شخصي',
      type: 'مصروف',
      amount: 1000,
      category: 'رأس المال',
      subCategory: 'سحب',
      associatedParty: 'المالك',
      date: new Date('2024-01-10'),
    },
    {
      id: '5',
      transactionId: 'TX-005',
      description: 'تكلفة بضاعة',
      type: 'مصروف',
      amount: 3000,
      category: 'تكلفة البضاعة المباعة (COGS)',
      subCategory: 'مشتريات',
      associatedParty: 'مورد 1',
      date: new Date('2024-01-12'),
    },
  ];

  const mockPayments = [
    {
      id: 'p1',
      amount: 5000,
      type: 'قبض',
      date: new Date('2024-01-15'),
      linkedTransactionId: 'TX-001',
    },
    {
      id: 'p2',
      amount: 2000,
      type: 'صرف',
      date: new Date('2024-01-20'),
      linkedTransactionId: 'TX-002',
    },
    {
      id: 'p3',
      amount: 1000,
      type: 'قبض',
      date: new Date('2024-01-25'),
      isEndorsement: true, // Should be excluded
    },
    {
      id: 'p4',
      amount: 500,
      type: 'صرف',
      date: new Date('2024-01-26'),
      noCashMovement: true, // Should be excluded
    },
  ];

  const mockInventory = [
    {
      id: 'inv1',
      itemName: 'ورق مقوى',
      quantity: 100,
      unitPrice: 50,
      unit: 'طن',
      category: 'مواد خام',
    },
    {
      id: 'inv2',
      itemName: 'حبر طباعة',
      quantity: 5, // Low stock
      unitPrice: 200,
      unit: 'لتر',
      category: 'مستهلكات',
    },
  ];

  const mockFixedAssets = [
    {
      id: 'fa1',
      assetName: 'ماكينة طباعة',
      category: 'آلات',
      purchaseCost: 50000,
      accumulatedDepreciation: 5000,
      bookValue: 45000,
      monthlyDepreciation: 500,
      status: 'active',
    },
    {
      id: 'fa2',
      assetName: 'سيارة نقل',
      category: 'مركبات',
      purchaseCost: 30000,
      accumulatedDepreciation: 10000,
      bookValue: 20000,
      monthlyDepreciation: 400,
      status: 'active',
    },
    {
      id: 'fa3',
      assetName: 'حاسوب قديم',
      category: 'أجهزة',
      purchaseCost: 2000,
      accumulatedDepreciation: 2000,
      bookValue: 0,
      monthlyDepreciation: 0,
      status: 'disposed', // Should be excluded from active
    },
  ];

  describe('Owner Equity Calculation', () => {
    it('should calculate owner investments correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.ownerEquity.ownerInvestments).toBe(10000);
    });

    it('should calculate owner withdrawals correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.ownerEquity.ownerWithdrawals).toBe(1000);
    });

    it('should calculate net owner equity correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.ownerEquity.netOwnerEquity).toBe(9000); // 10000 - 1000
    });

    it('should handle Owner Equity category in English', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Capital Investment',
          type: 'دخل',
          amount: 5000,
          category: 'Owner Equity',
          subCategory: '',
          associatedParty: 'Owner',
          date: new Date(),
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.ownerEquity.ownerInvestments).toBe(5000);
    });
  });

  describe('Income Statement Calculation', () => {
    it('should calculate total revenue excluding owner equity', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      // Only TX-001 (5000) is revenue, TX-003 is owner equity (excluded)
      expect(result.current.incomeStatement.totalRevenue).toBe(5000);
    });

    it('should calculate total expenses excluding owner equity', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      // TX-002 (2000) + TX-005 (3000) = 5000, TX-004 is owner equity (excluded)
      expect(result.current.incomeStatement.totalExpenses).toBe(5000);
    });

    it('should calculate net profit correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      // Revenue (5000) - Expenses (5000) = 0
      expect(result.current.incomeStatement.netProfit).toBe(0);
    });

    it('should calculate profit margin correctly', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Revenue',
          type: 'دخل',
          amount: 10000,
          category: 'مبيعات',
          subCategory: '',
          associatedParty: '',
          date: new Date(),
        },
        {
          id: '2',
          transactionId: 'TX-002',
          description: 'Expense',
          type: 'مصروف',
          amount: 3000,
          category: 'مصاريف',
          subCategory: '',
          associatedParty: '',
          date: new Date(),
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      // (10000 - 3000) / 10000 * 100 = 70%
      expect(result.current.incomeStatement.profitMargin).toBe(70);
    });

    it('should handle zero revenue (avoid division by zero)', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.incomeStatement.profitMargin).toBe(0);
    });

    it('should group revenue by category', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.incomeStatement.revenueByCategory['إيرادات المبيعات']).toBe(5000);
    });

    it('should group expenses by category', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.incomeStatement.expensesByCategory['رواتب']).toBe(2000);
      expect(result.current.incomeStatement.expensesByCategory['تكلفة البضاعة المباعة (COGS)']).toBe(3000);
    });
  });

  describe('Cash Flow Calculation', () => {
    it('should calculate cash in correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: mockPayments,
          inventory: [],
          fixedAssets: [],
        })
      );

      // Only p1 (5000) is قبض and not excluded
      expect(result.current.cashFlow.cashIn).toBe(5000);
    });

    it('should calculate cash out correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: mockPayments,
          inventory: [],
          fixedAssets: [],
        })
      );

      // Only p2 (2000) is صرف and not excluded
      expect(result.current.cashFlow.cashOut).toBe(2000);
    });

    it('should calculate net cash flow correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: mockPayments,
          inventory: [],
          fixedAssets: [],
        })
      );

      // 5000 - 2000 = 3000
      expect(result.current.cashFlow.netCashFlow).toBe(3000);
    });

    it('should exclude endorsed cheques from cash flow', () => {
      const payments = [
        { id: 'p1', amount: 1000, type: 'قبض', date: new Date(), isEndorsement: true },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments,
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.cashFlow.cashIn).toBe(0);
    });

    it('should exclude no-cash-movement payments', () => {
      const payments = [
        { id: 'p1', amount: 1000, type: 'صرف', date: new Date(), noCashMovement: true },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments,
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.cashFlow.cashOut).toBe(0);
    });
  });

  describe('AR/AP Aging Calculation', () => {
    it('should identify receivables correctly', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Sale',
          type: 'دخل',
          amount: 1000,
          category: 'مبيعات',
          subCategory: '',
          associatedParty: 'Client',
          date: new Date(),
          isARAPEntry: true,
          paymentStatus: 'partial' as const,
          remainingBalance: 500,
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.arapAging.receivables.length).toBe(1);
      expect(result.current.arapAging.totalReceivables).toBe(500);
    });

    it('should identify payables correctly', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Purchase',
          type: 'مصروف',
          amount: 2000,
          category: 'مشتريات',
          subCategory: '',
          associatedParty: 'Supplier',
          date: new Date(),
          isARAPEntry: true,
          paymentStatus: 'unpaid' as const,
          remainingBalance: 2000,
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.arapAging.payables.length).toBe(1);
      expect(result.current.arapAging.totalPayables).toBe(2000);
    });

    it('should exclude paid entries from AR/AP', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Sale',
          type: 'دخل',
          amount: 1000,
          category: 'مبيعات',
          subCategory: '',
          associatedParty: 'Client',
          date: new Date(),
          isARAPEntry: true,
          paymentStatus: 'paid' as const,
          remainingBalance: 0,
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.arapAging.receivables.length).toBe(0);
    });

    it('should calculate aging buckets correctly', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      const getAgingBucket = result.current.arapAging.getAgingBucket;

      // Test different aging periods
      const today = new Date();

      const date10DaysAgo = new Date(today);
      date10DaysAgo.setDate(today.getDate() - 10);
      expect(getAgingBucket(date10DaysAgo)).toBe('0-30 يوم');

      const date45DaysAgo = new Date(today);
      date45DaysAgo.setDate(today.getDate() - 45);
      expect(getAgingBucket(date45DaysAgo)).toBe('31-60 يوم');

      const date75DaysAgo = new Date(today);
      date75DaysAgo.setDate(today.getDate() - 75);
      expect(getAgingBucket(date75DaysAgo)).toBe('61-90 يوم');

      const date120DaysAgo = new Date(today);
      date120DaysAgo.setDate(today.getDate() - 120);
      expect(getAgingBucket(date120DaysAgo)).toBe('+90 يوم');
    });
  });

  describe('Inventory Valuation Calculation', () => {
    it('should calculate total inventory value', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: mockInventory,
          fixedAssets: [],
        })
      );

      // (100 * 50) + (5 * 200) = 5000 + 1000 = 6000
      expect(result.current.inventoryValuation.totalValue).toBe(6000);
    });

    it('should count total items', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: mockInventory,
          fixedAssets: [],
        })
      );

      expect(result.current.inventoryValuation.totalItems).toBe(2);
    });

    it('should identify low stock items (quantity < 10)', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: mockInventory,
          fixedAssets: [],
        })
      );

      // Only 'حبر طباعة' has quantity 5 (< 10)
      expect(result.current.inventoryValuation.lowStockItems).toBe(1);
    });

    it('should add totalValue to each item', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: mockInventory,
          fixedAssets: [],
        })
      );

      const valuedItem = result.current.inventoryValuation.valuedInventory.find(
        (item) => item.itemName === 'ورق مقوى'
      );

      expect(valuedItem?.totalValue).toBe(5000); // 100 * 50
    });
  });

  describe('Sales and COGS Calculation', () => {
    it('should calculate total sales', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Sale',
          type: 'دخل',
          amount: 10000,
          category: 'إيرادات المبيعات',
          subCategory: '',
          associatedParty: '',
          date: new Date(),
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.salesAndCOGS.totalSales).toBe(10000);
    });

    it('should calculate total COGS', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: mockLedgerEntries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.salesAndCOGS.totalCOGS).toBe(3000);
    });

    it('should calculate gross profit', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Sales',
          type: 'دخل',
          amount: 10000,
          category: 'إيرادات المبيعات',
          subCategory: '',
          associatedParty: '',
          date: new Date(),
        },
        {
          id: '2',
          transactionId: 'TX-002',
          description: 'COGS',
          type: 'مصروف',
          amount: 6000,
          category: 'تكلفة البضاعة المباعة (COGS)',
          subCategory: '',
          associatedParty: '',
          date: new Date(),
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.salesAndCOGS.grossProfit).toBe(4000); // 10000 - 6000
    });

    it('should calculate gross margin percentage', () => {
      const entries = [
        {
          id: '1',
          transactionId: 'TX-001',
          description: 'Sales',
          type: 'دخل',
          amount: 10000,
          category: 'إيرادات المبيعات',
          subCategory: '',
          associatedParty: '',
          date: new Date(),
        },
        {
          id: '2',
          transactionId: 'TX-002',
          description: 'COGS',
          type: 'مصروف',
          amount: 6000,
          category: 'تكلفة البضاعة المباعة (COGS)',
          subCategory: '',
          associatedParty: '',
          date: new Date(),
        },
      ];

      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: entries,
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.salesAndCOGS.grossMargin).toBe(40); // (4000 / 10000) * 100
    });

    it('should handle zero sales (avoid division by zero)', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.salesAndCOGS.grossMargin).toBe(0);
    });
  });

  describe('Fixed Assets Summary Calculation', () => {
    it('should filter only active assets', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: mockFixedAssets,
        })
      );

      expect(result.current.fixedAssetsSummary.activeAssets.length).toBe(2);
    });

    it('should calculate total cost of active assets', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: mockFixedAssets,
        })
      );

      // 50000 + 30000 = 80000 (excluding disposed asset)
      expect(result.current.fixedAssetsSummary.totalCost).toBe(80000);
    });

    it('should calculate total accumulated depreciation', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: mockFixedAssets,
        })
      );

      // 5000 + 10000 = 15000
      expect(result.current.fixedAssetsSummary.totalAccumulatedDepreciation).toBe(15000);
    });

    it('should calculate total book value', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: mockFixedAssets,
        })
      );

      // 45000 + 20000 = 65000
      expect(result.current.fixedAssetsSummary.totalBookValue).toBe(65000);
    });

    it('should calculate monthly depreciation', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: mockFixedAssets,
        })
      );

      // 500 + 400 = 900
      expect(result.current.fixedAssetsSummary.monthlyDepreciation).toBe(900);
    });

    it('should group assets by category with book values', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: mockFixedAssets,
        })
      );

      expect(result.current.fixedAssetsSummary.assetsByCategory['آلات']).toBe(45000);
      expect(result.current.fixedAssetsSummary.assetsByCategory['مركبات']).toBe(20000);
    });
  });

  describe('Memoization', () => {
    it('should return stable references when inputs do not change', () => {
      const props = {
        ledgerEntries: mockLedgerEntries,
        payments: mockPayments,
        inventory: mockInventory,
        fixedAssets: mockFixedAssets,
      };

      const { result, rerender } = renderHook(() => useReportsCalculations(props));

      const firstResult = result.current;

      rerender();

      // References should be the same since inputs haven't changed
      expect(result.current.ownerEquity).toBe(firstResult.ownerEquity);
      expect(result.current.incomeStatement).toBe(firstResult.incomeStatement);
    });
  });

  describe('Empty Data Handling', () => {
    it('should handle empty ledger entries', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.incomeStatement.totalRevenue).toBe(0);
      expect(result.current.incomeStatement.totalExpenses).toBe(0);
      expect(result.current.ownerEquity.netOwnerEquity).toBe(0);
    });

    it('should handle empty payments', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.cashFlow.cashIn).toBe(0);
      expect(result.current.cashFlow.cashOut).toBe(0);
    });

    it('should handle empty inventory', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.inventoryValuation.totalValue).toBe(0);
      expect(result.current.inventoryValuation.totalItems).toBe(0);
    });

    it('should handle empty fixed assets', () => {
      const { result } = renderHook(() =>
        useReportsCalculations({
          ledgerEntries: [],
          payments: [],
          inventory: [],
          fixedAssets: [],
        })
      );

      expect(result.current.fixedAssetsSummary.totalCost).toBe(0);
      expect(result.current.fixedAssetsSummary.activeAssets.length).toBe(0);
    });
  });
});
