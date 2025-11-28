// وحدات القياس للمصنع
// Unit types for manufacturing
export type InvoiceItemUnit = 'm' | 'm2' | 'piece';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  // بيانات التصنيع - Manufacturing data
  unit?: InvoiceItemUnit;
  length?: number;    // الطول (سم)
  width?: number;     // العرض (سم)
  thickness?: number; // السماكة (سم)
}

// نوع البيانات للحفظ في Firestore - Clean item type for Firestore save
export interface CleanInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit: InvoiceItemUnit;
  length?: number;
  width?: number;
  thickness?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  invoiceDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  notes?: string;
  linkedTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceFormData {
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  invoiceDate: string;
  taxRate: string;
  notes: string;
}

export const initialFormData: InvoiceFormData = {
  clientName: "",
  clientAddress: "",
  clientPhone: "",
  invoiceDate: new Date().toISOString().split("T")[0],
  taxRate: "0",
  notes: "",
};

export const initialInvoiceItem: InvoiceItem = {
  description: "",
  quantity: 1,
  unitPrice: 0,
  total: 0,
  unit: 'piece',
  length: undefined,
  width: undefined,
  thickness: undefined,
};
