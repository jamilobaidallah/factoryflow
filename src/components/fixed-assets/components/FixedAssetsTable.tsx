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
import { Edit, Trash2, Clock, AlertTriangle } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { FixedAsset, getRemainingLifeMonths } from "../types/fixed-assets";
import { formatNumber } from "@/lib/date-utils";

interface FixedAssetsTableProps {
  assets: FixedAsset[];
  onEdit: (asset: FixedAsset) => void;
  onDelete: (assetId: string) => void;
}

// Format remaining life for display
function formatRemainingLife(months: number): string {
  if (months === 0) return "مكتمل";
  if (months < 12) return `${months} شهر`;
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} سنة`;
  return `${years} سنة و ${remainingMonths} شهر`;
}

// Format relative date (how long ago)
function formatRelativeDate(date: Date | undefined): string {
  if (!date) return "لم يُسجَّل";

  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "اليوم";
  if (diffDays === 1) return "أمس";
  if (diffDays < 7) return `منذ ${diffDays} أيام`;
  if (diffDays < 30) return `منذ ${Math.floor(diffDays / 7)} أسابيع`;
  if (diffDays < 365) return `منذ ${Math.floor(diffDays / 30)} شهر`;
  return `منذ ${Math.floor(diffDays / 365)} سنة`;
}

export function FixedAssetsTable({ assets, onEdit, onDelete }: FixedAssetsTableProps) {
  if (assets.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا توجد أصول ثابتة. اضغط على &quot;إضافة أصل ثابت&quot; للبدء.
      </p>
    );
  }

  return (
    <div className="card-modern overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="text-right font-semibold text-slate-700">رقم الأصل</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">اسم الأصل</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الفئة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">التكلفة الأصلية</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الاستهلاك الشهري</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الاستهلاك المتراكم</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">القيمة الدفترية</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">آخر استهلاك</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">العمر المتبقي</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => {
            const remainingMonths = getRemainingLifeMonths(asset);
            const isFullyDepreciated = remainingMonths === 0;
            const hasNeverDepreciated = !asset.lastDepreciationDate;

            return (
              <TableRow key={asset.id} className="table-row-hover">
                <TableCell className="font-mono text-xs">
                  {asset.assetNumber}
                </TableCell>
                <TableCell className="font-medium">
                  {asset.assetName}
                </TableCell>
                <TableCell>{asset.category}</TableCell>
                <TableCell>
                  <span className="font-semibold text-slate-900">
                    {formatNumber(asset.purchaseCost ?? 0)} د
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-medium text-blue-600">
                    {formatNumber(asset.monthlyDepreciation ?? 0)} د
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-red-600">
                    {formatNumber(asset.accumulatedDepreciation ?? 0)} د
                  </span>
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-green-600">
                    {formatNumber(asset.bookValue ?? 0)} د
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {hasNeverDepreciated ? (
                      <span className="text-amber-600 flex items-center gap-1 text-sm">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        لم يُسجَّل
                      </span>
                    ) : (
                      <span className="text-slate-600 flex items-center gap-1 text-sm">
                        <Clock className="h-3.5 w-3.5" />
                        {formatRelativeDate(asset.lastDepreciationDate)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      isFullyDepreciated
                        ? "bg-slate-100 text-slate-600"
                        : remainingMonths <= 12
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {formatRemainingLife(remainingMonths)}
                  </span>
                </TableCell>
                <TableCell>
                  <span className={asset.status === "active" ? "badge-success" : "badge-neutral"}>
                    {asset.status === "active" ? "نشط" : asset.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <PermissionGate action="update" module="fixed-assets">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                        onClick={() => onEdit(asset)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate action="delete" module="fixed-assets">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => onDelete(asset.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </PermissionGate>
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
