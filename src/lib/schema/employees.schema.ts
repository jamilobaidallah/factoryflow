import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const employees = sqliteTable('employees', {
  id:                text('id').primaryKey(),
  profileId:         text('profile_id').notNull(),
  name:              text('name').notNull(),
  currentSalary:     real('current_salary').notNull().default(0),
  overtimeEligible:  integer('overtime_eligible', { mode: 'boolean' }).notNull().default(true),
  hireDate:          text('hire_date').notNull(),
  position:          text('position').notNull().default(''),
  createdAt:         text('created_at').notNull(),
}, (table) => ({
  profileIdx: index('emp_profile_idx').on(table.profileId),
}));

export const salaryHistory = sqliteTable('salary_history', {
  id:                   text('id').primaryKey(),
  profileId:            text('profile_id').notNull(),
  employeeId:           text('employee_id').notNull().references(() => employees.id),
  employeeName:         text('employee_name').notNull(),
  oldSalary:            real('old_salary').notNull(),
  newSalary:            real('new_salary').notNull(),
  incrementPercentage:  real('increment_percentage').notNull().default(0),
  effectiveDate:        text('effective_date').notNull(),
  notes:                text('notes').notNull().default(''),
  createdAt:            text('created_at').notNull(),
}, (table) => ({
  employeeIdx: index('sh_employee_idx').on(table.employeeId),
}));

export const payroll = sqliteTable('payroll', {
  id:                   text('id').primaryKey(),
  profileId:            text('profile_id').notNull(),
  employeeId:           text('employee_id').notNull().references(() => employees.id),
  employeeName:         text('employee_name').notNull(),
  month:                text('month').notNull(),             // "2025-11"
  baseSalary:           real('base_salary').notNull(),
  fullMonthlySalary:    real('full_monthly_salary'),
  daysWorked:           real('days_worked'),
  daysInMonth:          integer('days_in_month'),
  isProrated:           integer('is_prorated', { mode: 'boolean' }).default(false),

  overtimeHours:        real('overtime_hours').notNull().default(0),
  overtimePay:          real('overtime_pay').notNull().default(0),

  // JSON arrays stored as text
  deductions:           text('deductions'),                 // JSON: Array<{id,type,description,amount}>
  bonuses:              text('bonuses'),                    // JSON: Array<{id,type,description,amount}>

  advanceDeduction:     real('advance_deduction').default(0),
  advanceIds:           text('advance_ids'),                // JSON: string[]

  totalSalary:          real('total_salary').notNull(),
  netSalary:            real('net_salary'),
  isPaid:               integer('is_paid', { mode: 'boolean' }).notNull().default(false),
  paidDate:             text('paid_date'),
  linkedTransactionId:  text('linked_transaction_id'),
  notes:                text('notes').notNull().default(''),
  createdAt:            text('created_at').notNull(),
}, (table) => ({
  employeeIdx: index('pay_employee_idx').on(table.employeeId),
  monthIdx:    index('pay_month_idx').on(table.month),
}));

export const overtimeEntries = sqliteTable('overtime_entries', {
  id:               text('id').primaryKey(),
  profileId:        text('profile_id').notNull(),
  employeeId:       text('employee_id').notNull().references(() => employees.id),
  employeeName:     text('employee_name').notNull(),
  date:             text('date').notNull(),
  hours:            real('hours').notNull(),
  notes:            text('notes').notNull().default(''),
  month:            text('month').notNull(),                // "2025-01"
  linkedPayrollId:  text('linked_payroll_id'),
  createdAt:        text('created_at').notNull(),
  createdBy:        text('created_by').notNull().default(''),
}, (table) => ({
  employeeIdx: index('ot_employee_idx').on(table.employeeId),
  monthIdx:    index('ot_month_idx').on(table.month),
}));

export const advances = sqliteTable('advances', {
  id:                   text('id').primaryKey(),
  profileId:            text('profile_id').notNull(),
  employeeId:           text('employee_id').notNull().references(() => employees.id),
  employeeName:         text('employee_name').notNull(),
  amount:               real('amount').notNull(),
  date:                 text('date').notNull(),
  remainingAmount:      real('remaining_amount').notNull(),
  status:               text('status').notNull().default('pending'), // 'pending' | 'deducted' | 'cancelled'
  linkedTransactionId:  text('linked_transaction_id').notNull(),
  linkedPayrollMonth:   text('linked_payroll_month'),
  notes:                text('notes').notNull().default(''),
  createdAt:            text('created_at').notNull(),
}, (table) => ({
  employeeIdx: index('adv_employee_idx').on(table.employeeId),
}));
