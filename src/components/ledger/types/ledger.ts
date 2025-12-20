/**
 * Ledger Entry Interface
 */
export interface LedgerEntry {
  id: string;
  transactionId: string;
  description: string;
  type: string; // "دخل" (income), "مصروف" (expense), or "حركة رأس مال" (equity)
  amount: number;
  category: string;
  subCategory: string;
  associatedParty: string;
  ownerName?: string;
  date: Date;
  reference: string;
  notes: string;
  createdAt: Date;
  // AR/AP Tracking Fields
  totalPaid?: number;
  remainingBalance?: number;
  paymentStatus?: "paid" | "unpaid" | "partial";
  isARAPEntry?: boolean;
  // Settlement Discount Fields
  totalDiscount?: number;           // Sum of all discounts given (خصم تسوية)
  // Bad Debt Write-off Fields
  writeoffAmount?: number;          // Amount written off as bad debt
  writeoffReason?: string;          // Reason for writeoff (required)
  writeoffDate?: Date;              // When written off
  writeoffBy?: string;              // User who authorized (audit)
}

/**
 * Ledger Form Data
 */
export interface LedgerFormData {
  description: string;
  amount: string;
  category: string;
  subCategory: string;
  date: string;
  associatedParty: string;
  ownerName: string;
  reference: string;
  notes: string;
  trackARAP: boolean;
  immediateSettlement: boolean;
}

/**
 * Check Form Data (Incoming) - Single cheque
 */
export interface CheckFormData {
  chequeNumber: string;
  chequeAmount: string;
  bankName: string;
  dueDate: string;
  accountingType?: 'cashed' | 'postponed' | 'endorsed';
  endorsedToName?: string;
}

/**
 * Check Form Data Item (for multiple cheques support)
 */
export interface CheckFormDataItem extends CheckFormData {
  id: string; // Unique identifier for each cheque in the list
}

/**
 * Outgoing Check Form Data
 */
export interface OutgoingCheckFormData {
  chequeNumber: string;
  chequeAmount: string;
  bankName: string;
  dueDate: string;
  accountingType?: 'cashed' | 'postponed' | 'endorsed';
  endorsedFromName?: string;
}

/**
 * Outgoing Check Form Data Item (for multiple cheques support)
 */
export interface OutgoingCheckFormDataItem extends OutgoingCheckFormData {
  id: string; // Unique identifier for each cheque in the list
}

/**
 * Inventory Form Data
 */
export interface InventoryFormData {
  itemId: string;
  itemName: string;
  quantity: string;
  unit: string;
  thickness: string;
  width: string;
  length: string;
  shippingCost: string;
  otherCosts: string;
}

/**
 * Fixed Asset Form Data
 */
export interface FixedAssetFormData {
  assetName: string;
  usefulLifeYears: string;
  salvageValue: string;
  depreciationMethod: string;
}

/**
 * Payment Form Data (for related records)
 */
export interface PaymentFormData {
  amount: string;
  notes: string;
}

/**
 * Cheque Form Data (for related records)
 */
export interface ChequeRelatedFormData {
  chequeNumber: string;
  amount: string;
  bankName: string;
  issueDate: string; // تاريخ كتابة الشيك - Cheque writing/issue date
  dueDate: string;
  status: string;
  chequeType: string;
  accountingType: 'cashed' | 'postponed' | 'endorsed';
  endorsedToId: string;
  endorsedToName: string;
  chequeImage: File | null;
}

/**
 * Inventory Form Data (for related records)
 */
export interface InventoryRelatedFormData {
  itemName: string;
  quantity: string;
  unit: string;
  thickness: string;
  width: string;
  length: string;
  notes: string;
}

/**
 * Inventory Movement Document Data (from Firestore)
 */
export interface InventoryMovementData {
  itemId: string;
  itemName: string;
  quantity: number;
  type: string; // 'دخول' (entry) or 'خروج' (exit)
  unit?: string;
  linkedTransactionId?: string;
  notes?: string;
  createdAt?: Date;
}

/**
 * Inventory Item Document Data (from Firestore)
 */
export interface InventoryItemData {
  itemName: string;
  category?: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  thickness?: number | null;
  width?: number | null;
  length?: number | null;
  minStock?: number;
  location?: string;
  notes?: string;
  createdAt?: Date;
  lastPurchasePrice?: number;
  lastPurchaseDate?: Date;
  lastPurchaseAmount?: number;
}

/**
 * Initial form data
 */
export const initialLedgerFormData: LedgerFormData = {
  description: "",
  amount: "",
  category: "",
  subCategory: "",
  associatedParty: "",
  ownerName: "",
  date: new Date().toISOString().split("T")[0],
  reference: "",
  notes: "",
  immediateSettlement: false,
  trackARAP: true, // Default to "آجل" (credit) for new entries
};

export const initialCheckFormData: CheckFormData = {
  chequeNumber: "",
  chequeAmount: "",
  bankName: "",
  dueDate: new Date().toISOString().split("T")[0],
  accountingType: "cashed",
  endorsedToName: "",
};

export const initialOutgoingCheckFormData: OutgoingCheckFormData = {
  chequeNumber: "",
  chequeAmount: "",
  bankName: "",
  dueDate: new Date().toISOString().split("T")[0],
  accountingType: "cashed",
  endorsedFromName: "",
};

export const initialInventoryFormData: InventoryFormData = {
  itemId: "",
  itemName: "",
  quantity: "",
  unit: "",
  thickness: "",
  width: "",
  length: "",
  shippingCost: "",
  otherCosts: "",
};

export const initialFixedAssetFormData: FixedAssetFormData = {
  assetName: "",
  usefulLifeYears: "",
  salvageValue: "",
  depreciationMethod: "straight-line",
};

export const initialPaymentFormData: PaymentFormData = {
  amount: "",
  notes: "",
};

export const initialChequeRelatedFormData: ChequeRelatedFormData = {
  chequeNumber: "",
  amount: "",
  bankName: "",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: new Date().toISOString().split("T")[0],
  status: "قيد الانتظار",
  chequeType: "عادي",
  accountingType: "cashed",
  endorsedToId: "",
  endorsedToName: "",
  chequeImage: null,
};

export const initialInventoryRelatedFormData: InventoryRelatedFormData = {
  itemName: "",
  quantity: "",
  unit: "",
  thickness: "",
  width: "",
  length: "",
  notes: "",
};
