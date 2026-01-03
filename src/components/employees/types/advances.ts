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
  /** The payroll month this advance is linked to (e.g., "2025-11"). Set when payroll is processed. */
  linkedPayrollMonth?: string;
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
