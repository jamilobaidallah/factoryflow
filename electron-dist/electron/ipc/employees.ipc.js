"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEmployeesHandlers = registerEmployeesHandlers;
const electron_1 = require("electron");
const active_db_1 = require("../active-db");
const employees_queries_1 = require("../queries/employees.queries");
function registerEmployeesHandlers() {
    // Employees
    electron_1.ipcMain.handle('employees:getAll', (_, profileId) => (0, employees_queries_1.getEmployees)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('employees:getById', (_, id) => (0, employees_queries_1.getEmployeeById)((0, active_db_1.getActiveDb)(), id));
    electron_1.ipcMain.handle('employees:create', (_, data) => (0, employees_queries_1.createEmployee)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('employees:update', (_, id, data) => (0, employees_queries_1.updateEmployee)((0, active_db_1.getActiveDb)(), id, data));
    electron_1.ipcMain.handle('employees:delete', (_, id) => (0, employees_queries_1.deleteEmployee)((0, active_db_1.getActiveDb)(), id));
    // Salary History
    electron_1.ipcMain.handle('salary-history:getAll', (_, profileId) => (0, employees_queries_1.getSalaryHistory)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('salary-history:getForEmployee', (_, employeeId) => (0, employees_queries_1.getSalaryHistoryForEmployee)((0, active_db_1.getActiveDb)(), employeeId));
    // Payroll
    electron_1.ipcMain.handle('payroll:getAll', (_, profileId) => (0, employees_queries_1.getPayroll)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('payroll:getForEmployee', (_, employeeId) => (0, employees_queries_1.getPayrollForEmployee)((0, active_db_1.getActiveDb)(), employeeId));
    electron_1.ipcMain.handle('payroll:create', (_, data) => (0, employees_queries_1.createPayrollEntry)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('payroll:update', (_, id, data) => (0, employees_queries_1.updatePayrollEntry)((0, active_db_1.getActiveDb)(), id, data));
    // Overtime
    electron_1.ipcMain.handle('overtime:getAll', (_, profileId) => (0, employees_queries_1.getOvertimeEntries)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('overtime:getForMonth', (_, employeeId, month) => (0, employees_queries_1.getOvertimeForMonth)((0, active_db_1.getActiveDb)(), employeeId, month));
    electron_1.ipcMain.handle('overtime:create', (_, data) => (0, employees_queries_1.createOvertimeEntry)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('overtime:delete', (_, id) => (0, employees_queries_1.deleteOvertimeEntry)((0, active_db_1.getActiveDb)(), id));
    // Advances
    electron_1.ipcMain.handle('advances:getAll', (_, profileId) => (0, employees_queries_1.getAdvances)((0, active_db_1.getActiveDb)(), profileId));
    electron_1.ipcMain.handle('advances:create', (_, data) => (0, employees_queries_1.createAdvance)((0, active_db_1.getActiveDb)(), data));
    electron_1.ipcMain.handle('advances:update', (_, id, data) => (0, employees_queries_1.updateAdvance)((0, active_db_1.getActiveDb)(), id, data));
}
