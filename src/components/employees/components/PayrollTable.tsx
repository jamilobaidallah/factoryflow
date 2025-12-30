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
import { DollarSign, Trash2, CheckCircle } from "lucide-react";
import { Employee, PayrollEntry } from "../types/employees";

interface PayrollTableProps {
  employees: Employee[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  monthPayroll: PayrollEntry[];
  payrollData: {[key: string]: {overtime: string, notes: string}};
  setPayrollData: (data: {[key: string]: {overtime: string, notes: string}}) => void;
  loading: boolean;
  onProcessPayroll: () => void;
  onMarkAsPaid: (entry: PayrollEntry) => void;
  onMarkAllAsPaid: () => void;
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
  onMarkAllAsPaid,
  onDeletePayrollEntry,
}: PayrollTableProps) {
  const calculateOvertimePay = (currentSalary: number, overtimeHours: number): number => {
    const hourlyRate = currentSalary / 208;
    return overtimeHours * hourlyRate * 1.5;
  };

  // Filter employees by hire date - only include those hired before or during the selected month
  const eligibleEmployees = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthEndDate = new Date(year, month, 0); // Last day of selected month

    return employees.filter(employee => {
      const hireDate = employee.hireDate instanceof Date
        ? employee.hireDate
        : new Date(employee.hireDate);
      return hireDate <= monthEndDate;
    });
  }, [employees, selectedMonth]);

  const skippedCount = employees.length - eligibleEmployees.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">معالجة الرواتب الشهرية</h3>
        <div className="flex items-center gap-4">
          {/* Pay All Button - only show if there are unpaid entries */}
          {monthPayroll.filter(p => !p.isPaid).length > 0 && (
            <Button
              onClick={onMarkAllAsPaid}
              disabled={loading}
              variant="default"
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4" />
              دفع الكل ({monthPayroll.filter(p => !p.isPaid).length})
            </Button>
          )}
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
          <p className="text-sm text-gray-600 mb-4">
            تم معالجة رواتب هذا الشهر. يمكنك عرض التفاصيل أدناه.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الموظف</TableHead>
                <TableHead>الراتب الأساسي</TableHead>
                <TableHead>ساعات إضافية</TableHead>
                <TableHead>أجر إضافي</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthPayroll.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">{entry.employeeName}</TableCell>
                  <TableCell>{entry.baseSalary} دينار</TableCell>
                  <TableCell>{entry.overtimeHours} ساعة</TableCell>
                  <TableCell>{entry.overtimePay.toFixed(2)} دينار</TableCell>
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
                          <DollarSign className="w-4 h-4 mr-1" aria-hidden="true" />
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
              ))}
            </TableBody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <TableRow>
                <TableCell className="font-bold text-gray-700">الإجمالي</TableCell>
                <TableCell className="font-bold">
                  {monthPayroll.reduce((sum, e) => sum + e.baseSalary, 0).toFixed(2)} دينار
                </TableCell>
                <TableCell className="font-bold">
                  {monthPayroll.reduce((sum, e) => sum + e.overtimeHours, 0)} ساعة
                </TableCell>
                <TableCell className="font-bold">
                  {monthPayroll.reduce((sum, e) => sum + e.overtimePay, 0).toFixed(2)} دينار
                </TableCell>
                <TableCell className="font-bold text-blue-700">
                  {monthPayroll.reduce((sum, e) => sum + e.totalSalary, 0).toFixed(2)} دينار
                </TableCell>
                <TableCell>
                  <span className="text-green-600 font-medium">
                    {monthPayroll.filter(e => e.isPaid).length} مدفوع
                  </span>
                  {" / "}
                  <span className="text-orange-600 font-medium">
                    {monthPayroll.filter(e => !e.isPaid).length} غير مدفوع
                  </span>
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </tfoot>
          </Table>
        </div>
      ) : eligibleEmployees.length > 0 ? (
        <div>
          <p className="text-sm text-gray-600 mb-4">
            أدخل ساعات العمل الإضافية (إن وجدت) لكل موظف:
          </p>
          {skippedCount > 0 && (
            <p className="text-sm text-orange-600 mb-4">
              ملاحظة: {skippedCount} موظف لم يتم تعيينهم بعد في هذا الشهر ولن يتم إدراجهم.
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الموظف</TableHead>
                <TableHead>الراتب الأساسي</TableHead>
                <TableHead>ساعات إضافية</TableHead>
                <TableHead>أجر إضافي</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligibleEmployees.map((employee) => {
                const overtime = parseFloat(payrollData[employee.id]?.overtime || "0");
                const overtimePay = employee.overtimeEligible
                  ? calculateOvertimePay(employee.currentSalary, overtime)
                  : 0;
                const total = employee.currentSalary + overtimePay;

                return (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.currentSalary} دينار</TableCell>
                    <TableCell>
                      {employee.overtimeEligible ? (
                        <Input
                          type="number"
                          step="0.5"
                          value={payrollData[employee.id]?.overtime || ""}
                          onChange={(e) =>
                            setPayrollData({
                              ...payrollData,
                              [employee.id]: {
                                ...payrollData[employee.id],
                                overtime: e.target.value,
                              },
                            })
                          }
                          placeholder="0"
                          className="w-24"
                        />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {overtimePay > 0 ? `${overtimePay.toFixed(2)} دينار` : "-"}
                    </TableCell>
                    <TableCell className="font-bold">{total.toFixed(2)} دينار</TableCell>
                    <TableCell>
                      <Input
                        value={payrollData[employee.id]?.notes || ""}
                        onChange={(e) =>
                          setPayrollData({
                            ...payrollData,
                            [employee.id]: {
                              ...payrollData[employee.id],
                              notes: e.target.value,
                            },
                          })
                        }
                        placeholder="ملاحظات"
                        className="w-32"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot className="bg-gray-50 border-t-2 border-gray-300">
              <TableRow>
                <TableCell className="font-bold text-gray-700">الإجمالي</TableCell>
                <TableCell className="font-bold">
                  {eligibleEmployees.reduce((sum, e) => sum + e.currentSalary, 0).toFixed(2)} دينار
                </TableCell>
                <TableCell></TableCell>
                <TableCell className="font-bold">
                  {eligibleEmployees.reduce((sum, e) => {
                    const overtime = parseFloat(payrollData[e.id]?.overtime || "0");
                    return sum + (e.overtimeEligible ? calculateOvertimePay(e.currentSalary, overtime) : 0);
                  }, 0).toFixed(2)} دينار
                </TableCell>
                <TableCell className="font-bold text-blue-700">
                  {eligibleEmployees.reduce((sum, e) => {
                    const overtime = parseFloat(payrollData[e.id]?.overtime || "0");
                    const overtimePay = e.overtimeEligible ? calculateOvertimePay(e.currentSalary, overtime) : 0;
                    return sum + e.currentSalary + overtimePay;
                  }, 0).toFixed(2)} دينار
                </TableCell>
                <TableCell></TableCell>
              </TableRow>
            </tfoot>
          </Table>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={onProcessPayroll}
              disabled={loading || eligibleEmployees.length === 0}
              size="lg"
              className="gap-2"
              aria-label={`معالجة رواتب شهر ${selectedMonth}`}
            >
              <DollarSign className="w-5 h-5" aria-hidden="true" />
              معالجة الرواتب
            </Button>
          </div>
        </div>
      ) : employees.length > 0 ? (
        <p className="text-gray-500 text-center py-12">
          لا يوجد موظفين مؤهلين لهذا الشهر. جميع الموظفين تم تعيينهم بعد شهر {selectedMonth}.
        </p>
      ) : (
        <p className="text-gray-500 text-center py-12">
          لا يوجد موظفين. قم بإضافة موظفين أولاً.
        </p>
      )}
    </div>
  );
}
