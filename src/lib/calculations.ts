import {
  Client,
  Transaction,
  Payment,
  IncomingCheque,
  OutgoingCheque,
  InventoryMovement,
  InventoryItem
} from './definitions';

// Calculate client balance from all transactions
export function calculateClientBalance(
  clientId: string,
  transactions: Transaction[],
  payments: Payment[],
  incomingCheques: IncomingCheque[],
  outgoingCheques: OutgoingCheque[],
  client?: Client
): number {
  let balance = client?.openingBalance || 0;

  // Add income transactions (client owes us)
  const incomeTransactions = transactions.filter(
    t => t.associatedPartyId === clientId && t.category === 'income'
  );
  balance += incomeTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Subtract expense transactions (we owe client)
  const expenseTransactions = transactions.filter(
    t => t.associatedPartyId === clientId && t.category === 'expense'
  );
  balance -= expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Subtract receipts (client paid us)
  const receipts = payments.filter(
    p => p.partyId === clientId && p.type === 'receipt'
  );
  balance -= receipts.reduce((sum, p) => sum + p.amount, 0);

  // Add disbursements (we paid client)
  const disbursements = payments.filter(
    p => p.partyId === clientId && p.type === 'disbursement'
  );
  balance += disbursements.reduce((sum, p) => sum + p.amount, 0);

  // Subtract cleared incoming cheques (client paid us with cleared cheque)
  const clearedIncomingCheques = incomingCheques.filter(
    c => c.clientId === clientId && c.status === 'cleared'
  );
  balance -= clearedIncomingCheques.reduce((sum, c) => sum + c.amount, 0);

  // Add cashed outgoing cheques (we paid client with cashed cheque)
  const cashedOutgoingCheques = outgoingCheques.filter(
    c => c.clientId === clientId && c.status === 'cashed'
  );
  balance += cashedOutgoingCheques.reduce((sum, c) => sum + c.amount, 0);

  return balance;
}

// Calculate all client balances at once (optimized)
export function calculateAllClientBalances(
  clients: Client[],
  transactions: Transaction[],
  payments: Payment[],
  incomingCheques: IncomingCheque[],
  outgoingCheques: OutgoingCheque[]
): Map<string, number> {
  const balanceMap = new Map<string, number>();

  // Initialize with opening balances
  clients.forEach(client => {
    balanceMap.set(client.id, client.openingBalance || 0);
  });

  // Process transactions
  transactions.forEach(transaction => {
    const currentBalance = balanceMap.get(transaction.associatedPartyId) || 0;
    if (transaction.category === 'income') {
      balanceMap.set(transaction.associatedPartyId, currentBalance + transaction.amount);
    } else {
      balanceMap.set(transaction.associatedPartyId, currentBalance - transaction.amount);
    }
  });

  // Process payments
  payments.forEach(payment => {
    const currentBalance = balanceMap.get(payment.partyId) || 0;
    if (payment.type === 'receipt') {
      balanceMap.set(payment.partyId, currentBalance - payment.amount);
    } else {
      balanceMap.set(payment.partyId, currentBalance + payment.amount);
    }
  });

  // Process cleared incoming cheques
  incomingCheques
    .filter(c => c.status === 'cleared')
    .forEach(cheque => {
      const currentBalance = balanceMap.get(cheque.clientId) || 0;
      balanceMap.set(cheque.clientId, currentBalance - cheque.amount);
    });

  // Process cashed outgoing cheques
  outgoingCheques
    .filter(c => c.status === 'cashed')
    .forEach(cheque => {
      const currentBalance = balanceMap.get(cheque.clientId) || 0;
      balanceMap.set(cheque.clientId, currentBalance + cheque.amount);
    });

  return balanceMap;
}

// Calculate total inventory value
export function calculateInventoryValue(
  items: InventoryItem[],
  movements: InventoryMovement[]
): Map<string, number> {
  const inventoryMap = new Map<string, number>();

  movements.forEach(movement => {
    const currentQuantity = inventoryMap.get(movement.itemId) || 0;
    if (movement.type === 'entry') {
      inventoryMap.set(movement.itemId, currentQuantity + movement.quantity);
    } else {
      inventoryMap.set(movement.itemId, currentQuantity - movement.quantity);
    }
  });

  return inventoryMap;
}

// Calculate inventory item balance
export function calculateItemBalance(
  itemId: string,
  movements: InventoryMovement[]
): number {
  let balance = 0;
  
  movements
    .filter(m => m.itemId === itemId)
    .forEach(movement => {
      if (movement.type === 'entry') {
        balance += movement.quantity;
      } else {
        balance -= movement.quantity;
      }
    });

  return balance;
}

// Calculate monthly statistics
export function calculateMonthlyStats(
  transactions: Transaction[],
  year: number,
  month: number
): { income: number; expenses: number; profit: number } {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59);

  const monthTransactions = transactions.filter(t => {
    const date = typeof t.date === 'string' ? new Date(t.date) : t.date;
    return date >= startDate && date <= endDate;
  });

  const income = monthTransactions
    .filter(t => t.category === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const expenses = monthTransactions
    .filter(t => t.category === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  return {
    income,
    expenses,
    profit: income - expenses
  };
}

// Calculate category totals
export function calculateCategoryTotals(
  transactions: Transaction[]
): Map<string, number> {
  const categoryMap = new Map<string, number>();

  transactions.forEach(transaction => {
    const key = transaction.subCategory || transaction.category;
    const current = categoryMap.get(key) || 0;
    if (transaction.category === 'income') {
      categoryMap.set(key, current + transaction.amount);
    } else {
      categoryMap.set(key, current - transaction.amount);
    }
  });

  return categoryMap;
}

// Calculate pending cheques value
export function calculatePendingChequesValue(
  incomingCheques: IncomingCheque[],
  outgoingCheques: OutgoingCheque[]
): { incoming: number; outgoing: number; net: number } {
  const pendingIncoming = incomingCheques
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  const pendingOutgoing = outgoingCheques
    .filter(c => c.status === 'pending')
    .reduce((sum, c) => sum + c.amount, 0);

  return {
    incoming: pendingIncoming,
    outgoing: pendingOutgoing,
    net: pendingIncoming - pendingOutgoing
  };
}

// Calculate daily cash flow
export function calculateDailyCashFlow(
  transactions: Transaction[],
  payments: Payment[],
  startDate: Date,
  endDate: Date
): Map<string, { income: number; expense: number }> {
  const cashFlowMap = new Map<string, { income: number; expense: number }>();

  // Initialize all days in range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    cashFlowMap.set(dateKey, { income: 0, expense: 0 });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Process transactions
  transactions
    .filter(t => {
      const date = typeof t.date === 'string' ? new Date(t.date) : t.date;
      return date >= startDate && date <= endDate;
    })
    .forEach(transaction => {
      const date = typeof transaction.date === 'string' ? new Date(transaction.date) : transaction.date;
      const dateKey = date.toISOString().split('T')[0];
      const current = cashFlowMap.get(dateKey) || { income: 0, expense: 0 };
      
      if (transaction.category === 'income') {
        current.income += transaction.amount;
      } else {
        current.expense += transaction.amount;
      }
      
      cashFlowMap.set(dateKey, current);
    });

  // Process payments (exclude endorsement payments with no cash movement)
  payments
    .filter(p => {
      const date = typeof p.date === 'string' ? new Date(p.date) : p.date;
      return date >= startDate && date <= endDate && !p.noCashMovement;
    })
    .forEach(payment => {
      const date = typeof payment.date === 'string' ? new Date(payment.date) : payment.date;
      const dateKey = date.toISOString().split('T')[0];
      const current = cashFlowMap.get(dateKey) || { income: 0, expense: 0 };

      if (payment.type === 'receipt') {
        current.income += payment.amount;
      } else {
        current.expense += payment.amount;
      }

      cashFlowMap.set(dateKey, current);
    });

  return cashFlowMap;
}

// Get top clients by volume
export function getTopClients(
  clients: Client[],
  transactions: Transaction[],
  limit: number = 5
): Array<{ client: Client; volume: number }> {
  const volumeMap = new Map<string, number>();

  transactions.forEach(transaction => {
    const current = volumeMap.get(transaction.associatedPartyId) || 0;
    volumeMap.set(transaction.associatedPartyId, current + transaction.amount);
  });

  return clients
    .map(client => ({
      client,
      volume: volumeMap.get(client.id) || 0
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);
}

// Calculate overdue cheques
export function getOverdueCheques(
  incomingCheques: IncomingCheque[],
  outgoingCheques: OutgoingCheque[]
): {
  incoming: IncomingCheque[];
  outgoing: OutgoingCheque[];
  totalAmount: number;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueIncoming = incomingCheques.filter(c => {
    const dueDate = typeof c.dueDate === 'string' ? new Date(c.dueDate) : c.dueDate;
    return c.status === 'pending' && dueDate < today;
  });

  const overdueOutgoing = outgoingCheques.filter(c => {
    const dueDate = typeof c.dueDate === 'string' ? new Date(c.dueDate) : c.dueDate;
    return c.status === 'pending' && dueDate < today;
  });

  const totalAmount = 
    overdueIncoming.reduce((sum, c) => sum + c.amount, 0) +
    overdueOutgoing.reduce((sum, c) => sum + c.amount, 0);

  return {
    incoming: overdueIncoming,
    outgoing: overdueOutgoing,
    totalAmount
  };
}
