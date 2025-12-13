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
import { Edit, Trash2 } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { FixedAsset } from "../types/fixed-assets";
import { formatShortDate } from "@/lib/date-utils";

interface FixedAssetsTableProps {
  assets: FixedAsset[];
  onEdit: (asset: FixedAsset) => void;
  onDelete: (assetId: string) => void;
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
            <TableHead className="text-right font-semibold text-slate-700">تاريخ الشراء</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">التكلفة الأصلية</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الاستهلاك المتراكم</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">القيمة الدفترية</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {assets.map((asset) => (
            <TableRow key={asset.id} className="table-row-hover">
              <TableCell className="font-mono text-xs">
                {asset.assetNumber}
              </TableCell>
              <TableCell className="font-medium">
                {asset.assetName}
              </TableCell>
              <TableCell>{asset.category}</TableCell>
              <TableCell>
                {formatShortDate(asset.purchaseDate)}
              </TableCell>
              <TableCell>
                <span className="font-semibold text-slate-900">
                  {(asset.purchaseCost ?? 0).toLocaleString()} د
                </span>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-red-600">
                  {(asset.accumulatedDepreciation ?? 0).toLocaleString()} د
                </span>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-green-600">
                  {(asset.bookValue ?? 0).toLocaleString()} د
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
