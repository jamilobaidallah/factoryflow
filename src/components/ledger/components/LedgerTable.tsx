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
import { LedgerEntry } from "../utils/ledger-constants";
import { cn } from "@/lib/utils";

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
    <TableRow>
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
        {new Date(entry.date).toLocaleDateString("ar-EG")}
      </TableCell>

      <TableCell className="font-medium">{entry.description}</TableCell>

      <TableCell>
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            entry.type === "دخل"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
          role="status"
          aria-label={`النوع: ${entry.type}`}
        >
          {entry.type}
        </span>
      </TableCell>

      <TableCell>{entry.category}</TableCell>
      <TableCell>{entry.subCategory}</TableCell>
      <TableCell>{entry.associatedParty || "-"}</TableCell>
      <TableCell>{entry.amount || 0} دينار</TableCell>

      <TableCell>
        {entry.isARAPEntry ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  entry.paymentStatus === "paid"
                    ? "bg-green-100 text-green-700"
                    : entry.paymentStatus === "partial"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
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
              <div className="text-xs text-gray-600">
                متبقي: {entry.remainingBalance?.toFixed(2)} دينار
              </div>
            )}
            {entry.totalPaid && entry.totalPaid > 0 && (
              <div className="text-xs text-gray-500">
                مدفوع: {entry.totalPaid.toFixed(2)} دينار
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400">-</span>
        )}
      </TableCell>

      <TableCell>
        <div className="flex gap-2" role="group" aria-label="إجراءات الحركة المالية">
          {entry.isARAPEntry && entry.paymentStatus !== "paid" && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onQuickPay(entry)}
              title="إضافة دفعة"
              aria-label={`إضافة دفعة لـ ${entry.description}`}
              className="bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onViewRelated(entry)}
            title="إدارة السجلات المرتبطة"
            aria-label={`عرض السجلات المرتبطة بـ ${entry.description}`}
          >
            <FolderOpen className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(entry)}
            aria-label={`تعديل ${entry.description}`}
          >
            <Edit className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onDelete(entry)}
            aria-label={`حذف ${entry.description}`}
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </Button>
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
    <div className="bg-white border rounded-lg p-4 space-y-3 shadow-sm">
      {/* Header: Description + Amount */}
      <div className="flex justify-between items-start gap-2">
        <span className="font-medium text-sm flex-1">{entry.description}</span>
        <span
          className={cn(
            "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
            entry.type === "دخل"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          )}
        >
          {entry.amount || 0} دينار
        </span>
      </div>

      {/* Meta: Date, Party, Category */}
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>{new Date(entry.date).toLocaleDateString("ar-EG")}</span>
          <span>{entry.associatedParty || "-"}</span>
        </div>
        <div className="text-gray-500">
          {entry.category} {entry.subCategory && `> ${entry.subCategory}`}
        </div>
      </div>

      {/* Payment Status (AR/AP entries only) */}
      {entry.isARAPEntry && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "px-2 py-1 rounded-full font-medium",
              entry.paymentStatus === "paid"
                ? "bg-green-100 text-green-700"
                : entry.paymentStatus === "partial"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-red-100 text-red-700"
            )}
          >
            {entry.paymentStatus === "paid"
              ? "مدفوع"
              : entry.paymentStatus === "partial"
              ? "جزئي"
              : "غير مدفوع"}
          </span>
          {entry.paymentStatus !== "paid" && entry.remainingBalance && (
            <span className="text-gray-600">
              متبقي: {entry.remainingBalance.toFixed(2)}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex gap-2 pt-2 border-t"
        role="group"
        aria-label="إجراءات الحركة المالية"
      >
        {entry.isARAPEntry && entry.paymentStatus !== "paid" && (
          <Button
            variant="default"
            size="sm"
            onClick={() => onQuickPay(entry)}
            className="flex-1 bg-green-600 hover:bg-green-700"
            aria-label={`إضافة دفعة لـ ${entry.description}`}
          >
            <DollarSign className="w-4 h-4 ml-1" aria-hidden="true" />
            دفعة
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onViewRelated(entry)}
          className="flex-1"
          aria-label={`عرض السجلات المرتبطة بـ ${entry.description}`}
        >
          <FolderOpen className="w-4 h-4 ml-1" aria-hidden="true" />
          مرتبط
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(entry)}
          aria-label={`تعديل ${entry.description}`}
        >
          <Edit className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => onDelete(entry)}
          aria-label={`حذف ${entry.description}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
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
      <p className="text-gray-500 text-center py-12">
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
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم المعاملة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الوصف</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>الفئة الفرعية</TableHead>
              <TableHead>الطرف المعني</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>حالة الدفع</TableHead>
              <TableHead>الإجراءات</TableHead>
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
