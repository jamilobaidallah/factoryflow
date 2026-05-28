"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.advances = exports.overtimeEntries = exports.payroll = exports.salaryHistory = exports.employees = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.employees = (0, sqlite_core_1.sqliteTable)('employees', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    currentSalary: (0, sqlite_core_1.real)('current_salary').notNull().default(0),
    overtimeEligible: (0, sqlite_core_1.integer)('overtime_eligible', { mode: 'boolean' }).notNull().default(true),
    hireDate: (0, sqlite_core_1.text)('hire_date').notNull(),
    position: (0, sqlite_core_1.text)('position').notNull().default(''),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    profileIdx: (0, sqlite_core_1.index)('emp_profile_idx').on(table.profileId),
}));
exports.salaryHistory = (0, sqlite_core_1.sqliteTable)('salary_history', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    employeeId: (0, sqlite_core_1.text)('employee_id').notNull().references(() => exports.employees.id),
    employeeName: (0, sqlite_core_1.text)('employee_name').notNull(),
    oldSalary: (0, sqlite_core_1.real)('old_salary').notNull(),
    newSalary: (0, sqlite_core_1.real)('new_salary').notNull(),
    incrementPercentage: (0, sqlite_core_1.real)('increment_percentage').notNull().default(0),
    effectiveDate: (0, sqlite_core_1.text)('effective_date').notNull(),
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    employeeIdx: (0, sqlite_core_1.index)('sh_employee_idx').on(table.employeeId),
}));
exports.payroll = (0, sqlite_core_1.sqliteTable)('payroll', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    employeeId: (0, sqlite_core_1.text)('employee_id').notNull().references(() => exports.employees.id),
    employeeName: (0, sqlite_core_1.text)('employee_name').notNull(),
    month: (0, sqlite_core_1.text)('month').notNull(), // "2025-11"
    baseSalary: (0, sqlite_core_1.real)('base_salary').notNull(),
    fullMonthlySalary: (0, sqlite_core_1.real)('full_monthly_salary'),
    daysWorked: (0, sqlite_core_1.real)('days_worked'),
    daysInMonth: (0, sqlite_core_1.integer)('days_in_month'),
    isProrated: (0, sqlite_core_1.integer)('is_prorated', { mode: 'boolean' }).default(false),
    overtimeHours: (0, sqlite_core_1.real)('overtime_hours').notNull().default(0),
    overtimePay: (0, sqlite_core_1.real)('overtime_pay').notNull().default(0),
    // JSON arrays stored as text
    deductions: (0, sqlite_core_1.text)('deductions'), // JSON: Array<{id,type,description,amount}>
    bonuses: (0, sqlite_core_1.text)('bonuses'), // JSON: Array<{id,type,description,amount}>
    advanceDeduction: (0, sqlite_core_1.real)('advance_deduction').default(0),
    advanceIds: (0, sqlite_core_1.text)('advance_ids'), // JSON: string[]
    totalSalary: (0, sqlite_core_1.real)('total_salary').notNull(),
    netSalary: (0, sqlite_core_1.real)('net_salary'),
    isPaid: (0, sqlite_core_1.integer)('is_paid', { mode: 'boolean' }).notNull().default(false),
    paidDate: (0, sqlite_core_1.text)('paid_date'),
    linkedTransactionId: (0, sqlite_core_1.text)('linked_transaction_id'),
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    employeeIdx: (0, sqlite_core_1.index)('pay_employee_idx').on(table.employeeId),
    monthIdx: (0, sqlite_core_1.index)('pay_month_idx').on(table.month),
}));
exports.overtimeEntries = (0, sqlite_core_1.sqliteTable)('overtime_entries', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    employeeId: (0, sqlite_core_1.text)('employee_id').notNull().references(() => exports.employees.id),
    employeeName: (0, sqlite_core_1.text)('employee_name').notNull(),
    date: (0, sqlite_core_1.text)('date').notNull(),
    hours: (0, sqlite_core_1.real)('hours').notNull(),
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    month: (0, sqlite_core_1.text)('month').notNull(), // "2025-01"
    linkedPayrollId: (0, sqlite_core_1.text)('linked_payroll_id'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
    createdBy: (0, sqlite_core_1.text)('created_by').notNull().default(''),
}, (table) => ({
    employeeIdx: (0, sqlite_core_1.index)('ot_employee_idx').on(table.employeeId),
    monthIdx: (0, sqlite_core_1.index)('ot_month_idx').on(table.month),
}));
exports.advances = (0, sqlite_core_1.sqliteTable)('advances', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    profileId: (0, sqlite_core_1.text)('profile_id').notNull(),
    employeeId: (0, sqlite_core_1.text)('employee_id').notNull().references(() => exports.employees.id),
    employeeName: (0, sqlite_core_1.text)('employee_name').notNull(),
    amount: (0, sqlite_core_1.real)('amount').notNull(),
    date: (0, sqlite_core_1.text)('date').notNull(),
    remainingAmount: (0, sqlite_core_1.real)('remaining_amount').notNull(),
    status: (0, sqlite_core_1.text)('status').notNull().default('pending'), // 'pending' | 'deducted' | 'cancelled'
    linkedTransactionId: (0, sqlite_core_1.text)('linked_transaction_id').notNull(),
    linkedPayrollMonth: (0, sqlite_core_1.text)('linked_payroll_month'),
    notes: (0, sqlite_core_1.text)('notes').notNull().default(''),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
}, (table) => ({
    employeeIdx: (0, sqlite_core_1.index)('adv_employee_idx').on(table.employeeId),
}));
