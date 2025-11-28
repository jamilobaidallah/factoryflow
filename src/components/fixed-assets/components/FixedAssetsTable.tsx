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
import { FixedAsset } from "../types/fixed-assets";

interface FixedAssetsTableProps {
  assets: FixedAsset[];
  onEdit: (asset: FixedAsset) => void;
  onDelete: (assetId: string) => void;
}

export function FixedAssetsTable({ assets, onEdit, onDelete }: FixedAssetsTableProps) {
  if (assets.length === 0) {
    return (
      <p className="text-gray-500 text-center py-12">
        لا توجد أصول ثابتة. اضغط على &quot;إضافة أصل ثابت&quot; للبدء.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>رقم الأصل</TableHead>
          <TableHead>اسم الأصل</TableHead>
          <TableHead>الفئة</TableHead>
          <TableHead>تاريخ الشراء</TableHead>
          <TableHead>التكلفة الأصلية</TableHead>
          <TableHead>الاستهلاك المتراكم</TableHead>
          <TableHead>القيمة الدفترية</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead>الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.id}>
            <TableCell className="font-mono text-xs">
              {asset.assetNumber}
            </TableCell>
            <TableCell className="font-medium">
              {asset.assetName}
            </TableCell>
            <TableCell>{asset.category}</TableCell>
            <TableCell>
              {new Date(asset.purchaseDate).toLocaleDateString("ar-EG")}
            </TableCell>
            <TableCell>{asset.purchaseCost.toFixed(2)} د</TableCell>
            <TableCell>{asset.accumulatedDepreciation.toFixed(2)} د</TableCell>
            <TableCell>{asset.bookValue.toFixed(2)} د</TableCell>
            <TableCell>
              <span
                className={`px-2 py-1 rounded-full text-xs ${
                  asset.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {asset.status === "active" ? "نشط" : asset.status}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(asset)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(asset.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
