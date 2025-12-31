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
import { XCircle, Banknote } from "lucide-react";
import { Advance } from "../types/advances";
import { Employee } from "../types/employees";
import { ADVANCE_STATUS, ADVANCE_STATUS_LABELS } from "@/lib/constants";
import { formatShortDate, formatNumber } from "@/lib/date-utils";
import { PermissionGate } from "@/components/auth";

interface AdvancesTableProps {
  advances: Advance[];
  employees: Employee[];
  loading: boolean;
  onCancelAdvance: (advance: Advance) => void;
}

export function AdvancesTable({
  advances,
  employees,
  loading,
  onCancelAdvance,
}: AdvancesTableProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case ADVANCE_STATUS.ACTIVE:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
            {ADVANCE_STATUS_LABELS[status as keyof typeof ADVANCE_STATUS_LABELS]}
          </span>
        );
      case ADVANCE_STATUS.FULLY_DEDUCTED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
            {ADVANCE_STATUS_LABELS[status as keyof typeof ADVANCE_STATUS_LABELS]}
          </span>
        );
      case ADVANCE_STATUS.CANCELLED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {ADVANCE_STATUS_LABELS[status as keyof typeof ADVANCE_STATUS_LABELS]}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            غير معروف
          </span>
        );
    }
  };

  if (advances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-500">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Banknote className="w-8 h-8 text-slate-400" />
        </div>
        <p className="text-lg font-medium">لا توجد سلف مسجلة</p>
        <p className="text-sm text-slate-400 mt-1">اضغط "صرف سلفة" لإضافة سلفة جديدة</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="text-right font-semibold text-slate-700">الموظف</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">المبلغ</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">المتبقي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 hidden sm:table-cell">التاريخ</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 hidden md:table-cell">ملاحظات</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الإجراء</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {advances.map((advance) => (
            <TableRow key={advance.id} className="hover:bg-slate-50/50">
              <TableCell className="font-medium text-slate-900">
                {advance.employeeName}
              </TableCell>
              <TableCell className="font-semibold text-slate-800">
                {formatNumber(advance.amount)} <span className="text-slate-500 font-normal">دينار</span>
              </TableCell>
              <TableCell>
                <span
                  className={`font-semibold ${
                    advance.remainingAmount > 0
                      ? "text-warning-600"
                      : "text-success-600"
                  }`}
                >
                  {formatNumber(advance.remainingAmount)}
                </span>
                <span className="text-slate-500 font-normal mr-1">دينار</span>
              </TableCell>
              <TableCell className="hidden sm:table-cell text-slate-600">
                {formatShortDate(advance.date)}
              </TableCell>
              <TableCell>
                {getStatusBadge(advance.status)}
              </TableCell>
              <TableCell className="hidden md:table-cell text-slate-500 text-sm max-w-[200px] truncate">
                {advance.notes || "-"}
              </TableCell>
              <TableCell>
                {advance.status === ADVANCE_STATUS.ACTIVE && (
                  <PermissionGate action="delete" module="employees">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onCancelAdvance(advance)}
                      disabled={loading}
                      className="text-danger-600 hover:text-danger-700 hover:bg-danger-50"
                      aria-label={`إلغاء سلفة ${advance.employeeName}`}
                    >
                      <XCircle className="w-4 h-4 ml-1" aria-hidden="true" />
                      إلغاء
                    </Button>
                  </PermissionGate>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
