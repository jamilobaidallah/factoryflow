
import {
  calculateClientBalance,
  calculateInventoryValue,
  calculateMonthlyStats,
  calculateCategoryTotals,
  calculateDailyCashFlow,
  getTopClients,
  getOverdueCheques
} from '../calculations';
import {
  Client,
  Transaction,
  Payment,
  IncomingCheque,
  OutgoingCheque,
  InventoryMovement,
  InventoryItem
} from '../definitions';

describe('Calculations Utilities', () => {
  // Mock Data
  const mockClient: Client = {
    id: 'client1',
    name: 'Test Client',
    type: 'customer',
    phone: '123456',
    openingBalance: 100,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const mockTransactions: Transaction[] = [
    {
      id: 't1',
      transactionId: 'TXN-1',
      description: 'Sale 1',
      type: 'income',
      amount: 500,
      category: 'income',
      subCategory: 'sales',
      associatedPartyId: 'client1',
      date: new Date('2024-01-15'),
      createdAt: new Date()
    },
    {
      id: 't2',
      transactionId: 'TXN-2',
      description: 'Expense 1',
      type: 'expense',
      amount: 200,
      category: 'expense',
      subCategory: 'rent',
      associatedPartyId: 'client1',
      date: new Date('2024-01-20'),
      createdAt: new Date()
    }
  ];

  const mockPayments: Payment[] = [
    {
      id: 'p1',
      clientName: 'Test Client',
      partyId: 'client1',
      amount: 300,
      type: 'receipt',
      linkedTransactionId: 'TXN-1',
      date: new Date('2024-01-16'),
      createdAt: new Date()
    }
  ];

  const mockIncomingCheques: IncomingCheque[] = [
    {
      id: 'c1',
      chequeNumber: 'CHQ-1',
      clientId: 'client1',
      amount: 100,
      status: 'cleared',
      dueDate: new Date('2024-01-18'),
      createdAt: new Date(),
      clientName: 'Test Client',
      type: 'incoming',
      chequeType: 'normal',
      bankName: 'Bank A',
      issueDate: new Date()
    },
    {
      id: 'c2',
      chequeNumber: 'CHQ-2',
      clientId: 'client1',
      amount: 150,
      status: 'pending',
      dueDate: new Date('2023-12-31'), // Overdue
      createdAt: new Date(),
      clientName: 'Test Client',
      type: 'incoming',
      chequeType: 'normal',
      bankName: 'Bank A',
      issueDate: new Date()
    }
  ];

  const mockOutgoingCheques: OutgoingCheque[] = [];

  describe('calculateClientBalance', () => {
    it('should calculate balance correctly', () => {
      // Opening Balance: 100
      // + Income (Sale): 500
      // - Expense: 200
      // - Receipt (Payment): 300
      // - Cleared Cheque: 100
      // Total: 100 + 500 - 200 - 300 - 100 = 0
      
      const balance = calculateClientBalance(
        'client1',
        mockTransactions,
        mockPayments,
        mockIncomingCheques,
        mockOutgoingCheques,
        mockClient
      );

      expect(balance).toBe(0);
    });

    it('should handle missing client opening balance', () => {
      const balance = calculateClientBalance(
        'client1',
        mockTransactions,
        mockPayments,
        mockIncomingCheques,
        mockOutgoingCheques,
        undefined
      );

      // 0 + 500 - 200 - 300 - 100 = -100
      expect(balance).toBe(-100);
    });
  });

  describe('calculateInventoryValue', () => {
    const mockItems: InventoryItem[] = [
      { id: 'item1', itemName: 'Item 1', quantity: 0, unitPrice: 10, unit: 'kg', category: 'raw', createdAt: new Date(), updatedAt: new Date() }
    ];

    const mockMovements: InventoryMovement[] = [
      { id: 'm1', itemId: 'item1', type: 'entry', quantity: 100, itemName: 'Item 1', createdAt: new Date() },
      { id: 'm2', itemId: 'item1', type: 'exit', quantity: 30, itemName: 'Item 1', createdAt: new Date() }
    ];

    it('should calculate inventory quantities correctly', () => {
      const inventoryMap = calculateInventoryValue(mockItems, mockMovements);
      
      // 100 - 30 = 70
      expect(inventoryMap.get('item1')).toBe(70);
    });
  });

  describe('calculateMonthlyStats', () => {
    it('should calculate monthly income, expenses and profit', () => {
      const stats = calculateMonthlyStats(mockTransactions, 2024, 1);
      
      expect(stats.income).toBe(500);
      expect(stats.expenses).toBe(200);
      expect(stats.profit).toBe(300); // 500 - 200
    });

    it('should return zeros for empty month', () => {
      const stats = calculateMonthlyStats(mockTransactions, 2024, 2);
      
      expect(stats.income).toBe(0);
      expect(stats.expenses).toBe(0);
      expect(stats.profit).toBe(0);
    });
  });

  describe('calculateCategoryTotals', () => {
    it('should group totals by category/subcategory', () => {
      const totals = calculateCategoryTotals(mockTransactions);
      
      expect(totals.get('sales')).toBe(500);
      expect(totals.get('rent')).toBe(-200); // Expense is negative in this map logic? 
      // Let's check the implementation:
      // if (transaction.category === 'income') categoryMap.set(key, current + transaction.amount);
      // else categoryMap.set(key, current - transaction.amount);
      // So yes, expenses are subtracted.
    });
  });

  describe('calculateDailyCashFlow', () => {
    it('should calculate daily cash flow', () => {
      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-16');
      
      const cashFlow = calculateDailyCashFlow(
        mockTransactions,
        mockPayments,
        startDate,
        endDate
      );

      // 2024-01-15: Transaction Income 500
      const day1 = cashFlow.get('2024-01-15');
      expect(day1?.income).toBe(500);
      expect(day1?.expense).toBe(0);

      // 2024-01-16: Payment Receipt 300
      const day2 = cashFlow.get('2024-01-16');
      expect(day2?.income).toBe(300);
      expect(day2?.expense).toBe(0);
    });
  });

  describe('getTopClients', () => {
    it('should return top clients by volume', () => {
      const topClients = getTopClients([mockClient], mockTransactions);
      
      expect(topClients).toHaveLength(1);
      expect(topClients[0].client.id).toBe('client1');
      expect(topClients[0].volume).toBe(700); // 500 (income) + 200 (expense)
    });
  });

  describe('getOverdueCheques', () => {
    it('should identify overdue pending cheques', () => {
      const { incoming, totalAmount } = getOverdueCheques(mockIncomingCheques, mockOutgoingCheques);
      
      expect(incoming).toHaveLength(1);
      expect(incoming[0].id).toBe('c2'); // The overdue one
      expect(totalAmount).toBe(150);
    });
  });
});
