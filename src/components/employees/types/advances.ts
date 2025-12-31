import { AdvanceStatus } from "@/lib/constants";

export interface Advance {
  id: string;
  employeeId: string;
  employeeName: string;
  amount: number;
  date: Date;
  remainingAmount: number;
  status: AdvanceStatus;
  linkedTransactionId: string;
  notes: string;
  createdAt: Date;
}

export interface AdvanceFormData {
  employeeId: string;
  amount: string;
  date: string;
  notes: string;
}

export const initialAdvanceFormData: AdvanceFormData = {
  employeeId: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
};
