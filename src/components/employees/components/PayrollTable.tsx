"use client";

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
import { DollarSign, Trash2, Download } from "lucide-react";
import { Employee, PayrollEntry } from "../types/employees";
import { safeAdd, safeSubtract, safeMultiply, safeDivide, parseAmount, sumAmounts } from "@/lib/currency";
import { exportPayrollToExcel } from "@/lib/export-payroll-excel";

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
}: PayrollTableProps) {
  const calculateOvertimePay = (currentSalary: number, overtimeHours: number): number => {
    const hourlyRate = safeDivide(currentSalary, 208);
    return safeMultiply(safeMultiply(overtimeHours, hourlyRate), 1.5);
  };

  const handleExportToExcel = async () => {
    if (monthPayroll.length === 0) return;
    await exportPayrollToExcel(monthPayroll, selectedMonth);
  };

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
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-gray-600">
              تم معالجة رواتب هذا الشهر. يمكنك عرض التفاصيل أدناه.
            </p>
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
                      <TableCell>{entry.overtimePay > 0 ? `${entry.overtimePay.toFixed(2)} دينار` : "-"}</TableCell>
                      <TableCell className="text-green-600">
                        {bonusTotal > 0 ? `+${bonusTotal.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="text-red-600">
                        {deductionTotal > 0 ? `-${deductionTotal.toFixed(2)}` : "-"}
                      </TableCell>
                      <TableCell className="font-bold">
                        {entry.totalSalary.toFixed(2)} دينار
                      </TableCell>
                      <TableCell>
                        {entry.isPaid ? (
                          <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700" role="status" aria-label="حالة الدفع: تم الدفع">
                            تم الدفع
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700" role="status" aria-label="حالة الدفع: لم يتم الدفع">
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
        <div>
          <p className="text-sm text-gray-600 mb-4">
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
                {employees.map((employee) => {
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
                      <TableCell className="font-bold">{total.toFixed(2)} دينار</TableCell>
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
        </div>
      ) : (
        <p className="text-gray-500 text-center py-12">
          لا يوجد موظفين. قم بإضافة موظفين أولاً.
        </p>
      )}
    </div>
  );
}
