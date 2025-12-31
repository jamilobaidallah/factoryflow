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
import { X, Banknote } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { Advance } from "../types/advances";
import { formatShortDate, formatNumber } from "@/lib/date-utils";
import { ADVANCE_STATUS } from "@/lib/constants";

interface EmployeeAdvancesHistoryProps {
  advances: Advance[];
  onCancel: (advance: Advance) => void;
  loading: boolean;
}

export function EmployeeAdvancesHistory({
  advances,
  onCancel,
  loading,
}: EmployeeAdvancesHistoryProps) {
  if (advances.length === 0) {
    return (
      <div className="text-center py-8">
        <Banknote className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500">لا توجد سلف مسجلة</p>
      </div>
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case ADVANCE_STATUS.ACTIVE:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-100 text-warning-700">
            نشطة
          </span>
        );
      case ADVANCE_STATUS.PAID:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-100 text-success-700">
            مسددة
          </span>
        );
      case ADVANCE_STATUS.CANCELLED:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500">
            ملغية
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="text-right font-semibold text-slate-700">التاريخ</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">المبلغ الأصلي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">المتبقي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700 hidden md:table-cell">ملاحظات</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">إجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {advances.map((advance) => {
            const paidAmount = advance.amount - advance.remainingAmount;
            const progressPercent = (paidAmount / advance.amount) * 100;

            return (
              <TableRow key={advance.id} className="table-row-hover">
                <TableCell className="font-medium">
                  {formatShortDate(advance.date)}
                </TableCell>
                <TableCell>{formatNumber(advance.amount)} دينار</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <span className={`font-semibold ${
                      advance.remainingAmount > 0 ? "text-danger-600" : "text-success-600"
                    }`}>
                      {formatNumber(advance.remainingAmount)} دينار
                    </span>
                    {advance.status === ADVANCE_STATUS.ACTIVE && (
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-success-500 transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span className="text-slate-500 text-sm">
                    {advance.notes || "-"}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(advance.status)}</TableCell>
                <TableCell>
                  {advance.status === ADVANCE_STATUS.ACTIVE && (
                    <PermissionGate action="delete" module="employees">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-danger-600 hover:bg-danger-50"
                        onClick={() => onCancel(advance)}
                        disabled={loading}
                        aria-label="إلغاء السلفة"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                  )}
                  {advance.status !== ADVANCE_STATUS.ACTIVE && (
                    <span className="text-xs text-slate-400">-</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
