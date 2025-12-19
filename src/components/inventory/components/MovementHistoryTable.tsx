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
import { Trash2 } from "lucide-react";
import { TableSkeleton } from "@/components/ui/loading-skeleton";
import { InventoryMovement } from "../types/inventory.types";

interface MovementHistoryTableProps {
  movements: InventoryMovement[];
  loading: boolean;
  isOwner?: boolean;
  onDelete?: (movementId: string) => void;
}

export function MovementHistoryTable({ movements, loading, isOwner, onDelete }: MovementHistoryTableProps) {
  if (loading) {
    return <TableSkeleton rows={10} />;
  }

  if (movements.length === 0) {
    return (
      <p className="text-slate-500 text-center py-12">
        لا توجد حركات مخزون مسجلة بعد.
      </p>
    );
  }

  return (
    <div className="card-modern overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
            <TableHead className="text-right font-semibold text-slate-700">التاريخ</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">اسم العنصر</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">نوع الحركة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">الكمية</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">رقم المعاملة</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">ملاحظات</TableHead>
            <TableHead className="text-right font-semibold text-slate-700">المستخدم</TableHead>
            {isOwner && (
              <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {movements.map((movement) => (
            <TableRow key={movement.id} className="table-row-hover">
              <TableCell>
                {movement.createdAt?.toLocaleDateString?.('ar-SA') || '-'}
              </TableCell>
              <TableCell className="font-medium">{movement.itemName}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  movement.type === "دخول"
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}>
                  {movement.type}
                </span>
              </TableCell>
              <TableCell>
                {movement.quantity} {movement.unit || ''}
              </TableCell>
              <TableCell className="text-slate-600 text-sm">
                {movement.linkedTransactionId || '-'}
              </TableCell>
              <TableCell className="text-slate-600 text-sm max-w-[200px] truncate">
                {movement.notes || '-'}
              </TableCell>
              <TableCell className="text-slate-600 text-sm">
                {movement.userEmail || '-'}
              </TableCell>
              {isOwner && onDelete && (
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                    onClick={() => onDelete(movement.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
