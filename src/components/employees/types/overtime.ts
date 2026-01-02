export interface OvertimeEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  date: Date;
  hours: number;
  notes: string;
  month: string; // "2025-01" format for easy querying
  linkedPayrollId?: string; // Set when payroll is processed
  createdAt: Date;
  createdBy: string;
}

export interface OvertimeFormData {
  employeeId: string;
  date: string;
  hours: string;
  notes: string;
}

export const initialOvertimeFormData: OvertimeFormData = {
  employeeId: "",
  date: new Date().toISOString().split("T")[0],
  hours: "",
  notes: "",
};

// Helper to get month string from date
export function getMonthFromDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 7); // "2025-01"
}
