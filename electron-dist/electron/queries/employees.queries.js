"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEmployees = getEmployees;
exports.getEmployeeById = getEmployeeById;
exports.createEmployee = createEmployee;
exports.updateEmployee = updateEmployee;
exports.deleteEmployee = deleteEmployee;
exports.getSalaryHistory = getSalaryHistory;
exports.getSalaryHistoryForEmployee = getSalaryHistoryForEmployee;
exports.getPayroll = getPayroll;
exports.getPayrollForEmployee = getPayrollForEmployee;
exports.createPayrollEntry = createPayrollEntry;
exports.updatePayrollEntry = updatePayrollEntry;
exports.getOvertimeEntries = getOvertimeEntries;
exports.getOvertimeForMonth = getOvertimeForMonth;
exports.createOvertimeEntry = createOvertimeEntry;
exports.deleteOvertimeEntry = deleteOvertimeEntry;
exports.getAdvances = getAdvances;
exports.createAdvance = createAdvance;
exports.updateAdvance = updateAdvance;
const drizzle_orm_1 = require("drizzle-orm");
const employees_schema_1 = require("../../src/lib/schema/employees.schema");
// ── Employees ────────────────────────────────────────────────────────────────
function getEmployees(db, profileId) {
    return db.select().from(employees_schema_1.employees)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.employees.profileId, profileId))
        .orderBy((0, drizzle_orm_1.asc)(employees_schema_1.employees.name))
        .all();
}
function getEmployeeById(db, id) {
    return db.select().from(employees_schema_1.employees).where((0, drizzle_orm_1.eq)(employees_schema_1.employees.id, id)).get();
}
function createEmployee(db, data) {
    return db.insert(employees_schema_1.employees).values(data).returning().get();
}
function updateEmployee(db, id, data) {
    return db.update(employees_schema_1.employees).set(data).where((0, drizzle_orm_1.eq)(employees_schema_1.employees.id, id)).returning().get();
}
function deleteEmployee(db, id) {
    // Remove all linked records before deleting the employee (FK constraints)
    db.delete(employees_schema_1.advances).where((0, drizzle_orm_1.eq)(employees_schema_1.advances.employeeId, id)).run();
    db.delete(employees_schema_1.payroll).where((0, drizzle_orm_1.eq)(employees_schema_1.payroll.employeeId, id)).run();
    db.delete(employees_schema_1.overtimeEntries).where((0, drizzle_orm_1.eq)(employees_schema_1.overtimeEntries.employeeId, id)).run();
    db.delete(employees_schema_1.salaryHistory).where((0, drizzle_orm_1.eq)(employees_schema_1.salaryHistory.employeeId, id)).run();
    db.delete(employees_schema_1.employees).where((0, drizzle_orm_1.eq)(employees_schema_1.employees.id, id)).run();
}
// ── Salary History ────────────────────────────────────────────────────────────
function getSalaryHistory(db, profileId) {
    return db.select().from(employees_schema_1.salaryHistory)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.salaryHistory.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(employees_schema_1.salaryHistory.effectiveDate))
        .all();
}
function getSalaryHistoryForEmployee(db, employeeId) {
    return db.select().from(employees_schema_1.salaryHistory)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.salaryHistory.employeeId, employeeId))
        .orderBy((0, drizzle_orm_1.desc)(employees_schema_1.salaryHistory.effectiveDate))
        .all();
}
// ── Payroll ───────────────────────────────────────────────────────────────────
function getPayroll(db, profileId) {
    return db.select().from(employees_schema_1.payroll)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.payroll.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(employees_schema_1.payroll.month))
        .all();
}
function getPayrollForEmployee(db, employeeId) {
    return db.select().from(employees_schema_1.payroll)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.payroll.employeeId, employeeId))
        .orderBy((0, drizzle_orm_1.desc)(employees_schema_1.payroll.month))
        .all();
}
function createPayrollEntry(db, data) {
    return db.insert(employees_schema_1.payroll).values(data).returning().get();
}
function updatePayrollEntry(db, id, data) {
    return db.update(employees_schema_1.payroll).set(data).where((0, drizzle_orm_1.eq)(employees_schema_1.payroll.id, id)).returning().get();
}
// ── Overtime ──────────────────────────────────────────────────────────────────
function getOvertimeEntries(db, profileId) {
    return db.select().from(employees_schema_1.overtimeEntries)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.overtimeEntries.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(employees_schema_1.overtimeEntries.date))
        .all();
}
function getOvertimeForMonth(db, employeeId, month) {
    return db.select().from(employees_schema_1.overtimeEntries)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.overtimeEntries.employeeId, employeeId))
        .all()
        .filter(o => o.month === month);
}
function createOvertimeEntry(db, data) {
    return db.insert(employees_schema_1.overtimeEntries).values(data).returning().get();
}
function deleteOvertimeEntry(db, id) {
    db.delete(employees_schema_1.overtimeEntries).where((0, drizzle_orm_1.eq)(employees_schema_1.overtimeEntries.id, id)).run();
}
// ── Advances ──────────────────────────────────────────────────────────────────
function getAdvances(db, profileId) {
    return db.select().from(employees_schema_1.advances)
        .where((0, drizzle_orm_1.eq)(employees_schema_1.advances.profileId, profileId))
        .orderBy((0, drizzle_orm_1.desc)(employees_schema_1.advances.date))
        .all();
}
function createAdvance(db, data) {
    return db.insert(employees_schema_1.advances).values(data).returning().get();
}
function updateAdvance(db, id, data) {
    return db.update(employees_schema_1.advances).set(data).where((0, drizzle_orm_1.eq)(employees_schema_1.advances.id, id)).returning().get();
}
