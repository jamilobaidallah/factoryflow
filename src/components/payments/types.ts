/**
 * Payment Multi-Allocation Types
 *
 * Types for handling payments distributed across multiple transactions.
 */

/**
 * Represents a single allocation of payment to a transaction
 * Stored in Firestore subcollection: payments/{paymentId}/allocations
 */
export interface PaymentAllocation {
  id: string;
  transactionId: string;        // Ledger transaction ID (e.g., TXN-20250101-123456-789)
  ledgerDocId: string;          // Firestore document ID of the ledger entry
  allocatedAmount: number;      // Amount allocated to this transaction
  transactionDate: Date;        // Original transaction date (for FIFO reference)
  description: string;          // Transaction description for display
  createdAt: Date;
}

/**
 * Data needed to create a new allocation (without generated fields)
 */
export interface PaymentAllocationInput {
  transactionId: string;
  ledgerDocId: string;
  allocatedAmount: number;
  transactionDate: Date;
  description: string;
}

/**
 * Unpaid or partially paid transaction from the ledger
 * Used for displaying client's outstanding debts
 */
export interface UnpaidTransaction {
  id: string;                   // Firestore document ID
  transactionId: string;        // Transaction ID (TXN-...)
  date: Date;                   // Transaction date
  description: string;          // Transaction description
  category: string;             // Transaction category
  amount: number;               // Total transaction amount
  totalPaid: number;            // Amount already paid
  remainingBalance: number;     // Amount still owed
  paymentStatus: 'unpaid' | 'partial';
}

/**
 * UI state for allocation entry in the dialog
 * Tracks user input for each transaction
 */
export interface AllocationEntry {
  transactionId: string;
  ledgerDocId: string;
  transactionDate: Date;
  description: string;
  totalAmount: number;
  remainingBalance: number;
  allocatedAmount: number;      // User input: how much to allocate
}

/**
 * Extended Payment interface with multi-allocation fields
 */
export interface MultiAllocationPayment {
  id: string;
  clientName: string;
  amount: number;
  type: string;                 // "قبض" or "صرف"
  date: Date;
  notes: string;
  category?: string;
  subCategory?: string;
  createdAt: Date;
  // Multi-allocation specific fields
  isMultiAllocation: boolean;
  totalAllocated: number;
  allocationMethod: 'fifo' | 'manual';
  allocationCount: number;      // Number of transactions this payment covers
}

/**
 * Form data for creating a multi-allocation payment
 */
export interface MultiAllocationFormData {
  clientName: string;
  amount: string;
  date: string;
  notes: string;
  type: string;
  allocations: AllocationEntry[];
  allocationMethod: 'fifo' | 'manual';
}

/**
 * Initial form data for multi-allocation dialog
 */
export const initialMultiAllocationFormData: MultiAllocationFormData = {
  clientName: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  notes: '',
  type: 'قبض',
  allocations: [],
  allocationMethod: 'fifo',
};

/**
 * Result of FIFO distribution calculation
 */
export interface FIFODistributionResult {
  allocations: AllocationEntry[];
  totalAllocated: number;
  remainingPayment: number;     // Any leftover if payment > total debt
}
