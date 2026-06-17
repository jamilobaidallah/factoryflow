import { ipcMain } from 'electron';
import { getActiveDb } from '../active-db';
import {
  getEmployees, getEmployeeById, createEmployee, updateEmployee, deleteEmployee,
  getSalaryHistory, getSalaryHistoryForEmployee,
  getPayroll, getPayrollForEmployee, createPayrollEntry, updatePayrollEntry,
  getOvertimeEntries, getOvertimeForMonth, createOvertimeEntry, deleteOvertimeEntry,
  getAdvances, createAdvance, updateAdvance,
  type NewEmployeeRow, type NewPayrollRow, type NewOvertimeRow, type NewAdvanceRow,
} from '../queries/employees.queries';

export function registerEmployeesHandlers(): void {
  // Employees
  ipcMain.handle('employees:getAll', (_, profileId: string) =>
    getEmployees(getActiveDb(), profileId)
  );
  ipcMain.handle('employees:getById', (_, id: string) =>
    getEmployeeById(getActiveDb(), id)
  );
  ipcMain.handle('employees:create', (_, data: NewEmployeeRow) =>
    createEmployee(getActiveDb(), data)
  );
  ipcMain.handle('employees:update', (_, id: string, data: Record<string, unknown>) =>
    updateEmployee(getActiveDb(), id, data)
  );
  ipcMain.handle('employees:delete', (_, id: string) =>
    deleteEmployee(getActiveDb(), id)
  );

  // Salary History
  ipcMain.handle('salary-history:getAll', (_, profileId: string) =>
    getSalaryHistory(getActiveDb(), profileId)
  );
  ipcMain.handle('salary-history:getForEmployee', (_, employeeId: string) =>
    getSalaryHistoryForEmployee(getActiveDb(), employeeId)
  );

  // Payroll
  ipcMain.handle('payroll:getAll', (_, profileId: string) =>
    getPayroll(getActiveDb(), profileId)
  );
  ipcMain.handle('payroll:getForEmployee', (_, employeeId: string) =>
    getPayrollForEmployee(getActiveDb(), employeeId)
  );
  ipcMain.handle('payroll:create', (_, data: NewPayrollRow) =>
    createPayrollEntry(getActiveDb(), data)
  );
  ipcMain.handle('payroll:update', (_, id: string, data: Record<string, unknown>) =>
    updatePayrollEntry(getActiveDb(), id, data)
  );

  // Overtime
  ipcMain.handle('overtime:getAll', (_, profileId: string) =>
    getOvertimeEntries(getActiveDb(), profileId)
  );
  ipcMain.handle('overtime:getForMonth', (_, employeeId: string, month: string) =>
    getOvertimeForMonth(getActiveDb(), employeeId, month)
  );
  ipcMain.handle('overtime:create', (_, data: NewOvertimeRow) =>
    createOvertimeEntry(getActiveDb(), data)
  );
  ipcMain.handle('overtime:delete', (_, id: string) =>
    deleteOvertimeEntry(getActiveDb(), id)
  );

  // Advances
  ipcMain.handle('advances:getAll', (_, profileId: string) =>
    getAdvances(getActiveDb(), profileId)
  );
  ipcMain.handle('advances:create', (_, data: NewAdvanceRow) =>
    createAdvance(getActiveDb(), data)
  );
  ipcMain.handle('advances:update', (_, id: string, data: Record<string, unknown>) =>
    updateAdvance(getActiveDb(), id, data)
  );
}
