// Type definitions for FactoryFlow application

export interface Client {
  id: string;
  name: string;
  phone?: string;
  openingBalance: number;
  createdAt: Date | string;
}

export interface Transaction {
  id: string;
  date: Date | string;
  associatedPartyId: string;
  associatedPartyName: string;
  category: 'income' | 'expense';
  subCategory?: string;
  description: string;
  amount: number;
  createdAt: Date | string;
}

export interface Payment {
  id: string;
  date: Date | string;
  type: 'receipt' | 'disbursement';
  partyId: string;
  partyName: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'cheque' | 'other';
  description?: string;
  transactionId?: string;
  createdAt: Date | string;
  isEndorsement?: boolean;
  noCashMovement?: boolean;
  endorsementChequeId?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  thickness?: number;
  createdAt: Date | string;
}

export interface InventoryMovement {
  id: string;
  date: Date | string;
  type: 'entry' | 'exit';
  itemId: string;
  itemName: string;
  quantity: number;
  width?: number;
  length?: number;
  thickness?: number;
  count?: number;
  partyId?: string;
  partyName?: string;
  txLink?: string;
  createdAt: Date | string;
}

export interface IncomingCheque {
  id: string;
  date: Date | string;
  clientId: string;
  clientName: string;
  amount: number;
  chequeNumber: string;
  dueDate: Date | string;
  status: 'pending' | 'cleared' | 'bounced' | 'endorsed';
  endorsedToId?: string;
  endorsedToName?: string;
  fileURL?: string;
  fileName?: string;
  txLink?: string;
  createdAt: Date | string;
}

export interface OutgoingCheque {
  id: string;
  date: Date | string;
  clientId: string;
  clientName: string;
  amount: number;
  chequeNumber: string;
  dueDate: Date | string;
  status: 'pending' | 'cashed' | 'cancelled';
  fileURL?: string;
  fileName?: string;
  txLink?: string;
  createdAt: Date | string;
}

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

// Form Types
export interface ClientFormData {
  name: string;
  phone?: string;
  openingBalance: number;
}

export interface TransactionFormData {
  date: Date;
  associatedPartyId: string;
  category: 'income' | 'expense';
  subCategory?: string;
  description: string;
  amount: number;
  // Additional fields for linked operations
  linkedOperation?: 'payment' | 'incoming_cheque' | 'outgoing_cheque' | 'inventory';
  paymentMethod?: 'cash' | 'bank_transfer';
  chequeNumber?: string;
  chequeDueDate?: Date;
  inventoryItemId?: string;
  inventoryQuantity?: number;
  inventoryWidth?: number;
  inventoryLength?: number;
}

export interface PaymentFormData {
  date: Date;
  type: 'receipt' | 'disbursement';
  partyId: string;
  amount: number;
  method: 'cash' | 'bank_transfer' | 'cheque' | 'other';
  description?: string;
}

export interface InventoryItemFormData {
  name: string;
  unit: string;
  thickness?: number;
}

export interface InventoryMovementFormData {
  date: Date;
  type: 'entry' | 'exit';
  itemId: string;
  quantity: number;
  width?: number;
  length?: number;
  thickness?: number;
  count?: number;
  partyId?: string;
}

export interface IncomingChequeFormData {
  date: Date;
  clientId: string;
  amount: number;
  chequeNumber: string;
  dueDate: Date;
  status: 'pending' | 'cleared' | 'bounced' | 'endorsed';
  endorsedToId?: string;
  file?: File;
}

export interface OutgoingChequeFormData {
  date: Date;
  clientId: string;
  amount: number;
  chequeNumber: string;
  dueDate: Date;
  status: 'pending' | 'cashed' | 'cancelled';
  file?: File;
}

// Dashboard Statistics
export interface DashboardStats {
  totalClients: number;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  pendingCheques: number;
  totalInventoryValue: number;
}

// Filter Types
export interface TransactionFilter {
  startDate?: Date;
  endDate?: Date;
  category?: 'income' | 'expense' | 'all';
  clientId?: string;
}

export interface ChequeFilter {
  status?: 'pending' | 'cleared' | 'bounced' | 'all';
  startDate?: Date;
  endDate?: Date;
  clientId?: string;
}

// AR/AP (Accounts Receivable/Payable) Types
export type PaymentStatus = 'paid' | 'unpaid' | 'partial';

export interface LedgerEntry {
  id: string;
  transactionId: string;
  date: Date | string;
  description: string;
  amount: number;
  category: string;
  subCategory: string;
  associatedParty: string;
  reference?: string;
  notes?: string;
  isARAPEntry: boolean;
  totalPaid?: number;
  remainingBalance?: number;
  paymentStatus?: PaymentStatus;
  createdAt: Date | string;
}

export interface ARAPUpdateResult {
  success: boolean;
  message: string;
  newTotalPaid?: number;
  newRemainingBalance?: number;
  newStatus?: PaymentStatus;
}

export interface ARAPUpdateParams {
  userId: string;
  transactionId: string;
  paymentAmount: number;
  operation: 'add' | 'subtract';
}

// Constants
export const PAYMENT_STATUSES = {
  PAID: 'paid' as const,
  UNPAID: 'unpaid' as const,
  PARTIAL: 'partial' as const,
};

export const TRANSACTION_TYPES = {
  INCOME: 'دخل' as const,
  EXPENSE: 'مصروف' as const,
};

export const PAYMENT_TYPES = {
  RECEIPT: 'قبض' as const,
  DISBURSEMENT: 'صرف' as const,
};

export const MOVEMENT_TYPES = {
  ENTRY: 'دخول' as const,
  EXIT: 'خروج' as const,
};
