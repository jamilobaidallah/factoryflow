/**
 * Custom hook for ledger form state management
 * Centralizes all form state for adding/editing ledger entries
 */

import { useState } from "react";
import { LedgerEntry } from "../utils/ledger-constants";

export interface LedgerFormState {
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

export interface CheckFormState {
  chequeNumber: string;
  chequeAmount: string;
  bankName: string;
  dueDate: string;
  // Accounting type for proper cheque handling
  accountingType: 'cashed' | 'postponed' | 'endorsed';
  endorsedToName: string;
}

export interface InventoryFormState {
  itemName: string;
  quantity: string;
  unit: string;
  thickness: string;
  width: string;
  length: string;
  shippingCost: string;
  otherCosts: string;
}

export interface FixedAssetFormState {
  assetName: string;
  usefulLifeYears: string;
  salvageValue: string;
  depreciationMethod: string;
}

export interface PaymentFormState {
  amount: string;
  notes: string;
}

export interface ChequeRelatedFormState {
  chequeNumber: string;
  amount: string;
  bankName: string;
  dueDate: string;
  status: string;
  chequeType: string;
  // Accounting type: 'cashed' (immediate), 'postponed' (post-dated), 'endorsed' (to third party)
  accountingType: 'cashed' | 'postponed' | 'endorsed';
  endorsedToId: string;
  endorsedToName: string;
  chequeImage: File | null;
}

export interface InventoryRelatedFormState {
  itemName: string;
  quantity: string;
  unit: string;
  thickness: string;
  width: string;
  length: string;
  notes: string;
}

const initialFormData: LedgerFormState = {
  description: "",
  amount: "",
  category: "",
  subCategory: "",
  date: new Date().toISOString().split("T")[0],
  associatedParty: "",
  ownerName: "",
  reference: "",
  notes: "",
  trackARAP: false,
  immediateSettlement: false,
};

const initialCheckFormData: CheckFormState = {
  chequeNumber: "",
  chequeAmount: "",
  bankName: "",
  dueDate: new Date().toISOString().split("T")[0],
  accountingType: "cashed",
  endorsedToName: "",
};

const initialInventoryFormData: InventoryFormState = {
  itemName: "",
  quantity: "",
  unit: "",
  thickness: "",
  width: "",
  length: "",
  shippingCost: "",
  otherCosts: "",
};

const initialFixedAssetFormData: FixedAssetFormState = {
  assetName: "",
  usefulLifeYears: "",
  salvageValue: "",
  depreciationMethod: "straight-line",
};

const initialPaymentFormData: PaymentFormState = {
  amount: "",
  notes: "",
};

const initialChequeRelatedFormData: ChequeRelatedFormState = {
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

const initialInventoryRelatedFormData: InventoryRelatedFormState = {
  itemName: "",
  quantity: "",
  unit: "",
  thickness: "",
  width: "",
  length: "",
  notes: "",
};

export function useLedgerForm(editingEntry?: LedgerEntry | null) {
  // Main ledger entry form
  const [formData, setFormData] = useState<LedgerFormState>(initialFormData);

  // Additional options flags
  const [hasIncomingCheck, setHasIncomingCheck] = useState(false);
  const [hasInventoryUpdate, setHasInventoryUpdate] = useState(false);
  const [hasFixedAsset, setHasFixedAsset] = useState(false);
  const [hasInitialPayment, setHasInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");

  // Related forms for batch operations
  const [checkFormData, setCheckFormData] = useState<CheckFormState>(initialCheckFormData);
  const [inventoryFormData, setInventoryFormData] = useState<InventoryFormState>(initialInventoryFormData);
  const [fixedAssetFormData, setFixedAssetFormData] = useState<FixedAssetFormState>(initialFixedAssetFormData);

  // Related records dialog forms
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormState>(initialPaymentFormData);
  const [chequeRelatedFormData, setChequeRelatedFormData] = useState<ChequeRelatedFormState>(initialChequeRelatedFormData);
  const [inventoryRelatedFormData, setInventoryRelatedFormData] = useState<InventoryRelatedFormState>(initialInventoryRelatedFormData);

  /**
   * Reset all form data to initial state
   */
  const resetAllForms = () => {
    setFormData(initialFormData);
    setHasIncomingCheck(false);
    setHasInventoryUpdate(false);
    setHasFixedAsset(false);
    setHasInitialPayment(false);
    setInitialPaymentAmount("");
    setCheckFormData(initialCheckFormData);
    setInventoryFormData(initialInventoryFormData);
    setFixedAssetFormData(initialFixedAssetFormData);
    setPaymentFormData(initialPaymentFormData);
    setChequeRelatedFormData(initialChequeRelatedFormData);
    setInventoryRelatedFormData(initialInventoryRelatedFormData);
  };

  /**
   * Load entry data into form for editing
   */
  const loadEntryForEdit = (entry: LedgerEntry) => {
    setFormData({
      description: entry.description,
      amount: entry.amount.toString(),
      category: entry.category,
      subCategory: entry.subCategory,
      date: entry.date instanceof Date
        ? entry.date.toISOString().split("T")[0]
        : new Date(entry.date).toISOString().split("T")[0],
      associatedParty: entry.associatedParty || "",
      ownerName: (entry as any).ownerName || "",
      reference: entry.reference || "",
      notes: entry.notes || "",
      trackARAP: entry.isARAPEntry || false,
      immediateSettlement: false,
    });
  };

  /**
   * Reset payment form
   */
  const resetPaymentForm = () => {
    setPaymentFormData(initialPaymentFormData);
  };

  /**
   * Reset cheque form
   */
  const resetChequeForm = () => {
    setChequeRelatedFormData(initialChequeRelatedFormData);
  };

  /**
   * Reset inventory form
   */
  const resetInventoryForm = () => {
    setInventoryRelatedFormData(initialInventoryRelatedFormData);
  };

  return {
    // Main form state
    formData,
    setFormData,

    // Additional options
    hasIncomingCheck,
    setHasIncomingCheck,
    hasInventoryUpdate,
    setHasInventoryUpdate,
    hasFixedAsset,
    setHasFixedAsset,
    hasInitialPayment,
    setHasInitialPayment,
    initialPaymentAmount,
    setInitialPaymentAmount,

    // Related forms
    checkFormData,
    setCheckFormData,
    inventoryFormData,
    setInventoryFormData,
    fixedAssetFormData,
    setFixedAssetFormData,

    // Related records forms
    paymentFormData,
    setPaymentFormData,
    chequeRelatedFormData,
    setChequeRelatedFormData,
    inventoryRelatedFormData,
    setInventoryRelatedFormData,

    // Helper functions
    resetAllForms,
    loadEntryForEdit,
    resetPaymentForm,
    resetChequeForm,
    resetInventoryForm,
  };
}
