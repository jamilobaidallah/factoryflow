/**
 * Ledger Entry Interface
 */
export interface LedgerEntry {
  id: string;
  transactionId: string;
  description: string;
  type: string; // "دخل" or "مصروف"
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
 * Check Form Data (Incoming)
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
 * Inventory Form Data
 */
export interface InventoryFormData {
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
  trackARAP: false,
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
