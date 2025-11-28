/**
 * LedgerFormContext - Context for ledger form state management
 * Eliminates prop drilling by providing form state through context
 */

import { createContext, useContext, ReactNode } from "react";
import {
  LedgerFormData,
  CheckFormData,
  OutgoingCheckFormData,
  InventoryFormData,
  FixedAssetFormData,
  LedgerEntry,
} from "../types/ledger";

interface Client {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  name: string;
}

/**
 * Context value interface containing all form state and handlers
 */
export interface LedgerFormContextValue {
  // Dialog control
  isOpen: boolean;
  onClose: () => void;
  editingEntry: LedgerEntry | null;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;

  // Reference data
  clients: Client[];
  partners: Partner[];

  // Main form state
  formData: LedgerFormData;
  setFormData: (data: LedgerFormData) => void;

  // Additional options flags
  hasIncomingCheck: boolean;
  setHasIncomingCheck: (value: boolean) => void;
  hasOutgoingCheck: boolean;
  setHasOutgoingCheck: (value: boolean) => void;
  hasInventoryUpdate: boolean;
  setHasInventoryUpdate: (value: boolean) => void;
  hasFixedAsset: boolean;
  setHasFixedAsset: (value: boolean) => void;
  hasInitialPayment: boolean;
  setHasInitialPayment: (value: boolean) => void;
  initialPaymentAmount: string;
  setInitialPaymentAmount: (value: string) => void;

  // Related form data
  checkFormData: CheckFormData;
  setCheckFormData: (data: CheckFormData) => void;
  outgoingCheckFormData: OutgoingCheckFormData;
  setOutgoingCheckFormData: (data: OutgoingCheckFormData) => void;
  inventoryFormData: InventoryFormData;
  setInventoryFormData: (data: InventoryFormData) => void;
  fixedAssetFormData: FixedAssetFormData;
  setFixedAssetFormData: (data: FixedAssetFormData) => void;

  // Invoice creation bridge
  createInvoice?: boolean;
  setCreateInvoice?: (value: boolean) => void;
}

const LedgerFormContext = createContext<LedgerFormContextValue | undefined>(undefined);

/**
 * Provider props interface
 */
interface LedgerFormProviderProps {
  children: ReactNode;
  value: LedgerFormContextValue;
}

/**
 * Provider component for ledger form context
 */
export function LedgerFormProvider({ children, value }: LedgerFormProviderProps) {
  return (
    <LedgerFormContext.Provider value={value}>
      {children}
    </LedgerFormContext.Provider>
  );
}

/**
 * Custom hook to access ledger form context
 * @throws Error if used outside of LedgerFormProvider
 */
export function useLedgerFormContext(): LedgerFormContextValue {
  const context = useContext(LedgerFormContext);
  if (context === undefined) {
    throw new Error("useLedgerFormContext must be used within a LedgerFormProvider");
  }
  return context;
}
