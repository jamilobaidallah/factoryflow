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
import { CopyButton } from "@/components/ui/copy-button";
import { Edit, Trash2, DollarSign, FolderOpen } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { LedgerEntry } from "../utils/ledger-constants";
import { cn } from "@/lib/utils";
import { formatShortDate } from "@/lib/date-utils";

interface LedgerTableProps {
  entries: LedgerEntry[];
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  onQuickPay: (entry: LedgerEntry) => void;
  onViewRelated: (entry: LedgerEntry) => void;
}

// Memoized table row for better performance with large lists
const LedgerTableRow = memo(function LedgerTableRow({
  entry,
  onEdit,
  onDelete,
  onQuickPay,
  onViewRelated,
}: {
  entry: LedgerEntry;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  onQuickPay: (entry: LedgerEntry) => void;
  onViewRelated: (entry: LedgerEntry) => void;
}) {
  return (
    <TableRow className="table-row-hover">
      <TableCell>
        {entry.transactionId ? (
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs">{entry.transactionId}</span>
            <CopyButton text={entry.transactionId} size="sm" />
          </div>
        ) : (
          <span className="text-gray-400">-</span>
        )}
      </TableCell>

      <TableCell>
        {formatShortDate(entry.date)}
      </TableCell>

      <TableCell className="font-medium">{entry.description}</TableCell>

      <TableCell>
        <span
          className={entry.type === "دخل" ? "badge-success" : "badge-danger"}
          role="status"
          aria-label={`النوع: ${entry.type}`}
        >
          {entry.type}
        </span>
      </TableCell>

      <TableCell>{entry.category}</TableCell>
      <TableCell>{entry.subCategory}</TableCell>
      <TableCell>{entry.associatedParty || "-"}</TableCell>
      <TableCell>
        <span className={cn(
          "font-semibold",
          entry.type === "دخل" ? "text-green-600" : "text-red-600"
        )}>
          {entry.amount || 0} دينار
        </span>
      </TableCell>

      <TableCell>
        {entry.isARAPEntry ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  entry.paymentStatus === "paid"
                    ? "badge-success"
                    : entry.paymentStatus === "partial"
                    ? "badge-warning"
                    : "badge-danger"
                )}
                role="status"
                aria-label={`حالة الدفع: ${entry.paymentStatus === "paid" ? "مدفوع" : entry.paymentStatus === "partial" ? "دفعة جزئية" : "غير مدفوع"}`}
              >
                {entry.paymentStatus === "paid"
                  ? "مدفوع"
                  : entry.paymentStatus === "partial"
                  ? "دفعة جزئية"
                  : "غير مدفوع"}
              </span>
            </div>
            {entry.paymentStatus !== "paid" && (
              <div className="text-xs text-slate-600">
                متبقي: {entry.remainingBalance?.toFixed(2)} دينار
              </div>
            )}
            {entry.totalPaid && entry.totalPaid > 0 && (
              <div className="text-xs text-slate-500">
                مدفوع: {entry.totalPaid.toFixed(2)} دينار
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </TableCell>

      <TableCell>
        <div className="flex gap-1" role="group" aria-label="إجراءات الحركة المالية">
          <PermissionGate action="create" module="payments">
            {entry.isARAPEntry && entry.paymentStatus !== "paid" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onQuickPay(entry)}
                title="إضافة دفعة"
                aria-label={`إضافة دفعة لـ ${entry.description}`}
                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <DollarSign className="w-4 h-4" aria-hidden="true" />
              </Button>
            )}
          </PermissionGate>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewRelated(entry)}
            title="إدارة السجلات المرتبطة"
            aria-label={`عرض السجلات المرتبطة بـ ${entry.description}`}
            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
          </Button>
          <PermissionGate action="update" module="ledger">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(entry)}
              aria-label={`تعديل ${entry.description}`}
              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-100"
            >
              <Edit className="w-4 h-4" aria-hidden="true" />
            </Button>
          </PermissionGate>
          <PermissionGate action="delete" module="ledger">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(entry)}
              aria-label={`حذف ${entry.description}`}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </PermissionGate>
        </div>
      </TableCell>
    </TableRow>
  );
});

// Memoized card for mobile view
const LedgerCard = memo(function LedgerCard({
  entry,
  onEdit,
  onDelete,
  onQuickPay,
  onViewRelated,
}: {
  entry: LedgerEntry;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  onQuickPay: (entry: LedgerEntry) => void;
  onViewRelated: (entry: LedgerEntry) => void;
}) {
  return (
    <div className="card-modern p-4 space-y-3">
      {/* Header: Description + Amount */}
      <div className="flex justify-between items-start gap-2">
        <span className="font-medium text-sm flex-1">{entry.description}</span>
        <span
          className={cn(
            "font-semibold whitespace-nowrap",
            entry.type === "دخل" ? "text-green-600" : "text-red-600"
          )}
        >
          {entry.amount || 0} دينار
        </span>
      </div>

      {/* Meta: Date, Party, Category */}
      <div className="space-y-1 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>{formatShortDate(entry.date)}</span>
          <span>{entry.associatedParty || "-"}</span>
        </div>
        <div className="text-slate-500">
          {entry.category} {entry.subCategory && `> ${entry.subCategory}`}
        </div>
      </div>

      {/* Type + Payment Status */}
      <div className="flex items-center gap-2 text-xs">
        <span className={entry.type === "دخل" ? "badge-success" : "badge-danger"}>
          {entry.type}
        </span>
        {entry.isARAPEntry && (
          <>
            <span
              className={cn(
                entry.paymentStatus === "paid"
                  ? "badge-success"
                  : entry.paymentStatus === "partial"
                  ? "badge-warning"
                  : "badge-danger"
              )}
            >
              {entry.paymentStatus === "paid"
                ? "مدفوع"
                : entry.paymentStatus === "partial"
                ? "جزئي"
                : "غير مدفوع"}
            </span>
            {entry.paymentStatus !== "paid" && entry.remainingBalance && (
              <span className="text-slate-600">
                متبقي: {entry.remainingBalance.toFixed(2)}
              </span>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div
        className="flex gap-2 pt-2 border-t border-slate-100"
        role="group"
        aria-label="إجراءات الحركة المالية"
      >
        <PermissionGate action="create" module="payments">
          {entry.isARAPEntry && entry.paymentStatus !== "paid" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onQuickPay(entry)}
              className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-50"
              aria-label={`إضافة دفعة لـ ${entry.description}`}
            >
              <DollarSign className="w-4 h-4 ml-1" aria-hidden="true" />
              دفعة
            </Button>
          )}
        </PermissionGate>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewRelated(entry)}
          className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          aria-label={`عرض السجلات المرتبطة بـ ${entry.description}`}
        >
          <FolderOpen className="w-4 h-4 ml-1" aria-hidden="true" />
          مرتبط
        </Button>
        <PermissionGate action="update" module="ledger">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(entry)}
            aria-label={`تعديل ${entry.description}`}
            className="text-slate-600 hover:text-slate-700 hover:bg-slate-100"
          >
            <Edit className="w-4 h-4" aria-hidden="true" />
          </Button>
        </PermissionGate>
        <PermissionGate action="delete" module="ledger">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(entry)}
            aria-label={`حذف ${entry.description}`}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </Button>
        </PermissionGate>
      </div>
    </div>
  );
});

export const LedgerTable = memo(function LedgerTable({
  entries,
  onEdit,
  onDelete,
  onQuickPay,
  onViewRelated,
}: LedgerTableProps) {
  if (entries.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا توجد حركات مالية مسجلة. اضغط على &quot;إضافة حركة مالية&quot; للبدء.
      </p>
    );
  }

  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="md:hidden space-y-3">
        {entries.map((entry) => (
          <LedgerCard
            key={entry.id}
            entry={entry}
            onEdit={onEdit}
            onDelete={onDelete}
            onQuickPay={onQuickPay}
            onViewRelated={onViewRelated}
          />
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block card-modern overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/80">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-slate-700">رقم المعاملة</TableHead>
              <TableHead className="font-semibold text-slate-700">التاريخ</TableHead>
              <TableHead className="font-semibold text-slate-700">الوصف</TableHead>
              <TableHead className="font-semibold text-slate-700">النوع</TableHead>
              <TableHead className="font-semibold text-slate-700">التصنيف</TableHead>
              <TableHead className="font-semibold text-slate-700">الفئة الفرعية</TableHead>
              <TableHead className="font-semibold text-slate-700">الطرف المعني</TableHead>
              <TableHead className="font-semibold text-slate-700">المبلغ</TableHead>
              <TableHead className="font-semibold text-slate-700">حالة الدفع</TableHead>
              <TableHead className="font-semibold text-slate-700">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <LedgerTableRow
                key={entry.id}
                entry={entry}
                onEdit={onEdit}
                onDelete={onDelete}
                onQuickPay={onQuickPay}
                onViewRelated={onViewRelated}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
});
