export interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  thickness?: number;
  width?: number;
  length?: number;
  unitPrice?: number;
}

export interface ProductionOrder {
  id: string;
  orderNumber: string;
  date: Date;
  inputItemId: string;
  inputItemName: string;
  inputQuantity: number;
  inputThickness?: number;
  inputWidth?: number;
  inputLength?: number;
  outputItemName: string;
  outputQuantity: number;
  outputThickness?: number;
  outputWidth?: number;
  outputLength?: number;
  unit: string;
  productionExpenses: number;
  status: "قيد التنفيذ" | "مكتمل" | "ملغي";
  notes: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface ProductionFormData {
  inputItemId: string;
  inputQuantity: string;
  outputItemName: string;
  outputQuantity: string;
  outputThickness: string;
  outputWidth: string;
  outputLength: string;
  productionExpenses: string;
  date: string;
  notes: string;
}

export const initialFormData: ProductionFormData = {
  inputItemId: "",
  inputQuantity: "",
  outputItemName: "",
  outputQuantity: "",
  outputThickness: "",
  outputWidth: "",
  outputLength: "",
  productionExpenses: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
};
