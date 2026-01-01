"use client";

import { useMemo } from "react";
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
import { DollarSign, Trash2, Download, Check, Wallet, Clock, Gift, MinusCircle, Calculator } from "lucide-react";
import { Employee, PayrollEntry } from "../types/employees";
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
  payrollData: {[key: string]: PayrollProcessingData};
  setPayrollData: (data: {[key: string]: PayrollProcessingData}) => void;
  loading: boolean;
  onProcessPayroll: () => void;
  onMarkAsPaid: (entry: PayrollEntry) => void;
  onDeletePayrollEntry: (entry: PayrollEntry) => void;
  onMarkAllAsPaid?: () => void;
}

/**
 * Check if employee is eligible for payroll in the selected month
 * Employee must be hired on or before the first day of the month
 */
function isEmployeeEligibleForMonth(employee: Employee, selectedMonth: string): boolean {
  const [year, month] = selectedMonth.split('-').map(Number);
  // First day of the selected month
  const monthStartDate = new Date(year, month - 1, 1);
  const hireDate = toDate(employee.hireDate);

  return hireDate <= monthStartDate;
}

export function PayrollTable({
  employees,
  selectedMonth,
  setSelectedMonth,
  monthPayroll,
  payrollData,
  setPayrollData,
  loading,
  onProcessPayroll,
  onMarkAsPaid,
  onDeletePayrollEntry,
  onMarkAllAsPaid,
}: PayrollTableProps) {
  const calculateOvertimePay = (currentSalary: number, overtimeHours: number): number => {
    const hourlyRate = safeDivide(currentSalary, 208);
    return safeMultiply(safeMultiply(overtimeHours, hourlyRate), 1.5);
  };

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
    if (monthPayroll.length === 0) return;
    await exportPayrollToExcel(monthPayroll, selectedMonth);
  };

  // Calculate summary statistics for processed payroll
  const payrollSummary = useMemo(() => {
    if (monthPayroll.length === 0) return null;

    const totalBase = sumAmounts(monthPayroll.map(e => e.baseSalary));
    const totalOvertime = sumAmounts(monthPayroll.map(e => e.overtimePay));
    const totalBonuses = sumAmounts(monthPayroll.map(e =>
      e.bonuses ? sumAmounts(e.bonuses.map(b => b.amount)) : 0
    ));
    const totalDeductions = sumAmounts(monthPayroll.map(e =>
      e.deductions ? sumAmounts(e.deductions.map(d => d.amount)) : 0
    ));
    const grandTotal = sumAmounts(monthPayroll.map(e => e.totalSalary));
    const paidCount = monthPayroll.filter(e => e.isPaid).length;
    const unpaidCount = monthPayroll.length - paidCount;
    const unpaidTotal = sumAmounts(monthPayroll.filter(e => !e.isPaid).map(e => e.totalSalary));

    return {
      totalBase,
      totalOvertime,
      totalBonuses,
      totalDeductions,
      grandTotal,
      paidCount,
      unpaidCount,
      unpaidTotal,
    };
  }, [monthPayroll]);

  // Calculate preview totals for unprocessed payroll (only eligible employees)
  const previewSummary = useMemo(() => {
    if (monthPayroll.length > 0 || eligibleEmployees.length === 0) return null;

    let totalBase = 0;
    let totalOvertime = 0;
    let totalBonuses = 0;
    let totalDeductions = 0;
    let grandTotal = 0;

    eligibleEmployees.forEach(employee => {
      const empData = payrollData[employee.id] || { overtime: "", bonus: "", deduction: "", notes: "" };
      const overtime = parseAmount(empData.overtime || "0");
      const bonus = parseAmount(empData.bonus || "0");
      const deduction = parseAmount(empData.deduction || "0");
      const overtimePay = employee.overtimeEligible
        ? calculateOvertimePay(employee.currentSalary, overtime)
        : 0;
      const total = safeSubtract(
        safeAdd(safeAdd(employee.currentSalary, overtimePay), bonus),
        deduction
      );

      totalBase = safeAdd(totalBase, employee.currentSalary);
      totalOvertime = safeAdd(totalOvertime, overtimePay);
      totalBonuses = safeAdd(totalBonuses, bonus);
      totalDeductions = safeAdd(totalDeductions, deduction);
      grandTotal = safeAdd(grandTotal, total);
    });

    return {
      totalBase,
      totalOvertime,
      totalBonuses,
      totalDeductions,
      grandTotal,
      employeeCount: eligibleEmployees.length,
    };
  }, [eligibleEmployees, payrollData, monthPayroll.length]);

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
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {monthPayroll.length > 0 ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          {payrollSummary && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
              <div className="rounded-lg p-4 bg-primary-100 border border-primary-200">
                <div className="flex items-center gap-2 text-primary-700 text-sm mb-1">
                  <Calculator className="w-4 h-4" />
                  الإجمالي
                </div>
                <div className="text-xl font-bold text-primary-900">
                  {formatNumber(payrollSummary.grandTotal)}
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
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>الإجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthPayroll.map((entry) => {
                  const bonusTotal = entry.bonuses ? sumAmounts(entry.bonuses.map(b => b.amount)) : 0;
                  const deductionTotal = entry.deductions ? sumAmounts(entry.deductions.map(d => d.amount)) : 0;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.employeeName}</TableCell>
                      <TableCell>{entry.baseSalary} دينار</TableCell>
                      <TableCell>{entry.overtimePay > 0 ? `${formatNumber(entry.overtimePay)} دينار` : "-"}</TableCell>
                      <TableCell className="text-green-600">
                        {bonusTotal > 0 ? `+${formatNumber(bonusTotal)}` : "-"}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {deductionTotal > 0 ? `-${formatNumber(deductionTotal)}` : "-"}
                      </TableCell>
                      <TableCell className="font-bold">
                        {formatNumber(entry.totalSalary)} دينار
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
                        {!entry.isPaid && (
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
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
                <div className="col-span-2 md:col-span-1">
                  <span className="text-primary-600">الإجمالي:</span>
                  <span className="font-bold text-primary-900 mr-2 text-lg">{formatNumber(previewSummary.grandTotal)} دينار</span>
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
                  <TableHead>الإجمالي</TableHead>
                  <TableHead>ملاحظات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eligibleEmployees.map((employee) => {
                  const empData = payrollData[employee.id] || { overtime: "", bonus: "", deduction: "", notes: "" };
                  const overtime = parseAmount(empData.overtime || "0");
                  const bonus = parseAmount(empData.bonus || "0");
                  const deduction = parseAmount(empData.deduction || "0");
                  const overtimePay = employee.overtimeEligible
                    ? calculateOvertimePay(employee.currentSalary, overtime)
                    : 0;
                  const total = safeSubtract(
                    safeAdd(safeAdd(employee.currentSalary, overtimePay), bonus),
                    deduction
                  );

                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.currentSalary} دينار</TableCell>
                      <TableCell>
                        {employee.overtimeEligible ? (
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={empData.overtime || ""}
                            onChange={(e) =>
                              setPayrollData({
                                ...payrollData,
                                [employee.id]: {
                                  ...empData,
                                  overtime: e.target.value,
                                },
                              })
                            }
                            placeholder="0"
                            className="w-20"
                          />
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
                      <TableCell className="font-bold">{formatNumber(total)} دينار</TableCell>
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
