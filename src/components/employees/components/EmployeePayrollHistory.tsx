"use client";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, Trash2, FileText } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { PayrollEntry } from "../types/employees";
import { formatNumber } from "@/lib/date-utils";

interface EmployeePayrollHistoryProps {
  payrollEntries: PayrollEntry[];
  onMarkAsPaid: (entry: PayrollEntry) => void;
  onDelete: (entry: PayrollEntry) => void;
  loading: boolean;
  compact?: boolean;
}

export function EmployeePayrollHistory({
  payrollEntries,
  onMarkAsPaid,
  onDelete,
  loading,
  compact = false,
}: EmployeePayrollHistoryProps) {
  if (payrollEntries.length === 0) {
    return (
      <div className="text-center py-8">
        <FileText className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500">لا توجد سجلات رواتب</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="text-right font-semibold text-slate-700">الشهر</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الأساسي</TableHead>
            {!compact && (
              <>
                <TableHead className="text-right font-semibold text-slate-700 hidden md:table-cell">إضافي</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 hidden md:table-cell">مكافآت</TableHead>
                <TableHead className="text-right font-semibold text-slate-700 hidden md:table-cell">خصومات</TableHead>
              </>
            )}
            <TableHead className="text-right font-semibold text-slate-700">الإجمالي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payrollEntries.map((entry) => {
            const totalBonuses = entry.bonuses?.reduce((sum, b) => sum + b.amount, 0) || 0;
            const totalDeductions = entry.deductions?.reduce((sum, d) => sum + d.amount, 0) || 0;

            return (
              <TableRow key={entry.id} className="table-row-hover">
                <TableCell className="font-medium">{entry.month}</TableCell>
                <TableCell>{formatNumber(entry.baseSalary)}</TableCell>
                {!compact && (
                  <>
                    <TableCell className="hidden md:table-cell">
                      {entry.overtimePay > 0 ? (
                        <span className="text-success-600">+{formatNumber(entry.overtimePay)}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {totalBonuses > 0 ? (
                        <span className="text-success-600">+{formatNumber(totalBonuses)}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {totalDeductions > 0 ? (
                        <span className="text-danger-600">-{formatNumber(totalDeductions)}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell>
                  <span className="font-bold text-slate-900">
                    {formatNumber(entry.totalSalary)}
                  </span>
                </TableCell>
                <TableCell>
                  {entry.isPaid ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
                      مدفوع
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
                      غير مدفوع
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {!entry.isPaid && (
                      <PermissionGate action="update" module="employees">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-success-600 hover:bg-success-50"
                          onClick={() => onMarkAsPaid(entry)}
                          disabled={loading}
                          aria-label="تسجيل الدفع"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    )}
                    {!entry.isPaid && (
                      <PermissionGate action="delete" module="employees">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-danger-600 hover:bg-danger-50"
                          onClick={() => onDelete(entry)}
                          disabled={loading}
                          aria-label="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </PermissionGate>
                    )}
                    {entry.isPaid && (
                      <span className="text-xs text-slate-400">-</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
