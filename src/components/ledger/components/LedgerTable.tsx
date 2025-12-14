"use client";

import { memo, useState, useEffect } from "react";
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
import { Edit, Trash2, DollarSign, FolderOpen, FileText, X } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { LedgerEntry } from "../utils/ledger-constants";
import { cn } from "@/lib/utils";
import { formatShortDate, formatNumber } from "@/lib/date-utils";

interface LedgerTableProps {
  entries: LedgerEntry[];
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  onQuickPay: (entry: LedgerEntry) => void;
  onViewRelated: (entry: LedgerEntry) => void;
  highlightedSubcategory?: string;
  onClearFilters?: () => void;
  isFiltered?: boolean;
}

/** Status badge component with improved styling */
function StatusBadge({
  status,
  remaining,
}: {
  status: "paid" | "partial" | "unpaid" | undefined;
  remaining?: number;
}) {
  if (!status) return <span className="text-xs text-slate-400">-</span>;

  if (status === "paid") {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
        مدفوع
      </span>
    );
  }

  if (status === "partial") {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
          جزئي
        </span>
        {remaining !== undefined && remaining > 0 && (
          <span className="text-[10px] text-slate-500">
            متبقي: {formatNumber(remaining)}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
        غير مدفوع
      </span>
      {remaining !== undefined && remaining > 0 && (
        <span className="text-[10px] text-slate-500">
          المبلغ: {formatNumber(remaining)}
        </span>
      )}
    </div>
  );
}

/** Type badge component */
function TypeBadge({ type }: { type: string }) {
  const isIncome = type === "دخل";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium",
        isIncome ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      )}
    >
      {type}
    </span>
  );
}

// Memoized table row for better performance with large lists
const LedgerTableRow = memo(function LedgerTableRow({
  entry,
  index,
  isLoaded,
  onEdit,
  onDelete,
  onQuickPay,
  onViewRelated,
  highlightedSubcategory,
}: {
  entry: LedgerEntry;
  index: number;
  isLoaded: boolean;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  onQuickPay: (entry: LedgerEntry) => void;
  onViewRelated: (entry: LedgerEntry) => void;
  highlightedSubcategory?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isSubcategoryHighlighted =
    highlightedSubcategory &&
    highlightedSubcategory !== "all" &&
    entry.subCategory === highlightedSubcategory;

  return (
    <TableRow
      className={cn(
        "transition-all duration-300 cursor-pointer",
        isHovered ? "bg-blue-50" : "hover:bg-slate-50"
      )}
      style={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? "translateX(0)" : "translateX(-20px)",
        transition: `all 0.4s ease-out ${index * 50}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Date & Transaction ID */}
      <TableCell>
        <div>
          <p className="text-sm font-medium text-slate-700">
            {formatShortDate(entry.date)}
          </p>
          {entry.transactionId && (
            <div className="flex items-center gap-1">
              <p className="text-[10px] text-slate-400 font-mono">
                {entry.transactionId.slice(-12)}
              </p>
              <CopyButton text={entry.transactionId} size="sm" />
            </div>
          )}
        </div>
      </TableCell>

      {/* Description */}
      <TableCell>
        <p className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
          {entry.description}
        </p>
      </TableCell>

      {/* Type */}
      <TableCell>
        <TypeBadge type={entry.type} />
      </TableCell>

      {/* Category */}
      <TableCell>
        <p className="text-sm text-slate-600 truncate">{entry.category}</p>
      </TableCell>

      {/* Subcategory - Highlighted when filtered */}
      <TableCell>
        <span
          className={cn(
            "text-sm truncate px-2 py-1 rounded",
            isSubcategoryHighlighted
              ? "bg-purple-100 text-purple-700 font-medium"
              : "text-slate-500"
          )}
        >
          {entry.subCategory || "-"}
        </span>
      </TableCell>

      {/* Party */}
      <TableCell>
        <p className="text-sm text-slate-600 truncate">
          {entry.associatedParty || "-"}
        </p>
      </TableCell>

      {/* Amount */}
      <TableCell>
        <p
          className={cn(
            "text-sm font-bold",
            entry.type === "دخل" ? "text-emerald-600" : "text-slate-700"
          )}
        >
          {entry.type === "دخل" ? "+" : "-"}
          {formatNumber(entry.amount || 0)}
        </p>
      </TableCell>

      {/* Status */}
      <TableCell>
        {entry.isARAPEntry ? (
          <StatusBadge
            status={entry.paymentStatus}
            remaining={entry.remainingBalance}
          />
        ) : (
          <span className="text-xs text-slate-400">-</span>
        )}
      </TableCell>

      {/* Actions - Show on hover */}
      <TableCell>
        <div
          className={cn(
            "flex items-center gap-1 transition-opacity duration-200",
            isHovered ? "opacity-100" : "opacity-0"
          )}
          role="group"
          aria-label="إجراءات الحركة المالية"
        >
          <PermissionGate action="create" module="payments">
            {entry.isARAPEntry && entry.paymentStatus !== "paid" && (
              <button
                onClick={() => onQuickPay(entry)}
                title="إضافة دفعة"
                className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition-colors"
              >
                <DollarSign className="w-4 h-4" />
              </button>
            )}
          </PermissionGate>
          <button
            onClick={() => onViewRelated(entry)}
            title="السجلات المرتبطة"
            className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <PermissionGate action="update" module="ledger">
            <button
              onClick={() => onEdit(entry)}
              title="تعديل"
              className="p-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
          </PermissionGate>
          <PermissionGate action="delete" module="ledger">
            <button
              onClick={() => onDelete(entry)}
              title="حذف"
              className="p-1.5 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </PermissionGate>
        </div>
      </TableCell>
    </TableRow>
  );
});

// Memoized card for mobile view
const LedgerCard = memo(function LedgerCard({
  entry,
  index,
  isLoaded,
  onEdit,
  onDelete,
  onQuickPay,
  onViewRelated,
  highlightedSubcategory,
}: {
  entry: LedgerEntry;
  index: number;
  isLoaded: boolean;
  onEdit: (entry: LedgerEntry) => void;
  onDelete: (entry: LedgerEntry) => void;
  onQuickPay: (entry: LedgerEntry) => void;
  onViewRelated: (entry: LedgerEntry) => void;
  highlightedSubcategory?: string;
}) {
  const isSubcategoryHighlighted =
    highlightedSubcategory &&
    highlightedSubcategory !== "all" &&
    entry.subCategory === highlightedSubcategory;

  return (
    <div
      className="bg-white rounded-xl p-4 border border-slate-200 space-y-3 transition-all duration-300 hover:shadow-md"
      style={{
        opacity: isLoaded ? 1 : 0,
        transform: isLoaded ? "translateY(0)" : "translateY(10px)",
        transition: `all 0.4s ease-out ${index * 50}ms`,
      }}
    >
      {/* Header: Description + Amount */}
      <div className="flex justify-between items-start gap-2">
        <span className="font-medium text-sm flex-1">{entry.description}</span>
        <span
          className={cn(
            "font-bold whitespace-nowrap",
            entry.type === "دخل" ? "text-emerald-600" : "text-slate-700"
          )}
        >
          {entry.type === "دخل" ? "+" : "-"}
          {formatNumber(entry.amount || 0)}
        </span>
      </div>

      {/* Meta: Date, Party, Category */}
      <div className="space-y-1 text-xs text-slate-600">
        <div className="flex justify-between">
          <span>{formatShortDate(entry.date)}</span>
          <span>{entry.associatedParty || "-"}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-slate-500">{entry.category}</span>
          {entry.subCategory && (
            <>
              <span className="text-slate-400">{">"}</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded",
                  isSubcategoryHighlighted
                    ? "bg-purple-100 text-purple-700 font-medium"
                    : "text-slate-500"
                )}
              >
                {entry.subCategory}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Type + Payment Status */}
      <div className="flex items-center gap-2 text-xs">
        <TypeBadge type={entry.type} />
        {entry.isARAPEntry && (
          <StatusBadge
            status={entry.paymentStatus}
            remaining={entry.remainingBalance}
          />
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
              className="flex-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            >
              <DollarSign className="w-4 h-4 ml-1" />
              دفعة
            </Button>
          )}
        </PermissionGate>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onViewRelated(entry)}
          className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          <FolderOpen className="w-4 h-4 ml-1" />
          مرتبط
        </Button>
        <PermissionGate action="update" module="ledger">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(entry)}
            className="text-slate-600 hover:text-slate-700 hover:bg-slate-100"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </PermissionGate>
        <PermissionGate action="delete" module="ledger">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(entry)}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </PermissionGate>
      </div>
    </div>
  );
});

/** Empty state component */
function EmptyState({
  isFiltered,
  onClearFilters,
}: {
  isFiltered?: boolean;
  onClearFilters?: () => void;
}) {
  return (
    <div className="px-6 py-12 text-center">
      <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
      <p className="text-slate-500 text-lg font-medium">
        {isFiltered
          ? "لا توجد حركات مطابقة للفلاتر"
          : "لا توجد حركات مالية مسجلة"}
      </p>
      <p className="text-slate-400 text-sm mt-1">
        {isFiltered
          ? "جرب تغيير معايير البحث أو الفلاتر"
          : 'اضغط على "إضافة حركة مالية" للبدء'}
      </p>
      {isFiltered && onClearFilters && (
        <button
          onClick={onClearFilters}
          className="mt-4 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors inline-flex items-center gap-2"
        >
          <X className="w-4 h-4" />
          مسح جميع الفلاتر
        </button>
      )}
    </div>
  );
}

export const LedgerTable = memo(function LedgerTable({
  entries,
  onEdit,
  onDelete,
  onQuickPay,
  onViewRelated,
  highlightedSubcategory,
  onClearFilters,
  isFiltered,
}: LedgerTableProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  // Trigger load animation
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (entries.length === 0) {
    return <EmptyState isFiltered={isFiltered} onClearFilters={onClearFilters} />;
  }

  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="md:hidden space-y-3">
        {entries.map((entry, index) => (
          <LedgerCard
            key={entry.id}
            entry={entry}
            index={index}
            isLoaded={isLoaded}
            onEdit={onEdit}
            onDelete={onDelete}
            onQuickPay={onQuickPay}
            onViewRelated={onViewRelated}
            highlightedSubcategory={highlightedSubcategory}
          />
        ))}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-semibold text-slate-600">التاريخ</TableHead>
              <TableHead className="font-semibold text-slate-600">الوصف</TableHead>
              <TableHead className="font-semibold text-slate-600">النوع</TableHead>
              <TableHead className="font-semibold text-slate-600">التصنيف</TableHead>
              <TableHead className="font-semibold text-slate-600">التصنيف الفرعي</TableHead>
              <TableHead className="font-semibold text-slate-600">الطرف</TableHead>
              <TableHead className="font-semibold text-slate-600">المبلغ</TableHead>
              <TableHead className="font-semibold text-slate-600">الحالة</TableHead>
              <TableHead className="font-semibold text-slate-600">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-slate-100">
            {entries.map((entry, index) => (
              <LedgerTableRow
                key={entry.id}
                entry={entry}
                index={index}
                isLoaded={isLoaded}
                onEdit={onEdit}
                onDelete={onDelete}
                onQuickPay={onQuickPay}
                onViewRelated={onViewRelated}
                highlightedSubcategory={highlightedSubcategory}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
});
