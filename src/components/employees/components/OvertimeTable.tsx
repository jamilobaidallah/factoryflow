"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Pencil, Trash2, Plus, Calendar, MoreVertical, Lock } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OvertimeEntry } from "../types/overtime";
import { Employee } from "../types/employees";
import { formatShortDate, formatNumber } from "@/lib/date-utils";
import { PermissionGate } from "@/components/auth";
import { safeDivide, safeMultiply } from "@/lib/currency";

interface EmployeeOvertimeSummary {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  entries: OvertimeEntry[];
}

interface OvertimeTableProps {
  entries: OvertimeEntry[];
  employees: Employee[];
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  summaryByEmployee: EmployeeOvertimeSummary[];
  loading: boolean;
  onAddEntry: () => void;
  onEditEntry: (entry: OvertimeEntry) => void;
  onDeleteEntry: (entry: OvertimeEntry) => void;
  isMonthProcessed: boolean;
}

export function OvertimeTable({
  entries,
  employees,
  selectedMonth,
  setSelectedMonth,
  summaryByEmployee,
  loading,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  isMonthProcessed,
}: OvertimeTableProps) {
  // Get hourly rate for an employee
  const getHourlyRate = (employeeId: string): number => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) {return 0;}
    return safeDivide(employee.currentSalary, 208);
  };

  // Calculate overtime pay for an employee (1x rate)
  const calculateOvertimePay = (employeeId: string, hours: number): number => {
    const hourlyRate = getHourlyRate(employeeId);
    return safeMultiply(hours, hourlyRate);
  };

  // Total hours for the month
  const totalMonthHours = summaryByEmployee.reduce(
    (sum, emp) => sum + emp.totalHours,
    0
  );

  // Total estimated pay for the month
  const totalMonthPay = summaryByEmployee.reduce(
    (sum, emp) => sum + calculateOvertimePay(emp.employeeId, emp.totalHours),
    0
  );

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        {/* Month Selector and Add Button */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-slate-400" />
            <Input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-48"
            />
          </div>
          <PermissionGate action="create" module="employees">
            <Button onClick={onAddEntry} className="gap-2">
              <Plus className="w-4 h-4 ml-1" />
              إضافة وقت إضافي
            </Button>
          </PermissionGate>
        </div>

        {/* Empty State */}
        <div className="flex flex-col items-center justify-center py-16 text-slate-500">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-lg font-medium">لا يوجد وقت إضافي مسجل</p>
          <p className="text-sm text-slate-400 mt-1">
            اضغط &quot;إضافة وقت إضافي&quot; لتسجيل ساعات إضافية
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Month Selector and Stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-slate-400" />
          <Input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-48"
          />
          {isMonthProcessed && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-success-100 text-success-700">
              <Lock className="w-3 h-3" />
              تمت المعالجة
            </span>
          )}
        </div>
        <PermissionGate action="create" module="employees">
          <Button onClick={onAddEntry} className="gap-2" disabled={isMonthProcessed}>
            <Plus className="w-4 h-4 ml-1" />
            إضافة وقت إضافي
          </Button>
        </PermissionGate>
      </div>

      {/* Month Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg p-4 bg-primary-50 border border-primary-200">
          <p className="text-sm text-primary-600">إجمالي الساعات</p>
          <p className="text-2xl font-bold text-primary-900">{formatNumber(totalMonthHours)}</p>
          <p className="text-xs text-primary-500">ساعة</p>
        </div>
        <div className="rounded-lg p-4 bg-success-50 border border-success-200">
          <p className="text-sm text-success-600">القيمة التقديرية</p>
          <p className="text-2xl font-bold text-success-900">{formatNumber(totalMonthPay)}</p>
          <p className="text-xs text-success-500">دينار</p>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {summaryByEmployee.map((empSummary) => {
          const empPay = calculateOvertimePay(empSummary.employeeId, empSummary.totalHours);

          return (
            <div
              key={empSummary.employeeId}
              className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Employee Header */}
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-900">{empSummary.employeeName}</p>
                  <div className="text-left">
                    <p className="text-sm font-bold text-primary-600">
                      {formatNumber(empSummary.totalHours)} ساعة
                    </p>
                    <p className="text-xs text-success-600">
                      ≈ {formatNumber(empPay)} دينار
                    </p>
                  </div>
                </div>
              </div>

              {/* Entries */}
              <div className="divide-y divide-slate-100">
                {empSummary.entries.map((entry) => (
                  <div key={entry.id} className="p-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">{formatShortDate(entry.date)}</p>
                      {entry.notes && (
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {formatNumber(entry.hours)} ساعة
                      </span>
                      {!entry.linkedPayrollId && (
                        <PermissionGate action="update" module="employees">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditEntry(entry)}>
                                <Pencil className="h-4 w-4 ml-2" />
                                تعديل
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDeleteEntry(entry)}
                                className="text-danger-600"
                              >
                                <Trash2 className="h-4 w-4 ml-2" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </PermissionGate>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
              <TableHead className="text-right font-semibold text-slate-700">الموظف</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">التاريخ</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الساعات</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">القيمة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">ملاحظات</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الإجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaryByEmployee.map((empSummary) => {
              const empPay = calculateOvertimePay(empSummary.employeeId, empSummary.totalHours);

              return (
                <>
                  {/* Employee entries */}
                  {empSummary.entries.map((entry, idx) => {
                    const entryPay = calculateOvertimePay(entry.employeeId, entry.hours);

                    return (
                      <TableRow key={entry.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-medium text-slate-900">
                          {idx === 0 ? empSummary.employeeName : ""}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {formatShortDate(entry.date)}
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          {formatNumber(entry.hours)}
                        </TableCell>
                        <TableCell className="text-success-600">
                          {formatNumber(entryPay)} دينار
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm max-w-[200px] truncate">
                          {entry.notes || "-"}
                        </TableCell>
                        <TableCell>
                          {!entry.linkedPayrollId ? (
                            <div className="flex items-center gap-1">
                              <PermissionGate action="update" module="employees">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onEditEntry(entry)}
                                  disabled={loading}
                                  className="text-slate-600 hover:text-primary-600"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </PermissionGate>
                              <PermissionGate action="delete" module="employees">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => onDeleteEntry(entry)}
                                  disabled={loading}
                                  className="text-slate-600 hover:text-danger-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </PermissionGate>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">
                              <Lock className="w-3 h-3 inline ml-1" />
                              مرتبط بالرواتب
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {/* Employee subtotal row */}
                  <TableRow className="bg-slate-100/50 border-b-2 border-slate-300">
                    <TableCell colSpan={2} className="font-semibold text-slate-700">
                      المجموع: {empSummary.employeeName}
                    </TableCell>
                    <TableCell className="font-bold text-primary-700">
                      {formatNumber(empSummary.totalHours)} ساعة
                    </TableCell>
                    <TableCell className="font-bold text-success-700">
                      {formatNumber(empPay)} دينار
                    </TableCell>
                    <TableCell colSpan={2}></TableCell>
                  </TableRow>
                </>
              );
            })}

            {/* Grand total row */}
            <TableRow className="bg-slate-200/50">
              <TableCell colSpan={2} className="font-bold text-slate-800 text-lg">
                الإجمالي الكلي
              </TableCell>
              <TableCell className="font-bold text-primary-800 text-lg">
                {formatNumber(totalMonthHours)} ساعة
              </TableCell>
              <TableCell className="font-bold text-success-800 text-lg">
                {formatNumber(totalMonthPay)} دينار
              </TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
