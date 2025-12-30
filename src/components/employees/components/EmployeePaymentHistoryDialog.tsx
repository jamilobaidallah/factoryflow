"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PayrollEntry } from "../types/employees";
import { CheckCircle, Clock, Banknote } from "lucide-react";

interface EmployeePaymentHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  employeeName: string;
  payrollHistory: PayrollEntry[];
}

export function EmployeePaymentHistoryDialog({
  isOpen,
  onClose,
  employeeName,
  payrollHistory,
}: EmployeePaymentHistoryDialogProps) {
  // Sort by month descending (newest first)
  const sortedHistory = [...payrollHistory].sort((a, b) =>
    b.month.localeCompare(a.month)
  );

  const totalPaid = sortedHistory
    .filter(p => p.isPaid)
    .reduce((sum, p) => sum + p.totalSalary, 0);

  const totalUnpaid = sortedHistory
    .filter(p => !p.isPaid)
    .reduce((sum, p) => sum + p.totalSalary, 0);

  const formatMonth = (month: string) => {
    const [year, monthNum] = month.split('-');
    const monthNames = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                        'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return `${monthNames[parseInt(monthNum) - 1]} ${year}`;
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) {
      return "-";
    }
    return new Date(date).toLocaleDateString('ar-EG');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            سجل المدفوعات - {employeeName}
          </DialogTitle>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 my-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-600">إجمالي الرواتب</p>
            <p className="text-xl font-bold text-blue-700">
              {(totalPaid + totalUnpaid).toFixed(2)} دينار
            </p>
            <p className="text-xs text-gray-500">{sortedHistory.length} شهر</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-600">المدفوع</p>
            <p className="text-xl font-bold text-green-700">
              {totalPaid.toFixed(2)} دينار
            </p>
            <p className="text-xs text-gray-500">
              {sortedHistory.filter(p => p.isPaid).length} شهر
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-600">المتبقي</p>
            <p className="text-xl font-bold text-orange-700">
              {totalUnpaid.toFixed(2)} دينار
            </p>
            <p className="text-xs text-gray-500">
              {sortedHistory.filter(p => !p.isPaid).length} شهر
            </p>
          </div>
        </div>

        {/* History Table */}
        {sortedHistory.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الشهر</TableHead>
                <TableHead>الراتب الأساسي</TableHead>
                <TableHead>ساعات إضافية</TableHead>
                <TableHead>أجر إضافي</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ الدفع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedHistory.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium">
                    {formatMonth(entry.month)}
                  </TableCell>
                  <TableCell>{entry.baseSalary.toFixed(2)} دينار</TableCell>
                  <TableCell>{entry.overtimeHours} ساعة</TableCell>
                  <TableCell>{entry.overtimePay.toFixed(2)} دينار</TableCell>
                  <TableCell className="font-bold">
                    {entry.totalSalary.toFixed(2)} دينار
                  </TableCell>
                  <TableCell>
                    {entry.isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                        <CheckCircle className="w-3 h-3" />
                        مدفوع
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-700">
                        <Clock className="w-3 h-3" />
                        غير مدفوع
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(entry.paidDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-gray-500">
            لا يوجد سجل رواتب لهذا الموظف
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
