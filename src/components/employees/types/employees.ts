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

export interface PayrollEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string; // "2025-11"
  baseSalary: number;
  overtimeHours: number;
  overtimePay: number;
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
