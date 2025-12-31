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
import { XCircle } from "lucide-react";
import { Advance } from "../types/advances";
import { Employee } from "../types/employees";
import { ADVANCE_STATUS, ADVANCE_STATUS_LABELS } from "@/lib/constants";
import { formatShortDate } from "@/lib/date-utils";
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
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case ADVANCE_STATUS.ACTIVE:
        return "bg-blue-100 text-blue-700";
      case ADVANCE_STATUS.FULLY_DEDUCTED:
        return "bg-green-100 text-green-700";
      case ADVANCE_STATUS.CANCELLED:
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (advances.length === 0) {
    return (
      <p className="text-gray-500 text-center py-12">
        لا توجد سلف مسجلة
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>الموظف</TableHead>
          <TableHead>المبلغ</TableHead>
          <TableHead>المتبقي</TableHead>
          <TableHead>التاريخ</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead>ملاحظات</TableHead>
          <TableHead>الإجراء</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {advances.map((advance) => (
          <TableRow key={advance.id}>
            <TableCell className="font-medium">
              {advance.employeeName}
            </TableCell>
            <TableCell>{advance.amount.toFixed(2)} دينار</TableCell>
            <TableCell
              className={
                advance.remainingAmount > 0
                  ? "text-orange-600 font-medium"
                  : "text-green-600"
              }
            >
              {advance.remainingAmount.toFixed(2)} دينار
            </TableCell>
            <TableCell>
              {formatShortDate(advance.date)}
            </TableCell>
            <TableCell>
              <span
                className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(
                  advance.status
                )}`}
              >
                {ADVANCE_STATUS_LABELS[advance.status as keyof typeof ADVANCE_STATUS_LABELS]}
              </span>
            </TableCell>
            <TableCell className="text-gray-500 text-sm max-w-[200px] truncate">
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
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
  );
}
