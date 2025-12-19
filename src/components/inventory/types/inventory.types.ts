export interface InventoryItem {
  id: string;
  itemName: string;
  category: string;
  subCategory?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  minStock: number;
  location: string;
  notes: string;
  thickness?: number;
  width?: number;
  length?: number;
  createdAt: Date;
  // Weighted Average Cost tracking (optional fields)
  lastPurchasePrice?: number;
  lastPurchaseDate?: Date;
  lastPurchaseAmount?: number;
}

export interface InventoryMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: string;
  quantity: number;
  unit?: string;
  linkedTransactionId?: string;
  notes?: string;
  userEmail?: string;
  createdAt: Date;
}

export interface InventoryFormData {
  itemName: string;
  category: string;
  subCategory: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  minStock: string;
  location: string;
  notes: string;
  thickness: string;
  width: string;
  length: string;
}

export interface MovementFormData {
  type: string;
  quantity: string;
  linkedTransactionId: string;
  notes: string;
}

export const INITIAL_FORM_DATA: InventoryFormData = {
  itemName: "",
  category: "",
  subCategory: "",
  quantity: "",
  unit: "",
  unitPrice: "",
  minStock: "0",
  location: "",
  notes: "",
  thickness: "",
  width: "",
  length: "",
};

export const INITIAL_MOVEMENT_DATA: MovementFormData = {
  type: "دخول",
  quantity: "",
  linkedTransactionId: "",
  notes: "",
};
