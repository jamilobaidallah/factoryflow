/**
 * Ledger Page Reducer
 * Consolidates fragmented state management into a single useReducer pattern
 */

import {
  LedgerEntry,
  LedgerFormData,
  CheckFormData,
  CheckFormDataItem,
  OutgoingCheckFormData,
  OutgoingCheckFormDataItem,
  InventoryFormData,
  FixedAssetFormData,
  initialLedgerFormData,
  initialCheckFormData,
  initialOutgoingCheckFormData,
  initialInventoryFormData,
  initialFixedAssetFormData,
} from "../types/ledger";
import type { AdvanceAllocationResult } from "../components/AdvanceAllocationDialog";

/**
 * Consolidated page state interface
 */
export interface LedgerPageState {
  // Pagination
  pagination: {
    currentPage: number;
    pageSize: number;
  };

  // Dialog visibility states
  dialogs: {
    form: boolean;
    related: boolean;
    quickPay: boolean;
    quickInvoice: boolean;
    writeOff: boolean;
    advanceAllocation: boolean;
    favorites: boolean;
    saveFavorite: boolean;
  };

  // Selected/editing data
  data: {
    editingEntry: LedgerEntry | null;
    selectedEntry: LedgerEntry | null;
    quickPayEntry: LedgerEntry | null;
    writeOffEntry: LedgerEntry | null;
    pendingInvoiceData: { clientName: string; amount: number } | null;
  };

  // UI state
  ui: {
    loading: boolean;
    relatedTab: "payments" | "cheques" | "inventory";
    createInvoice: boolean;
  };

  // Advance allocation state (for applying customer/supplier advances to invoices)
  advanceAllocation: {
    pendingSubmission: boolean;  // True when waiting for user to confirm/skip allocations
    allocations: AdvanceAllocationResult[];  // Selected advance allocations
  };

  // Main ledger form
  form: {
    formData: LedgerFormData;
    hasIncomingCheck: boolean;
    hasOutgoingCheck: boolean;
    hasInventoryUpdate: boolean;
    hasFixedAsset: boolean;
    hasInitialPayment: boolean;
    initialPaymentAmount: string;
    checkFormData: CheckFormData;
    outgoingCheckFormData: OutgoingCheckFormData;
    // Multiple cheques support
    incomingChequesList: CheckFormDataItem[];
    outgoingChequesList: OutgoingCheckFormDataItem[];
    inventoryFormData: InventoryFormData;
    fixedAssetFormData: FixedAssetFormData;
  };
}

/**
 * Initial state
 */
export const initialLedgerPageState: LedgerPageState = {
  pagination: {
    currentPage: 1,
    pageSize: 50,
  },
  dialogs: {
    form: false,
    related: false,
    quickPay: false,
    quickInvoice: false,
    writeOff: false,
    advanceAllocation: false,
    favorites: false,
    saveFavorite: false,
  },
  data: {
    editingEntry: null,
    selectedEntry: null,
    quickPayEntry: null,
    writeOffEntry: null,
    pendingInvoiceData: null,
  },
  ui: {
    loading: false,
    relatedTab: "payments",
    createInvoice: false,
  },
  advanceAllocation: {
    pendingSubmission: false,
    allocations: [],
  },
  form: {
    formData: initialLedgerFormData,
    hasIncomingCheck: false,
    hasOutgoingCheck: false,
    hasInventoryUpdate: false,
    hasFixedAsset: false,
    hasInitialPayment: false,
    initialPaymentAmount: "",
    checkFormData: initialCheckFormData,
    outgoingCheckFormData: initialOutgoingCheckFormData,
    incomingChequesList: [],
    outgoingChequesList: [],
    inventoryFormData: initialInventoryFormData,
    fixedAssetFormData: initialFixedAssetFormData,
  },
};

/**
 * Action types
 */
export type LedgerPageAction =
  // Pagination actions
  | { type: "SET_CURRENT_PAGE"; payload: number }

  // Dialog actions
  | { type: "OPEN_FORM_DIALOG" }
  | { type: "CLOSE_FORM_DIALOG" }
  | { type: "OPEN_RELATED_DIALOG"; payload: LedgerEntry }
  | { type: "CLOSE_RELATED_DIALOG" }
  | { type: "OPEN_QUICK_PAY_DIALOG"; payload: LedgerEntry }
  | { type: "CLOSE_QUICK_PAY_DIALOG" }
  | { type: "OPEN_QUICK_INVOICE_DIALOG"; payload: { clientName: string; amount: number } }
  | { type: "CLOSE_QUICK_INVOICE_DIALOG" }
  | { type: "OPEN_WRITE_OFF_DIALOG"; payload: LedgerEntry }
  | { type: "CLOSE_WRITE_OFF_DIALOG" }
  | { type: "OPEN_ADVANCE_ALLOCATION_DIALOG" }
  | { type: "CLOSE_ADVANCE_ALLOCATION_DIALOG" }
  | { type: "SET_ADVANCE_ALLOCATIONS"; payload: AdvanceAllocationResult[] }
  | { type: "CLEAR_ADVANCE_ALLOCATIONS" }
  | { type: "OPEN_FAVORITES_PANEL" }
  | { type: "CLOSE_FAVORITES_PANEL" }
  | { type: "OPEN_SAVE_FAVORITE_DIALOG" }
  | { type: "CLOSE_SAVE_FAVORITE_DIALOG" }
  | { type: "USE_FAVORITE"; payload: { formData: LedgerFormData } }

  // Data actions
  | { type: "SET_EDITING_ENTRY"; payload: LedgerEntry | null }
  | { type: "START_EDIT"; payload: LedgerEntry }

  // UI actions
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_RELATED_TAB"; payload: "payments" | "cheques" | "inventory" }
  | { type: "SET_CREATE_INVOICE"; payload: boolean }

  // Form actions
  | { type: "SET_FORM_DATA"; payload: LedgerFormData }
  | { type: "UPDATE_FORM_FIELD"; payload: { field: keyof LedgerFormData; value: string | boolean } }
  | { type: "SET_HAS_INCOMING_CHECK"; payload: boolean }
  | { type: "SET_HAS_OUTGOING_CHECK"; payload: boolean }
  | { type: "SET_HAS_INVENTORY_UPDATE"; payload: boolean }
  | { type: "SET_HAS_FIXED_ASSET"; payload: boolean }
  | { type: "SET_HAS_INITIAL_PAYMENT"; payload: boolean }
  | { type: "SET_INITIAL_PAYMENT_AMOUNT"; payload: string }
  | { type: "SET_CHECK_FORM_DATA"; payload: CheckFormData }
  | { type: "SET_OUTGOING_CHECK_FORM_DATA"; payload: OutgoingCheckFormData }
  | { type: "SET_INCOMING_CHEQUES_LIST"; payload: CheckFormDataItem[] }
  | { type: "SET_OUTGOING_CHEQUES_LIST"; payload: OutgoingCheckFormDataItem[] }
  | { type: "SET_INVENTORY_FORM_DATA"; payload: InventoryFormData }
  | { type: "SET_FIXED_ASSET_FORM_DATA"; payload: FixedAssetFormData }

  // Compound actions
  | { type: "RESET_FORMS" }
  | { type: "SUBMIT_SUCCESS"; payload?: { clientName: string; amount: number } }
  | { type: "OPEN_ADD_DIALOG" };

/**
 * Reducer function
 */
export function ledgerPageReducer(
  state: LedgerPageState,
  action: LedgerPageAction
): LedgerPageState {
  switch (action.type) {
    // Pagination
    case "SET_CURRENT_PAGE":
      return {
        ...state,
        pagination: { ...state.pagination, currentPage: action.payload },
      };

    // Dialog visibility
    case "OPEN_FORM_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, form: true },
      };

    case "CLOSE_FORM_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, form: false },
      };

    case "OPEN_RELATED_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, related: true },
        data: { ...state.data, selectedEntry: action.payload },
      };

    case "CLOSE_RELATED_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, related: false },
      };

    case "OPEN_QUICK_PAY_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, quickPay: true },
        data: { ...state.data, quickPayEntry: action.payload },
      };

    case "CLOSE_QUICK_PAY_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, quickPay: false },
        data: { ...state.data, quickPayEntry: null },
      };

    case "OPEN_QUICK_INVOICE_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, quickInvoice: true },
        data: { ...state.data, pendingInvoiceData: action.payload },
      };

    case "CLOSE_QUICK_INVOICE_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, quickInvoice: false },
        data: { ...state.data, pendingInvoiceData: null },
      };

    case "OPEN_WRITE_OFF_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, writeOff: true },
        data: { ...state.data, writeOffEntry: action.payload },
      };

    case "CLOSE_WRITE_OFF_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, writeOff: false },
        data: { ...state.data, writeOffEntry: null },
      };

    case "OPEN_ADVANCE_ALLOCATION_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, advanceAllocation: true },
        advanceAllocation: { ...state.advanceAllocation, pendingSubmission: true },
      };

    case "CLOSE_ADVANCE_ALLOCATION_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, advanceAllocation: false },
        advanceAllocation: { ...state.advanceAllocation, pendingSubmission: false },
      };

    case "SET_ADVANCE_ALLOCATIONS":
      return {
        ...state,
        advanceAllocation: { ...state.advanceAllocation, allocations: action.payload },
      };

    case "CLEAR_ADVANCE_ALLOCATIONS":
      return {
        ...state,
        advanceAllocation: { pendingSubmission: false, allocations: [] },
      };

    case "OPEN_FAVORITES_PANEL":
      return {
        ...state,
        dialogs: { ...state.dialogs, favorites: true },
      };

    case "CLOSE_FAVORITES_PANEL":
      return {
        ...state,
        dialogs: { ...state.dialogs, favorites: false },
      };

    case "OPEN_SAVE_FAVORITE_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, saveFavorite: true },
      };

    case "CLOSE_SAVE_FAVORITE_DIALOG":
      return {
        ...state,
        dialogs: { ...state.dialogs, saveFavorite: false },
      };

    case "USE_FAVORITE":
      return {
        ...state,
        dialogs: { ...state.dialogs, favorites: false, form: true },
        form: {
          ...state.form,
          formData: action.payload.formData,
        },
        data: { ...state.data, editingEntry: null },
      };

    // Data
    case "SET_EDITING_ENTRY":
      return {
        ...state,
        data: { ...state.data, editingEntry: action.payload },
      };

    case "START_EDIT": {
      const entry = action.payload;
      return {
        ...state,
        data: { ...state.data, editingEntry: entry },
        dialogs: { ...state.dialogs, form: true },
        form: {
          ...state.form,
          formData: {
            description: entry.description,
            amount: entry.amount.toString(),
            category: entry.category,
            subCategory: entry.subCategory,
            date: entry.date instanceof Date
              ? entry.date.toISOString().split("T")[0]
              : new Date(entry.date).toISOString().split("T")[0],
            associatedParty: entry.associatedParty || "",
            ownerName: entry.ownerName || "",
            trackARAP: entry.isARAPEntry || false,
            immediateSettlement: false,
          },
        },
      };
    }

    // UI
    case "SET_LOADING":
      return {
        ...state,
        ui: { ...state.ui, loading: action.payload },
      };

    case "SET_RELATED_TAB":
      return {
        ...state,
        ui: { ...state.ui, relatedTab: action.payload },
      };

    case "SET_CREATE_INVOICE":
      return {
        ...state,
        ui: { ...state.ui, createInvoice: action.payload },
      };

    // Form data
    case "SET_FORM_DATA":
      return {
        ...state,
        form: { ...state.form, formData: action.payload },
      };

    case "UPDATE_FORM_FIELD":
      return {
        ...state,
        form: {
          ...state.form,
          formData: {
            ...state.form.formData,
            [action.payload.field]: action.payload.value,
          },
        },
      };

    case "SET_HAS_INCOMING_CHECK":
      return {
        ...state,
        form: { ...state.form, hasIncomingCheck: action.payload },
      };

    case "SET_HAS_OUTGOING_CHECK":
      return {
        ...state,
        form: { ...state.form, hasOutgoingCheck: action.payload },
      };

    case "SET_HAS_INVENTORY_UPDATE":
      return {
        ...state,
        form: { ...state.form, hasInventoryUpdate: action.payload },
      };

    case "SET_HAS_FIXED_ASSET":
      return {
        ...state,
        form: { ...state.form, hasFixedAsset: action.payload },
      };

    case "SET_HAS_INITIAL_PAYMENT":
      return {
        ...state,
        form: { ...state.form, hasInitialPayment: action.payload },
      };

    case "SET_INITIAL_PAYMENT_AMOUNT":
      return {
        ...state,
        form: { ...state.form, initialPaymentAmount: action.payload },
      };

    case "SET_CHECK_FORM_DATA":
      return {
        ...state,
        form: { ...state.form, checkFormData: action.payload },
      };

    case "SET_OUTGOING_CHECK_FORM_DATA":
      return {
        ...state,
        form: { ...state.form, outgoingCheckFormData: action.payload },
      };

    case "SET_INCOMING_CHEQUES_LIST":
      return {
        ...state,
        form: { ...state.form, incomingChequesList: action.payload },
      };

    case "SET_OUTGOING_CHEQUES_LIST":
      return {
        ...state,
        form: { ...state.form, outgoingChequesList: action.payload },
      };

    case "SET_INVENTORY_FORM_DATA":
      return {
        ...state,
        form: { ...state.form, inventoryFormData: action.payload },
      };

    case "SET_FIXED_ASSET_FORM_DATA":
      return {
        ...state,
        form: { ...state.form, fixedAssetFormData: action.payload },
      };

    // Compound actions
    case "RESET_FORMS":
      return {
        ...state,
        form: {
          formData: initialLedgerFormData,
          hasIncomingCheck: false,
          hasOutgoingCheck: false,
          hasInventoryUpdate: false,
          hasFixedAsset: false,
          hasInitialPayment: false,
          initialPaymentAmount: "",
          checkFormData: initialCheckFormData,
          outgoingCheckFormData: initialOutgoingCheckFormData,
          incomingChequesList: [],
          outgoingChequesList: [],
          inventoryFormData: initialInventoryFormData,
          fixedAssetFormData: initialFixedAssetFormData,
        },
      };

    case "SUBMIT_SUCCESS": {
      const newState: LedgerPageState = {
        ...state,
        form: {
          formData: initialLedgerFormData,
          hasIncomingCheck: false,
          hasOutgoingCheck: false,
          hasInventoryUpdate: false,
          hasFixedAsset: false,
          hasInitialPayment: false,
          initialPaymentAmount: "",
          checkFormData: initialCheckFormData,
          outgoingCheckFormData: initialOutgoingCheckFormData,
          incomingChequesList: [],
          outgoingChequesList: [],
          inventoryFormData: initialInventoryFormData,
          fixedAssetFormData: initialFixedAssetFormData,
        },
        data: { ...state.data, editingEntry: null },
        dialogs: { ...state.dialogs, form: false, advanceAllocation: false },
        ui: { ...state.ui, createInvoice: false },
        advanceAllocation: { pendingSubmission: false, allocations: [] },
      };

      // If invoice data provided, open invoice dialog
      if (action.payload) {
        return {
          ...newState,
          dialogs: { ...newState.dialogs, quickInvoice: true },
          data: { ...newState.data, pendingInvoiceData: action.payload },
        };
      }

      return newState;
    }

    case "OPEN_ADD_DIALOG":
      return {
        ...state,
        form: {
          formData: initialLedgerFormData,
          hasIncomingCheck: false,
          hasOutgoingCheck: false,
          hasInventoryUpdate: false,
          hasFixedAsset: false,
          hasInitialPayment: false,
          initialPaymentAmount: "",
          checkFormData: initialCheckFormData,
          outgoingCheckFormData: initialOutgoingCheckFormData,
          incomingChequesList: [],
          outgoingChequesList: [],
          inventoryFormData: initialInventoryFormData,
          fixedAssetFormData: initialFixedAssetFormData,
        },
        data: { ...state.data, editingEntry: null },
        dialogs: { ...state.dialogs, form: true },
        ui: { ...state.ui, createInvoice: false },
        advanceAllocation: { pendingSubmission: false, allocations: [] },
      };

    default:
      return state;
  }
}
