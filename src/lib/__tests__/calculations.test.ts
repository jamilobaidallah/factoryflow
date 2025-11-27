
import {
  calculateClientBalance,
  calculateAllClientBalances,
  calculateInventoryValue,
  calculateItemBalance,
  calculateMonthlyStats,
  calculateCategoryTotals,
  calculatePendingChequesValue,
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
    phone: '123456',
    openingBalance: 100,
    createdAt: new Date()
  };

  const mockTransactions: Transaction[] = [
    {
      id: 't1',
      description: 'Sale 1',
      amount: 500,
      category: 'income',
      subCategory: 'sales',
      associatedPartyId: 'client1',
      associatedPartyName: 'Test Client',
      date: new Date('2024-01-15'),
      createdAt: new Date()
    },
    {
      id: 't2',
      description: 'Expense 1',
      amount: 200,
      category: 'expense',
      subCategory: 'rent',
      associatedPartyId: 'client1',
      associatedPartyName: 'Test Client',
      date: new Date('2024-01-20'),
      createdAt: new Date()
    }
  ];

  const mockPayments: Payment[] = [
    {
      id: 'p1',
      partyName: 'Test Client',
      partyId: 'client1',
      amount: 300,
      type: 'receipt',
      method: 'cash',
      transactionId: 't1',
      date: new Date('2024-01-16'),
      createdAt: new Date()
    }
  ];

  const mockIncomingCheques: IncomingCheque[] = [
    {
      id: 'c1',
      chequeNumber: 'CHQ-1',
      clientId: 'client1',
      clientName: 'Test Client',
      amount: 100,
      status: 'cleared',
      dueDate: new Date('2024-01-18'),
      date: new Date('2024-01-18'),
      createdAt: new Date()
    },
    {
      id: 'c2',
      chequeNumber: 'CHQ-2',
      clientId: 'client1',
      clientName: 'Test Client',
      amount: 150,
      status: 'pending',
      dueDate: new Date('2023-12-31'), // Overdue
      date: new Date('2023-12-31'),
      createdAt: new Date()
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
      { id: 'item1', name: 'Item 1', unit: 'kg', createdAt: new Date() }
    ];

    const mockMovements: InventoryMovement[] = [
      { id: 'm1', itemId: 'item1', type: 'entry', quantity: 100, itemName: 'Item 1', date: new Date(), createdAt: new Date() },
      { id: 'm2', itemId: 'item1', type: 'exit', quantity: 30, itemName: 'Item 1', date: new Date(), createdAt: new Date() }
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

    it('should identify overdue outgoing cheques', () => {
      const overdueOutgoing: OutgoingCheque[] = [
        {
          id: 'oc1',
          chequeNumber: 'OUT-1',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 200,
          status: 'pending',
          dueDate: new Date('2023-01-01'), // Overdue
          date: new Date('2023-01-01'),
          createdAt: new Date()
        }
      ];

      const { outgoing, totalAmount } = getOverdueCheques([], overdueOutgoing);

      expect(outgoing).toHaveLength(1);
      expect(outgoing[0].id).toBe('oc1');
      expect(totalAmount).toBe(200);
    });

    it('should handle string dates', () => {
      const chequesWithStringDates: IncomingCheque[] = [
        {
          id: 'c3',
          chequeNumber: 'CHQ-3',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 100,
          status: 'pending',
          dueDate: '2020-01-01' as unknown as Date, // String date in the past
          date: new Date(),
          createdAt: new Date()
        }
      ];

      const { incoming } = getOverdueCheques(chequesWithStringDates, []);
      expect(incoming).toHaveLength(1);
    });
  });

  describe('calculateAllClientBalances', () => {
    it('should calculate balances for all clients', () => {
      const clients: Client[] = [
        mockClient,
        { id: 'client2', name: 'Client 2', phone: '999', openingBalance: 50, createdAt: new Date() }
      ];

      const transactions: Transaction[] = [
        ...mockTransactions,
        {
          id: 't3',
          description: 'Sale to Client 2',
          amount: 300,
          category: 'income',
          subCategory: 'sales',
          associatedPartyId: 'client2',
          associatedPartyName: 'Client 2',
          date: new Date('2024-01-15'),
          createdAt: new Date()
        }
      ];

      const balanceMap = calculateAllClientBalances(
        clients,
        transactions,
        mockPayments,
        mockIncomingCheques,
        mockOutgoingCheques
      );

      // Client 1: 100 (opening) + 500 (income) - 200 (expense) - 300 (receipt) - 100 (cleared cheque) = 0
      expect(balanceMap.get('client1')).toBe(0);
      // Client 2: 50 (opening) + 300 (income) = 350
      expect(balanceMap.get('client2')).toBe(350);
    });

    it('should handle disbursement payments', () => {
      const disbursementPayments: Payment[] = [
        {
          id: 'p2',
          partyName: 'Test Client',
          partyId: 'client1',
          amount: 100,
          type: 'disbursement',
          method: 'cash',
          transactionId: 't1',
          date: new Date('2024-01-17'),
          createdAt: new Date()
        }
      ];

      const balanceMap = calculateAllClientBalances(
        [mockClient],
        [],
        disbursementPayments,
        [],
        []
      );

      // 100 (opening) + 100 (disbursement) = 200
      expect(balanceMap.get('client1')).toBe(200);
    });

    it('should handle cashed outgoing cheques', () => {
      const cashedOutgoing: OutgoingCheque[] = [
        {
          id: 'oc1',
          chequeNumber: 'OUT-1',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 50,
          status: 'cashed',
          dueDate: new Date(),
          date: new Date(),
          createdAt: new Date()
        }
      ];

      const balanceMap = calculateAllClientBalances(
        [mockClient],
        [],
        [],
        [],
        cashedOutgoing
      );

      // 100 (opening) + 50 (cashed outgoing cheque) = 150
      expect(balanceMap.get('client1')).toBe(150);
    });
  });

  describe('calculateClientBalance with outgoing cheques', () => {
    it('should add cashed outgoing cheques to balance', () => {
      const cashedOutgoing: OutgoingCheque[] = [
        {
          id: 'oc1',
          chequeNumber: 'OUT-1',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 75,
          status: 'cashed',
          dueDate: new Date(),
          date: new Date(),
          createdAt: new Date()
        }
      ];

      const balance = calculateClientBalance(
        'client1',
        [],
        [],
        [],
        cashedOutgoing,
        mockClient
      );

      // 100 (opening) + 75 (cashed outgoing) = 175
      expect(balance).toBe(175);
    });

    it('should handle disbursement payments', () => {
      const disbursementPayments: Payment[] = [
        {
          id: 'p3',
          partyName: 'Test Client',
          partyId: 'client1',
          amount: 50,
          type: 'disbursement',
          method: 'cash',
          transactionId: '',
          date: new Date(),
          createdAt: new Date()
        }
      ];

      const balance = calculateClientBalance(
        'client1',
        [],
        disbursementPayments,
        [],
        [],
        mockClient
      );

      // 100 (opening) + 50 (disbursement) = 150
      expect(balance).toBe(150);
    });
  });

  describe('calculateItemBalance', () => {
    it('should calculate item balance from movements', () => {
      const movements: InventoryMovement[] = [
        { id: 'm1', itemId: 'item1', type: 'entry', quantity: 100, itemName: 'Item 1', date: new Date(), createdAt: new Date() },
        { id: 'm2', itemId: 'item1', type: 'exit', quantity: 30, itemName: 'Item 1', date: new Date(), createdAt: new Date() },
        { id: 'm3', itemId: 'item1', type: 'entry', quantity: 20, itemName: 'Item 1', date: new Date(), createdAt: new Date() },
        { id: 'm4', itemId: 'item2', type: 'entry', quantity: 50, itemName: 'Item 2', date: new Date(), createdAt: new Date() }
      ];

      // Item 1: 100 - 30 + 20 = 90
      expect(calculateItemBalance('item1', movements)).toBe(90);
      // Item 2: 50
      expect(calculateItemBalance('item2', movements)).toBe(50);
      // Non-existent item
      expect(calculateItemBalance('item3', movements)).toBe(0);
    });
  });

  describe('calculatePendingChequesValue', () => {
    it('should calculate pending cheques values', () => {
      const pendingIncoming: IncomingCheque[] = [
        {
          id: 'pi1',
          chequeNumber: 'PIN-1',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 500,
          status: 'pending',
          dueDate: new Date(),
          date: new Date(),
          createdAt: new Date()
        },
        {
          id: 'pi2',
          chequeNumber: 'PIN-2',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 300,
          status: 'pending',
          dueDate: new Date(),
          date: new Date(),
          createdAt: new Date()
        },
        {
          id: 'pi3',
          chequeNumber: 'PIN-3',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 200,
          status: 'cleared', // Not pending
          dueDate: new Date(),
          date: new Date(),
          createdAt: new Date()
        }
      ];

      const pendingOutgoing: OutgoingCheque[] = [
        {
          id: 'po1',
          chequeNumber: 'POUT-1',
          clientId: 'client1',
          clientName: 'Test Client',
          amount: 400,
          status: 'pending',
          dueDate: new Date(),
          date: new Date(),
          createdAt: new Date()
        }
      ];

      const result = calculatePendingChequesValue(pendingIncoming, pendingOutgoing);

      expect(result.incoming).toBe(800); // 500 + 300
      expect(result.outgoing).toBe(400);
      expect(result.net).toBe(400); // 800 - 400
    });

    it('should handle empty arrays', () => {
      const result = calculatePendingChequesValue([], []);

      expect(result.incoming).toBe(0);
      expect(result.outgoing).toBe(0);
      expect(result.net).toBe(0);
    });
  });

  describe('calculateDailyCashFlow with disbursements', () => {
    it('should handle disbursement payments as expenses', () => {
      const disbursementPayments: Payment[] = [
        {
          id: 'p4',
          partyName: 'Test Client',
          partyId: 'client1',
          amount: 150,
          type: 'disbursement',
          method: 'cash',
          transactionId: '',
          date: new Date('2024-01-15'),
          createdAt: new Date()
        }
      ];

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15');

      const cashFlow = calculateDailyCashFlow([], disbursementPayments, startDate, endDate);
      const day = cashFlow.get('2024-01-15');

      expect(day?.expense).toBe(150);
      expect(day?.income).toBe(0);
    });

    it('should exclude payments with noCashMovement flag', () => {
      const paymentsWithNoCashMovement: Payment[] = [
        {
          id: 'p5',
          partyName: 'Test Client',
          partyId: 'client1',
          amount: 200,
          type: 'receipt',
          method: 'cash',
          transactionId: '',
          date: new Date('2024-01-15'),
          noCashMovement: true, // Should be excluded
          createdAt: new Date()
        }
      ];

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15');

      const cashFlow = calculateDailyCashFlow([], paymentsWithNoCashMovement, startDate, endDate);
      const day = cashFlow.get('2024-01-15');

      expect(day?.income).toBe(0); // Excluded due to noCashMovement
    });

    it('should handle expense transactions', () => {
      const expenseTransactions: Transaction[] = [
        {
          id: 't4',
          description: 'Expense',
          amount: 100,
          category: 'expense',
          subCategory: 'rent',
          associatedPartyId: 'client1',
          associatedPartyName: 'Test Client',
          date: new Date('2024-01-15'),
          createdAt: new Date()
        }
      ];

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15');

      const cashFlow = calculateDailyCashFlow(expenseTransactions, [], startDate, endDate);
      const day = cashFlow.get('2024-01-15');

      expect(day?.expense).toBe(100);
    });

    it('should handle string dates in transactions', () => {
      const transactionsWithStringDates: Transaction[] = [
        {
          id: 't5',
          description: 'Sale',
          amount: 250,
          category: 'income',
          subCategory: 'sales',
          associatedPartyId: 'client1',
          associatedPartyName: 'Test Client',
          date: '2024-01-15' as unknown as Date,
          createdAt: new Date()
        }
      ];

      const startDate = new Date('2024-01-15');
      const endDate = new Date('2024-01-15');

      const cashFlow = calculateDailyCashFlow(transactionsWithStringDates, [], startDate, endDate);
      const day = cashFlow.get('2024-01-15');

      expect(day?.income).toBe(250);
    });
  });

  describe('getTopClients sorting', () => {
    it('should sort clients by volume descending', () => {
      const clients: Client[] = [
        { id: 'c1', name: 'Client 1', phone: '111', openingBalance: 0, createdAt: new Date() },
        { id: 'c2', name: 'Client 2', phone: '222', openingBalance: 0, createdAt: new Date() },
        { id: 'c3', name: 'Client 3', phone: '333', openingBalance: 0, createdAt: new Date() }
      ];

      const transactions: Transaction[] = [
        { id: 't1', description: '', amount: 100, category: 'income', subCategory: '', associatedPartyId: 'c1', associatedPartyName: '', date: new Date(), createdAt: new Date() },
        { id: 't2', description: '', amount: 500, category: 'income', subCategory: '', associatedPartyId: 'c2', associatedPartyName: '', date: new Date(), createdAt: new Date() },
        { id: 't3', description: '', amount: 300, category: 'income', subCategory: '', associatedPartyId: 'c3', associatedPartyName: '', date: new Date(), createdAt: new Date() }
      ];

      const topClients = getTopClients(clients, transactions, 3);

      expect(topClients[0].client.id).toBe('c2'); // 500
      expect(topClients[1].client.id).toBe('c3'); // 300
      expect(topClients[2].client.id).toBe('c1'); // 100
    });

    it('should limit results to specified count', () => {
      const clients: Client[] = [
        { id: 'c1', name: 'Client 1', phone: '111', openingBalance: 0, createdAt: new Date() },
        { id: 'c2', name: 'Client 2', phone: '222', openingBalance: 0, createdAt: new Date() },
        { id: 'c3', name: 'Client 3', phone: '333', openingBalance: 0, createdAt: new Date() }
      ];

      const transactions: Transaction[] = [
        { id: 't1', description: '', amount: 100, category: 'income', subCategory: '', associatedPartyId: 'c1', associatedPartyName: '', date: new Date(), createdAt: new Date() },
        { id: 't2', description: '', amount: 500, category: 'income', subCategory: '', associatedPartyId: 'c2', associatedPartyName: '', date: new Date(), createdAt: new Date() },
        { id: 't3', description: '', amount: 300, category: 'income', subCategory: '', associatedPartyId: 'c3', associatedPartyName: '', date: new Date(), createdAt: new Date() }
      ];

      const topClients = getTopClients(clients, transactions, 2);

      expect(topClients).toHaveLength(2);
      expect(topClients[0].client.id).toBe('c2');
      expect(topClients[1].client.id).toBe('c3');
    });
  });

  describe('calculateMonthlyStats with string dates', () => {
    it('should handle string dates in transactions', () => {
      const transactionsWithStringDates: Transaction[] = [
        {
          id: 't6',
          description: 'Sale',
          amount: 400,
          category: 'income',
          subCategory: 'sales',
          associatedPartyId: 'client1',
          associatedPartyName: 'Test Client',
          date: '2024-02-15' as unknown as Date,
          createdAt: new Date()
        }
      ];

      const stats = calculateMonthlyStats(transactionsWithStringDates, 2024, 2);

      expect(stats.income).toBe(400);
      expect(stats.expenses).toBe(0);
      expect(stats.profit).toBe(400);
    });
  });
});
