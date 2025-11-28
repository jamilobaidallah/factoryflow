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
import { CheckCircle, XCircle, Eye, Pencil, Trash2 } from "lucide-react";
import { ProductionOrder } from "../types/production";
import { getStatusBadgeClass, formatDimensions } from "../utils/production-helpers";

interface ProductionOrdersTableProps {
  orders: ProductionOrder[];
  loading: boolean;
  onView: (order: ProductionOrder) => void;
  onEdit: (order: ProductionOrder) => void;
  onComplete: (order: ProductionOrder) => void;
  onCancel: (orderId: string) => void;
  onDelete: (order: ProductionOrder) => void;
}

export function ProductionOrdersTable({
  orders,
  loading,
  onView,
  onEdit,
  onComplete,
  onCancel,
  onDelete,
}: ProductionOrdersTableProps) {
  if (orders.length === 0) {
    return (
      <p className="text-gray-500 text-center py-12">
        لا توجد أوامر إنتاج. اضغط على &quot;إنشاء أمر إنتاج&quot; للبدء.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>رقم الأمر</TableHead>
          <TableHead>التاريخ</TableHead>
          <TableHead>المادة الخام</TableHead>
          <TableHead>الكمية المستخدمة</TableHead>
          <TableHead>المنتج النهائي</TableHead>
          <TableHead>الكمية المنتجة</TableHead>
          <TableHead>الحالة</TableHead>
          <TableHead>الإجراءات</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-mono text-xs">
              {order.orderNumber}
            </TableCell>
            <TableCell>
              {new Date(order.date).toLocaleDateString("ar-EG")}
            </TableCell>
            <TableCell>
              <div className="font-medium">{order.inputItemName}</div>
              {order.inputThickness && (
                <div className="text-xs text-gray-500">
                  {formatDimensions(order.inputThickness, order.inputWidth, order.inputLength)}
                </div>
              )}
            </TableCell>
            <TableCell>
              {order.inputQuantity} {order.unit}
            </TableCell>
            <TableCell>
              <div className="font-medium">{order.outputItemName}</div>
              {order.outputThickness && (
                <div className="text-xs text-gray-500">
                  {formatDimensions(order.outputThickness, order.outputWidth, order.outputLength)}
                </div>
              )}
            </TableCell>
            <TableCell>
              {order.outputQuantity} {order.unit}
            </TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(order.status)}`}>
                {order.status}
              </span>
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onView(order)}
                  title="عرض"
                >
                  <Eye className="w-4 h-4" />
                </Button>

                {order.status === "قيد التنفيذ" && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(order)}
                      title="تعديل"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => onComplete(order)}
                      disabled={loading}
                      title="إكمال"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onCancel(order.id)}
                      title="إلغاء"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </>
                )}

                {order.status === "مكتمل" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(order)}
                    title="تعديل (سيتم تحديث المخزون تلقائياً)"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                )}

                {order.status !== "قيد التنفيذ" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onDelete(order)}
                    title={order.status === "مكتمل" ? "حذف (سيتم عكس التغييرات على المخزون)" : "حذف"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
