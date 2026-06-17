import { eq, asc, desc } from 'drizzle-orm';
import type { DrizzleDb } from '../../src/lib/database';
import { employees, salaryHistory, payroll, overtimeEntries, advances } from '../../src/lib/schema/employees.schema';

export type EmployeeRow      = typeof employees.$inferSelect;
export type NewEmployeeRow   = typeof employees.$inferInsert;
export type SalaryHistoryRow = typeof salaryHistory.$inferSelect;
export type PayrollRow       = typeof payroll.$inferSelect;
export type NewPayrollRow    = typeof payroll.$inferInsert;
export type OvertimeRow      = typeof overtimeEntries.$inferSelect;
export type NewOvertimeRow   = typeof overtimeEntries.$inferInsert;
export type AdvanceRow       = typeof advances.$inferSelect;
export type NewAdvanceRow    = typeof advances.$inferInsert;

// ── Employees ────────────────────────────────────────────────────────────────

export function getEmployees(db: DrizzleDb, profileId: string): EmployeeRow[] {
  return db.select().from(employees)
    .where(eq(employees.profileId, profileId))
    .orderBy(asc(employees.name))
    .all();
}

export function getEmployeeById(db: DrizzleDb, id: string): EmployeeRow | undefined {
  return db.select().from(employees).where(eq(employees.id, id)).get();
}

export function createEmployee(db: DrizzleDb, data: NewEmployeeRow): EmployeeRow {
  return db.insert(employees).values(data).returning().get();
}

export function updateEmployee(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<EmployeeRow, 'id' | 'profileId' | 'createdAt'>>
): EmployeeRow | undefined {
  return db.update(employees).set(data).where(eq(employees.id, id)).returning().get();
}

export function deleteEmployee(db: DrizzleDb, id: string): void {
  // Remove all linked records before deleting the employee (FK constraints)
  db.delete(advances).where(eq(advances.employeeId, id)).run();
  db.delete(payroll).where(eq(payroll.employeeId, id)).run();
  db.delete(overtimeEntries).where(eq(overtimeEntries.employeeId, id)).run();
  db.delete(salaryHistory).where(eq(salaryHistory.employeeId, id)).run();
  db.delete(employees).where(eq(employees.id, id)).run();
}

// ── Salary History ────────────────────────────────────────────────────────────

export function getSalaryHistory(db: DrizzleDb, profileId: string): SalaryHistoryRow[] {
  return db.select().from(salaryHistory)
    .where(eq(salaryHistory.profileId, profileId))
    .orderBy(desc(salaryHistory.effectiveDate))
    .all();
}

export function getSalaryHistoryForEmployee(db: DrizzleDb, employeeId: string): SalaryHistoryRow[] {
  return db.select().from(salaryHistory)
    .where(eq(salaryHistory.employeeId, employeeId))
    .orderBy(desc(salaryHistory.effectiveDate))
    .all();
}

// ── Payroll ───────────────────────────────────────────────────────────────────

export function getPayroll(db: DrizzleDb, profileId: string): PayrollRow[] {
  return db.select().from(payroll)
    .where(eq(payroll.profileId, profileId))
    .orderBy(desc(payroll.month))
    .all();
}

export function getPayrollForEmployee(db: DrizzleDb, employeeId: string): PayrollRow[] {
  return db.select().from(payroll)
    .where(eq(payroll.employeeId, employeeId))
    .orderBy(desc(payroll.month))
    .all();
}

export function createPayrollEntry(db: DrizzleDb, data: NewPayrollRow): PayrollRow {
  return db.insert(payroll).values(data).returning().get();
}

export function updatePayrollEntry(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<PayrollRow, 'id' | 'profileId' | 'createdAt'>>
): PayrollRow | undefined {
  return db.update(payroll).set(data).where(eq(payroll.id, id)).returning().get();
}

// ── Overtime ──────────────────────────────────────────────────────────────────

export function getOvertimeEntries(db: DrizzleDb, profileId: string): OvertimeRow[] {
  return db.select().from(overtimeEntries)
    .where(eq(overtimeEntries.profileId, profileId))
    .orderBy(desc(overtimeEntries.date))
    .all();
}

export function getOvertimeForMonth(db: DrizzleDb, employeeId: string, month: string): OvertimeRow[] {
  return db.select().from(overtimeEntries)
    .where(eq(overtimeEntries.employeeId, employeeId))
    .all()
    .filter(o => o.month === month);
}

export function createOvertimeEntry(db: DrizzleDb, data: NewOvertimeRow): OvertimeRow {
  return db.insert(overtimeEntries).values(data).returning().get();
}

export function deleteOvertimeEntry(db: DrizzleDb, id: string): void {
  db.delete(overtimeEntries).where(eq(overtimeEntries.id, id)).run();
}

// ── Advances ──────────────────────────────────────────────────────────────────

export function getAdvances(db: DrizzleDb, profileId: string): AdvanceRow[] {
  return db.select().from(advances)
    .where(eq(advances.profileId, profileId))
    .orderBy(desc(advances.date))
    .all();
}

export function createAdvance(db: DrizzleDb, data: NewAdvanceRow): AdvanceRow {
  return db.insert(advances).values(data).returning().get();
}

export function updateAdvance(
  db: DrizzleDb,
  id: string,
  data: Partial<Omit<AdvanceRow, 'id' | 'profileId' | 'createdAt'>>
): AdvanceRow | undefined {
  return db.update(advances).set(data).where(eq(advances.id, id)).returning().get();
}
