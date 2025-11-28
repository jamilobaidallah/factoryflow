export interface Cheque {
  id: string;
  chequeNumber: string;
  clientName: string;
  amount: number;
  type: string;
  chequeType?: string;
  status: string;
  chequeImageUrl?: string;
  endorsedTo?: string;
  endorsedDate?: Date;
  isEndorsedCheque?: boolean;
  endorsedFromId?: string;
  linkedTransactionId: string;
  issueDate: Date;
  dueDate: Date;
  bankName: string;
  notes: string;
  createdAt: Date;
  clientPhone?: string;
}

export interface ChequeFormData {
  chequeNumber: string;
  clientName: string;
  amount: string;
  type: string;
  status: string;
  linkedTransactionId: string;
  issueDate: string;
  dueDate: string;
  bankName: string;
  notes: string;
}

export const initialChequeFormData: ChequeFormData = {
  chequeNumber: "",
  clientName: "",
  amount: "",
  type: "وارد",
  status: "قيد الانتظار",
  linkedTransactionId: "",
  issueDate: new Date().toISOString().split("T")[0],
  dueDate: new Date().toISOString().split("T")[0],
  bankName: "",
  notes: "",
};
