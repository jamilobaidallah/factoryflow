"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Edit, Trash2, Download } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { formatShortDate, formatNumber } from "@/lib/date-utils";
import { CopyButton } from "@/components/ui/copy-button";
import { isMultiAllocationPayment } from "@/lib/arap-utils";

export interface Payment {
  id: string;
  clientName: string;
  amount: number;
  type: string;
  linkedTransactionId: string;
  date: Date;
  notes: string;
  category?: string;
  subCategory?: string;
  createdAt: Date;
  isEndorsement?: boolean;
  noCashMovement?: boolean;
  endorsementChequeId?: string;
  isMultiAllocation?: boolean;
  totalAllocated?: number;
  allocationMethod?: 'fifo' | 'manual';
  allocationCount?: number;
  allocationTransactionIds?: string[];
  // Settlement discount fields
  discountAmount?: number;
  discountReason?: string;
  isSettlementDiscount?: boolean;
  // Writeoff fields
  writeoffAmount?: number;
  writeoffReason?: string;
  isWriteoff?: boolean;
}

interface PaymentsTableProps {
  payments: Payment[];
  loading: boolean;
  onEdit: (payment: Payment) => void;
  onDelete: (paymentId: string) => void;
  onExport: () => void;
}

function PaymentsTableComponent({
  payments,
  loading,
  onEdit,
  onDelete,
  onExport,
}: PaymentsTableProps) {
  if (loading) {
    return <TableSkeleton rows={10} />;
  }

  if (payments.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا توجد مدفوعات مسجلة. اضغط على &quot;إضافة مدفوعة&quot; للبدء.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800">سجل المدفوعات ({payments.length})</h2>
        {payments.length > 0 && (
          <PermissionGate action="export" module="payments">
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              aria-label="تصدير المدفوعات إلى ملف Excel"
            >
              <Download className="w-4 h-4 ml-2" aria-hidden="true" />
              Excel
            </Button>
          </PermissionGate>
        )}
      </div>
      <div className="card-modern overflow-hidden">
        <Table>
          <TableHeader sticky className="bg-slate-50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-right font-semibold text-slate-700">التاريخ</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">اسم العميل</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">النوع</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الفئة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">المبلغ</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">رقم المعاملة</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">ملاحظات</TableHead>
              <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <PaymentRow
                key={payment.id}
                payment={payment}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

// Memoized row component
const PaymentRow = memo(function PaymentRow({
  payment,
  onEdit,
  onDelete,
}: {
  payment: Payment;
  onEdit: (payment: Payment) => void;
  onDelete: (paymentId: string) => void;
}) {
  return (
    <TableRow className="table-row-hover">
      <TableCell>
        {formatShortDate(payment.date)}
      </TableCell>
      <TableCell className="font-medium">
        {payment.clientName}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <span
            className={payment.type === "قبض" ? "badge-success" : "badge-danger"}
            role="status"
            aria-label={`النوع: ${payment.type}`}
          >
            {payment.type}
          </span>
          {payment.isEndorsement && (
            <span className="badge-primary">
              تظهير شيك
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col text-sm">
          {payment.category && (
            <>
              <span className="font-medium text-slate-700">{payment.category}</span>
              {payment.subCategory && (
                <span className="text-xs text-slate-500">{payment.subCategory}</span>
              )}
            </>
          )}
          {!payment.category && <span className="text-slate-400 text-xs">-</span>}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          {payment.amount > 0 && (
            <span className={`font-semibold ${payment.type === "قبض" ? 'text-green-600' : 'text-red-600'}`}>
              {formatNumber(payment.amount)} دينار
            </span>
          )}
          {payment.discountAmount && payment.discountAmount > 0 && (
            <span className="text-sm text-amber-600 font-medium">
              خصم: {formatNumber(payment.discountAmount)} دينار
            </span>
          )}
          {payment.writeoffAmount && payment.writeoffAmount > 0 && (
            <span className="text-sm text-orange-600 font-medium">
              شطب: {formatNumber(payment.writeoffAmount)} دينار
            </span>
          )}
          {payment.amount === 0 && !payment.discountAmount && !payment.writeoffAmount && (
            <span className="text-slate-400">0 دينار</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {isMultiAllocationPayment(payment) && payment.allocationTransactionIds?.length ? (
          <div className="flex flex-col gap-1">
            {payment.allocationTransactionIds.map((txnId, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <span className="font-mono text-xs text-purple-700">
                  {txnId}
                </span>
                <CopyButton text={txnId} size="sm" />
              </div>
            ))}
          </div>
        ) : isMultiAllocationPayment(payment) ? (
          <span className="badge-primary">
            {payment.allocationCount} معاملات
          </span>
        ) : payment.linkedTransactionId ? (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs">
              {payment.linkedTransactionId}
            </span>
            <CopyButton text={payment.linkedTransactionId} size="sm" />
          </div>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </TableCell>
      <TableCell>{payment.notes}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1" role="group" aria-label="إجراءات المدفوعة">
          <PermissionGate action="update" module="payments">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              onClick={() => onEdit(payment)}
              aria-label={`تعديل مدفوعة ${payment.clientName}`}
            >
              <Edit className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" module="payments">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
              onClick={() => onDelete(payment.id)}
              aria-label={`حذف مدفوعة ${payment.clientName}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PermissionGate>
        </div>
      </TableCell>
    </TableRow>
  );
});

export const PaymentsTable = memo(PaymentsTableComponent);
