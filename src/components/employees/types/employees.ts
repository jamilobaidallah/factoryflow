import { PayrollDeductionType, PayrollBonusType } from "@/lib/constants";

export interface Employee {
  id: string;
  name: string;
  currentSalary: number;
  overtimeEligible: boolean;
  hireDate: Date;
  position: string;
  createdAt: Date;
}

export interface SalaryHistory {
  id: string;
  employeeId: string;
  employeeName: string;
  oldSalary: number;
  newSalary: number;
  incrementPercentage: number;
  effectiveDate: Date;
  notes: string;
  createdAt: Date;
}

export interface PayrollDeduction {
  id: string;
  type: PayrollDeductionType;
  description: string;
  amount: number;
}

export interface PayrollBonus {
  id: string;
  type: PayrollBonusType;
  description: string;
  amount: number;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // "2025-11"
  baseSalary: number;
  fullMonthlySalary?: number; // Original monthly salary before proration
  daysWorked?: number; // Days worked in the month
  daysInMonth?: number; // Total days in the month
  isProrated?: boolean; // Whether salary was prorated
  overtimeHours: number;
  overtimePay: number;
  deductions?: PayrollDeduction[];
  bonuses?: PayrollBonus[];
  advanceDeduction?: number;
  totalSalary: number;
  isPaid: boolean;
  paidDate?: Date;
  linkedTransactionId?: string;
  notes: string;
  createdAt: Date;
}

export interface EmployeeFormData {
  name: string;
  currentSalary: string;
  overtimeEligible: boolean;
  position: string;
  hireDate: string;
}

export const initialEmployeeFormData: EmployeeFormData = {
  name: "",
  currentSalary: "",
  overtimeEligible: false,
  position: "",
  hireDate: new Date().toISOString().split("T")[0],
};
