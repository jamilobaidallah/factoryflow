"use client";

import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, Trash2, Download, Check, Wallet, Clock, Gift, MinusCircle, Calculator, Banknote, Undo2, RotateCcw } from "lucide-react";
import { Employee, PayrollEntry } from "../types/employees";
import { Advance } from "../types/advances";
import { ADVANCE_STATUS } from "@/lib/constants";
import { safeAdd, safeSubtract, safeMultiply, safeDivide, parseAmount, sumAmounts } from "@/lib/currency";
import { exportPayrollToExcel } from "@/lib/export-payroll-excel";
import { formatNumber } from "@/lib/date-utils";
import { PermissionGate } from "@/components/auth";
import { toDate } from "@/lib/firestore-utils";

export interface PayrollProcessingData {
  overtime: string;
  bonus: string;
  deduction: string;
  notes: string;
}

interface PayrollTableProps {
  employees: Employee[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  monthPayroll: PayrollEntry[];
  /** All payroll entries (for checking if advances are already linked to other months) */
  allPayrollEntries?: PayrollEntry[];
  payrollData: {[key: string]: PayrollProcessingData};
  setPayrollData: (data: {[key: string]: PayrollProcessingData}) => void;
  loading: boolean;
  onProcessPayroll: () => void;
  onMarkAsPaid: (entry: PayrollEntry) => void;
  onDeletePayrollEntry: (entry: PayrollEntry) => void;
  onMarkAllAsPaid?: () => void;
  onUndoMonthPayroll?: () => void;
  onReversePayment?: (entry: PayrollEntry) => void;
  advances?: Advance[];
  /** Overtime hours per employee from overtime entries (employeeId -> hours) */
  overtimeHoursByEmployee?: Map<string, number>;
}

/**
 * Check if employee is eligible for payroll in the selected month
 * Employee must be hired during or before the selected month
 */
function isEmployeeEligibleForMonth(employee: Employee, selectedMonth: string): boolean {
  const [year, month] = selectedMonth.split('-').map(Number);
  const hireDate = toDate(employee.hireDate);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth() + 1; // getMonth() is 0-indexed

  // Employee is eligible if hired in the selected month or any previous month
  if (hireYear < year) {return true;}
  if (hireYear === year && hireMonth <= month) {return true;}
  return false;
}

/**
 * Calculate prorated salary info for an employee in a given month
 */
function getProratedSalaryInfo(employee: Employee, selectedMonth: string): {
  baseSalary: number;
  daysWorked: number;
  daysInMonth: number;
  isProrated: boolean;
} {
  const [year, month] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const hireDate = toDate(employee.hireDate);
  const hireYear = hireDate.getFullYear();
  const hireMonth = hireDate.getMonth() + 1;
  const hireDay = hireDate.getDate();

  // If hired in the selected month after day 1, prorate
  if (hireYear === year && hireMonth === month && hireDay > 1) {
    const daysWorked = daysInMonth - hireDay + 1;
    // Multiply first, then divide to avoid double rounding error
    // e.g., (salary * daysWorked) / daysInMonth instead of (salary / daysInMonth) * daysWorked
    const baseSalary = safeDivide(
      safeMultiply(employee.currentSalary, daysWorked),
      daysInMonth
    );
    return { baseSalary, daysWorked, daysInMonth, isProrated: true };
  }

  return {
    baseSalary: employee.currentSalary,
    daysWorked: daysInMonth,
    daysInMonth,
    isProrated: false,
  };
}

export function PayrollTable({
  employees,
  selectedMonth,
  setSelectedMonth,
  monthPayroll,
  allPayrollEntries = [],
  payrollData,
  setPayrollData,
  loading,
  onProcessPayroll,
  onMarkAsPaid,
  onDeletePayrollEntry,
  onMarkAllAsPaid,
  onUndoMonthPayroll,
  onReversePayment,
  advances = [],
  overtimeHoursByEmployee = new Map(),
}: PayrollTableProps) {
  // Calculate overtime pay at 1x rate (same as regular hourly rate)
  const calculateOvertimePay = (currentSalary: number, overtimeHours: number): number => {
    const hourlyRate = safeDivide(currentSalary, 208);
    return safeMultiply(overtimeHours, hourlyRate);
  };

  // Get overtime hours for an employee from the entries
  const getEmployeeOvertimeHours = useCallback((employeeId: string): number => {
    return overtimeHoursByEmployee.get(employeeId) || 0;
  }, [overtimeHoursByEmployee]);

  // Build a set of advance IDs that are already linked to any payroll entry
  const linkedAdvanceIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of allPayrollEntries) {
      if (entry.advanceIds) {
        for (const id of entry.advanceIds) {
          ids.add(id);
        }
      }
    }
    return ids;
  }, [allPayrollEntries]);

  // Get total active advance amount for an employee (excluding already-linked advances)
  const getEmployeeAdvanceDeduction = useCallback((employeeId: string): number => {
    const activeAdvances = advances.filter(
      (a) => a.employeeId === employeeId &&
             a.status === ADVANCE_STATUS.ACTIVE &&
             !a.linkedPayrollMonth && // Exclude advances with linkedPayrollMonth field
             !linkedAdvanceIds.has(a.id) // Exclude advances already in any payroll entry
    );
    return sumAmounts(activeAdvances.map((a) => a.remainingAmount));
  }, [advances, linkedAdvanceIds]);

  // Filter employees by eligibility for the selected month
  const { eligibleEmployees, ineligibleEmployees } = useMemo(() => {
    const eligible: Employee[] = [];
    const ineligible: Employee[] = [];

    employees.forEach(employee => {
      if (isEmployeeEligibleForMonth(employee, selectedMonth)) {
        eligible.push(employee);
      } else {
        ineligible.push(employee);
      }
    });

    return { eligibleEmployees: eligible, ineligibleEmployees: ineligible };
  }, [employees, selectedMonth]);

  const handleExportToExcel = async () => {
    if (monthPayroll.length === 0) {return;}
    await exportPayrollToExcel(monthPayroll, selectedMonth);
  };

  // Calculate summary statistics for processed payroll
  const payrollSummary = useMemo(() => {
    if (monthPayroll.length === 0) {return null;}

    const totalBase = sumAmounts(monthPayroll.map(e => e.baseSalary));
    const totalOvertime = sumAmounts(monthPayroll.map(e => e.overtimePay));
    const totalBonuses = sumAmounts(monthPayroll.map(e =>
      e.bonuses ? sumAmounts(e.bonuses.map(b => b.amount)) : 0
    ));
    const totalDeductions = sumAmounts(monthPayroll.map(e =>
      e.deductions ? sumAmounts(e.deductions.map(d => d.amount)) : 0
    ));
    const totalAdvanceDeductions = sumAmounts(monthPayroll.map(e => e.advanceDeduction || 0));
    const grandTotal = sumAmounts(monthPayroll.map(e => e.totalSalary));
    const grandNetTotal = sumAmounts(monthPayroll.map(e => e.netSalary ?? e.totalSalary));
    const paidCount = monthPayroll.filter(e => e.isPaid).length;
    const unpaidCount = monthPayroll.length - paidCount;
    const unpaidTotal = sumAmounts(monthPayroll.filter(e => !e.isPaid).map(e => e.netSalary ?? e.totalSalary));

    return {
      totalBase,
      totalOvertime,
      totalBonuses,
      totalDeductions,
      totalAdvanceDeductions,
      grandTotal,
      grandNetTotal,
      paidCount,
      unpaidCount,
      unpaidTotal,
    };
  }, [monthPayroll]);

  // Calculate preview totals for unprocessed payroll (only eligible employees, with proration)
  const previewSummary = useMemo(() => {
    if (monthPayroll.length > 0 || eligibleEmployees.length === 0) {return null;}

    let totalBase = 0;
    let totalOvertime = 0;
    let totalBonuses = 0;
    let totalDeductions = 0;
    let totalAdvanceDeductions = 0;
    let grandTotal = 0;
    let grandNetTotal = 0;
    let proratedCount = 0;
    let advanceCount = 0;
    let totalOvertimeHours = 0;

    eligibleEmployees.forEach(employee => {
      const empData = payrollData[employee.id] || { overtime: "", bonus: "", deduction: "", notes: "" };
      // Get overtime from entries instead of payrollData
      const overtimeHours = getEmployeeOvertimeHours(employee.id);
      const bonus = parseAmount(empData.bonus || "0");
      const deduction = parseAmount(empData.deduction || "0");

      // Get prorated salary info
      const { baseSalary, isProrated } = getProratedSalaryInfo(employee, selectedMonth);
      if (isProrated) {proratedCount++;}

      const overtimePay = employee.overtimeEligible
        ? calculateOvertimePay(employee.currentSalary, overtimeHours)
        : 0;
      const total = safeSubtract(
        safeAdd(safeAdd(baseSalary, overtimePay), bonus),
        deduction
      );

      // Get advance deduction for this employee
      const advanceDeduction = getEmployeeAdvanceDeduction(employee.id);
      if (advanceDeduction > 0) {advanceCount++;}
      const netTotal = safeSubtract(total, advanceDeduction);

      totalBase = safeAdd(totalBase, baseSalary);
      totalOvertime = safeAdd(totalOvertime, overtimePay);
      totalOvertimeHours = safeAdd(totalOvertimeHours, overtimeHours);
      totalBonuses = safeAdd(totalBonuses, bonus);
      totalDeductions = safeAdd(totalDeductions, deduction);
      totalAdvanceDeductions = safeAdd(totalAdvanceDeductions, advanceDeduction);
      grandTotal = safeAdd(grandTotal, total);
      grandNetTotal = safeAdd(grandNetTotal, netTotal);
    });

    return {
      totalBase,
      totalOvertime,
      totalOvertimeHours,
      totalBonuses,
      totalDeductions,
      totalAdvanceDeductions,
      grandTotal,
      grandNetTotal,
      employeeCount: eligibleEmployees.length,
      proratedCount,
      advanceCount,
    };
  }, [eligibleEmployees, payrollData, monthPayroll.length, selectedMonth, getEmployeeAdvanceDeduction, getEmployeeOvertimeHours]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">معالجة الرواتب الشهرية</h3>
        <div className="flex items-center gap-4">
          <Label htmlFor="month">الشهر:</Label>
          <Input
            id="month"
            type="month"
            value={selectedMonth}
            max={new Date().toISOString().slice(0, 7)}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {monthPayroll.length > 0 ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          {payrollSummary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="rounded-lg p-4 bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                  <Wallet className="w-4 h-4" />
                  الرواتب الأساسية
                </div>
                <div className="text-xl font-bold text-slate-900">
                  {formatNumber(payrollSummary.totalBase)}
                </div>
              </div>
              <div className="rounded-lg p-4 bg-primary-50 border border-primary-100">
                <div className="flex items-center gap-2 text-primary-600 text-sm mb-1">
                  <Clock className="w-4 h-4" />
                  الأجر الإضافي
                </div>
                <div className="text-xl font-bold text-primary-900">
                  +{formatNumber(payrollSummary.totalOvertime)}
                </div>
              </div>
              <div className="rounded-lg p-4 bg-success-50 border border-success-100">
                <div className="flex items-center gap-2 text-success-600 text-sm mb-1">
                  <Gift className="w-4 h-4" />
                  المكافآت
                </div>
                <div className="text-xl font-bold text-success-900">
                  +{formatNumber(payrollSummary.totalBonuses)}
                </div>
              </div>
              <div className="rounded-lg p-4 bg-danger-50 border border-danger-100">
                <div className="flex items-center gap-2 text-danger-600 text-sm mb-1">
                  <MinusCircle className="w-4 h-4" />
                  الخصومات
                </div>
                <div className="text-xl font-bold text-danger-900">
                  -{formatNumber(payrollSummary.totalDeductions)}
                </div>
              </div>
              {payrollSummary.totalAdvanceDeductions > 0 && (
                <div className="rounded-lg p-4 bg-warning-50 border border-warning-100">
                  <div className="flex items-center gap-2 text-warning-600 text-sm mb-1">
                    <Banknote className="w-4 h-4" />
                    خصم السلف
                  </div>
                  <div className="text-xl font-bold text-warning-900">
                    -{formatNumber(payrollSummary.totalAdvanceDeductions)}
                  </div>
                </div>
              )}
              <div className="rounded-lg p-4 bg-primary-100 border border-primary-200">
                <div className="flex items-center gap-2 text-primary-700 text-sm mb-1">
                  <Calculator className="w-4 h-4" />
                  صافي المستحق
                </div>
                <div className="text-xl font-bold text-primary-900">
                  {formatNumber(payrollSummary.grandNetTotal)}
                </div>
              </div>
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="text-sm">
                <span className="text-slate-500">الحالة:</span>
                <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
                  مدفوع: {payrollSummary?.paidCount || 0}
                </span>
                <span className="mr-1 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
                  غير مدفوع: {payrollSummary?.unpaidCount || 0}
                </span>
              </div>
              {payrollSummary && payrollSummary.unpaidCount > 0 && (
                <div className="text-sm text-danger-600 font-medium">
                  المتبقي: {formatNumber(payrollSummary.unpaidTotal)} دينار
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {payrollSummary && payrollSummary.unpaidCount > 0 && onMarkAllAsPaid && (
                <PermissionGate action="update" module="employees">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onMarkAllAsPaid}
                    disabled={loading}
                    className="gap-2"
                  >
                    <Check className="w-4 h-4" />
                    دفع الكل
                  </Button>
                </PermissionGate>
              )}
              {payrollSummary && payrollSummary.unpaidCount > 0 && onUndoMonthPayroll && (
                <PermissionGate action="delete" module="employees">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUndoMonthPayroll}
                    disabled={loading}
                    className="gap-2 text-warning-600 border-warning-200 hover:bg-warning-50"
                  >
                    <Undo2 className="w-4 h-4" />
                    تراجع عن الشهر
                  </Button>
                </PermissionGate>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportToExcel}
                className="gap-2"
                aria-label="تصدير الرواتب إلى Excel"
              >
                <Download className="w-4 h-4" aria-hidden="true" />
                تصدير Excel
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الراتب الأساسي</TableHead>
                  <TableHead>أجر إضافي</TableHead>
                  <TableHead className="text-green-700">مكافآت</TableHead>
                  <TableHead className="text-red-700">خصومات</TableHead>
                  <TableHead className="text-warning-700">سلف</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>صافي المستحق</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthPayroll.map((entry) => {
                  const bonusTotal = entry.bonuses ? sumAmounts(entry.bonuses.map(b => b.amount)) : 0;
                  const deductionTotal = entry.deductions ? sumAmounts(entry.deductions.map(d => d.amount)) : 0;
                  const advanceDeduction = entry.advanceDeduction || 0;
                  const netSalary = entry.netSalary ?? safeSubtract(entry.totalSalary, advanceDeduction);

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.employeeName}
                        {entry.isProrated && entry.daysWorked && entry.daysInMonth && (
                          <span className="block text-xs text-warning-600">
                            ({entry.daysWorked} يوم من {entry.daysInMonth})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.isProrated && entry.fullMonthlySalary ? (
                          <div>
                            <span className="text-warning-700">{formatNumber(entry.baseSalary)} دينار</span>
                            <span className="block text-xs text-gray-400 line-through">{entry.fullMonthlySalary}</span>
                          </div>
                        ) : (
                          <span>{formatNumber(entry.baseSalary)} دينار</span>
                        )}
                      </TableCell>
                      <TableCell>{entry.overtimePay > 0 ? `${formatNumber(entry.overtimePay)} دينار` : "-"}</TableCell>
                      <TableCell className="text-green-600">
                        {bonusTotal > 0 ? `+${formatNumber(bonusTotal)}` : "-"}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {deductionTotal > 0 ? `-${formatNumber(deductionTotal)}` : "-"}
                      </TableCell>
                      <TableCell className="text-warning-600">
                        {advanceDeduction > 0 ? `-${formatNumber(advanceDeduction)}` : "-"}
                      </TableCell>
                      <TableCell>
                        {formatNumber(entry.totalSalary)} دينار
                      </TableCell>
                      <TableCell className="font-bold text-primary-700">
                        {formatNumber(netSalary)} دينار
                      </TableCell>
                      <TableCell>
                        {entry.isPaid ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700" role="status" aria-label="حالة الدفع: تم الدفع">
                            تم الدفع
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700" role="status" aria-label="حالة الدفع: لم يتم الدفع">
                            لم يتم الدفع
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {!entry.isPaid ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => onMarkAsPaid(entry)}
                              disabled={loading}
                              aria-label={`تسجيل دفع راتب ${entry.employeeName}`}
                            >
                              <DollarSign className="w-4 h-4 ml-1" aria-hidden="true" />
                              تسجيل دفع
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDeletePayrollEntry(entry)}
                              disabled={loading}
                              aria-label={`حذف سجل راتب ${entry.employeeName}`}
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </Button>
                          </div>
                        ) : onReversePayment && (
                          <PermissionGate action="update" module="employees">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onReversePayment(entry)}
                              disabled={loading}
                              className="gap-1 text-warning-600 border-warning-200 hover:bg-warning-50"
                              aria-label={`عكس دفع راتب ${entry.employeeName}`}
                            >
                              <RotateCcw className="w-4 h-4" aria-hidden="true" />
                              عكس الدفع
                            </Button>
                          </PermissionGate>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : employees.length > 0 ? (
        <div className="space-y-6">
          {/* Ineligible employees warning */}
          {ineligibleEmployees.length > 0 && (
            <div className="p-4 rounded-lg bg-warning-50 border border-warning-200">
              <h4 className="font-medium text-warning-800 mb-2">
                موظفون غير مؤهلين لهذا الشهر ({ineligibleEmployees.length})
              </h4>
              <p className="text-sm text-warning-700 mb-2">
                الموظفون التالية أسماؤهم تم تعيينهم بعد بداية الشهر المحدد:
              </p>
              <ul className="text-sm text-warning-600 list-disc list-inside">
                {ineligibleEmployees.map(emp => {
                  const hireDate = toDate(emp.hireDate);
                  return (
                    <li key={emp.id}>
                      {emp.name} - تاريخ التعيين: {hireDate.toLocaleDateString('ar-EG')}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Preview Summary */}
          {previewSummary && (
            <div className="p-4 rounded-lg bg-primary-50 border border-primary-100">
              <h4 className="font-medium text-primary-800 mb-3 flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                معاينة الإجماليات
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                <div>
                  <span className="text-primary-600">الرواتب الأساسية:</span>
                  <span className="font-bold text-primary-900 mr-2">{formatNumber(previewSummary.totalBase)}</span>
                </div>
                <div>
                  <span className="text-primary-600">الأجر الإضافي:</span>
                  <span className="font-bold text-success-600 mr-2">+{formatNumber(previewSummary.totalOvertime)}</span>
                </div>
                <div>
                  <span className="text-primary-600">المكافآت:</span>
                  <span className="font-bold text-success-600 mr-2">+{formatNumber(previewSummary.totalBonuses)}</span>
                </div>
                <div>
                  <span className="text-primary-600">الخصومات:</span>
                  <span className="font-bold text-danger-600 mr-2">-{formatNumber(previewSummary.totalDeductions)}</span>
                </div>
                {previewSummary.totalAdvanceDeductions > 0 && (
                  <div>
                    <span className="text-primary-600">خصم السلف:</span>
                    <span className="font-bold text-warning-600 mr-2">-{formatNumber(previewSummary.totalAdvanceDeductions)}</span>
                  </div>
                )}
                <div className="col-span-2 md:col-span-1">
                  <span className="text-primary-600">صافي المستحق:</span>
                  <span className="font-bold text-primary-900 mr-2 text-lg">{formatNumber(previewSummary.grandNetTotal)} دينار</span>
                </div>
              </div>
            </div>
          )}

          {eligibleEmployees.length > 0 ? (
            <>
              <p className="text-sm text-gray-600">
                أدخل بيانات الراتب لكل موظف (ساعات إضافية، مكافآت، خصومات):
              </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الموظف</TableHead>
                  <TableHead>الراتب الأساسي</TableHead>
                  <TableHead>ساعات إضافية</TableHead>
                  <TableHead className="text-green-700">مكافآت</TableHead>
                  <TableHead className="text-red-700">خصومات</TableHead>
                  <TableHead className="text-warning-700">سلف</TableHead>
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>صافي المستحق</TableHead>
                  <TableHead>ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleEmployees.map((employee) => {
                  const empData = payrollData[employee.id] || { overtime: "", bonus: "", deduction: "", notes: "" };
                  // Get overtime from entries instead of payrollData
                  const overtimeHours = getEmployeeOvertimeHours(employee.id);
                  const bonus = parseAmount(empData.bonus || "0");
                  const deduction = parseAmount(empData.deduction || "0");

                  // Get prorated salary info
                  const { baseSalary, daysWorked, daysInMonth, isProrated } = getProratedSalaryInfo(employee, selectedMonth);

                  const overtimePay = employee.overtimeEligible
                    ? calculateOvertimePay(employee.currentSalary, overtimeHours)
                    : 0;
                  const total = safeSubtract(
                    safeAdd(safeAdd(baseSalary, overtimePay), bonus),
                    deduction
                  );

                  // Get advance deduction for this employee
                  const advanceDeduction = getEmployeeAdvanceDeduction(employee.id);
                  const netSalary = safeSubtract(total, advanceDeduction);

                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.name}
                        {isProrated && (
                          <span className="block text-xs text-warning-600">
                            ({daysWorked} يوم من {daysInMonth})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isProrated ? (
                          <div>
                            <span className="text-warning-700">{formatNumber(baseSalary)} دينار</span>
                            <span className="block text-xs text-gray-400 line-through">{employee.currentSalary}</span>
                          </div>
                        ) : (
                          <span>{employee.currentSalary} دينار</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.overtimeEligible ? (
                          overtimeHours > 0 ? (
                            <div className="text-primary-600">
                              <span className="font-medium">{formatNumber(overtimeHours)}</span>
                              <span className="text-xs text-primary-500 block">
                                ({formatNumber(overtimePay)} د)
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={empData.bonus || ""}
                          onChange={(e) =>
                            setPayrollData({
                              ...payrollData,
                              [employee.id]: {
                                ...empData,
                                bonus: e.target.value,
                              },
                            })
                          }
                          placeholder="0"
                          className="w-24 border-green-200 focus:border-green-400"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={empData.deduction || ""}
                          onChange={(e) =>
                            setPayrollData({
                              ...payrollData,
                              [employee.id]: {
                                ...empData,
                                deduction: e.target.value,
                              },
                            })
                          }
                          placeholder="0"
                          className="w-24 border-red-200 focus:border-red-400"
                        />
                      </TableCell>
                      <TableCell className="text-warning-600">
                        {advanceDeduction > 0 ? `-${formatNumber(advanceDeduction)}` : "-"}
                      </TableCell>
                      <TableCell>{formatNumber(total)} دينار</TableCell>
                      <TableCell className="font-bold text-primary-700">{formatNumber(netSalary)} دينار</TableCell>
                      <TableCell>
                        <Input
                          value={empData.notes || ""}
                          onChange={(e) =>
                            setPayrollData({
                              ...payrollData,
                              [employee.id]: {
                                ...empData,
                                notes: e.target.value,
                              },
                            })
                          }
                          placeholder="ملاحظات"
                          className="w-28"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={onProcessPayroll}
              disabled={loading}
              size="lg"
              className="gap-2"
              aria-label={`معالجة رواتب شهر ${selectedMonth}`}
            >
              <DollarSign className="w-5 h-5" aria-hidden="true" />
              معالجة الرواتب
            </Button>
          </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-8">
              جميع الموظفين تم تعيينهم بعد بداية الشهر المحدد. اختر شهراً آخر.
            </p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-12">
          لا يوجد موظفين. قم بإضافة موظفين أولاً.
        </p>
      )}
    </div>
  );
}
