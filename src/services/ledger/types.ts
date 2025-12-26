/**
 * Ledger Service Types
 * Shared types and interfaces for the ledger service and its handlers
 */

import type { WriteBatch, CollectionReference } from "firebase/firestore";
import type {
  LedgerFormData,
  CheckFormData,
  OutgoingCheckFormData,
  InventoryFormData,
  FixedAssetFormData,
} from "@/components/ledger/types/ledger";
import type { ErrorType } from "@/lib/error-handling";

// ============================================
// Service Result Types
// ============================================

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
  errorType?: ErrorType;
}

export interface DeleteResult extends ServiceResult {
  deletedRelatedCount?: number;
}

export interface InventoryUpdateResult extends ServiceResult {
  cogsCreated?: boolean;
  cogsAmount?: number;
  cogsDescription?: string;
  inventoryChange?: { itemId: string; quantityDelta: number };
}

// ============================================
// Create Options
// ============================================

export interface CreateLedgerEntryOptions {
  hasIncomingCheck?: boolean;
  checkFormData?: CheckFormData;
  hasOutgoingCheck?: boolean;
  outgoingCheckFormData?: OutgoingCheckFormData;
  incomingChequesList?: CheckFormData[];
  outgoingChequesList?: OutgoingCheckFormData[];
  hasInventoryUpdate?: boolean;
  inventoryFormData?: InventoryFormData;
  hasFixedAsset?: boolean;
  fixedAssetFormData?: FixedAssetFormData;
  hasInitialPayment?: boolean;
  initialPaymentAmount?: string;
}

// ============================================
// Payment Types
// ============================================

export interface QuickPaymentData {
  amount: number;
  entryId: string;
  entryTransactionId: string;
  entryType: string;
  entryAmount: number;
  entryDescription: string;
  entryCategory: string;
  entrySubCategory: string;
  associatedParty: string;
  totalPaid: number;
  totalDiscount?: number;
  remainingBalance: number;
  isARAPEntry: boolean;
  date?: Date;
  // Settlement discount fields
  discountAmount?: number;
  discountReason?: string;
}

export interface WriteOffData {
  entryId: string;
  entryTransactionId: string;
  entryAmount: number;
  entryType: string;
  entryDescription: string;
  entryCategory?: string;
  entrySubCategory?: string;
  associatedParty: string;
  totalPaid: number;
  totalDiscount: number;
  currentWriteoff: number;
  remainingBalance: number;
  writeoffAmount: number;
  writeoffReason: string;
  writeoffBy: string;
}

// ============================================
// Invoice Types
// ============================================

export interface InvoiceData {
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  invoiceDate: Date;
  dueDate: Date;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
    unit: string;
    length?: number;
    width?: number;
    thickness?: number;
  }>;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  notes: string;
  manualInvoiceNumber?: string;
  invoiceImageUrl?: string;
}

// ============================================
// Handler Context
// ============================================

/**
 * Context passed to handler functions
 * Contains all dependencies needed for batch operations
 */
export interface HandlerContext {
  batch: WriteBatch;
  transactionId: string;
  formData: LedgerFormData;
  entryType: string;
  userId: string;
  refs: CollectionRefs;
}

/**
 * Collection references for Firestore operations
 */
export interface CollectionRefs {
  ledger: CollectionReference;
  cheques: CollectionReference;
  payments: CollectionReference;
  inventory: CollectionReference;
  inventoryMovements: CollectionReference;
  fixedAssets: CollectionReference;
}

/**
 * Result from COGS record creation
 */
export interface COGSResult {
  amount: number;
  description: string;
}
