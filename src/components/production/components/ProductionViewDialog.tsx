"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductionOrder } from "../types/production";
import { getStatusBadgeClass, formatDimensions } from "../utils/production-helpers";

interface ProductionViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: ProductionOrder | null;
}

export function ProductionViewDialog({
  isOpen,
  onClose,
  order,
}: ProductionViewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تفاصيل أمر الإنتاج</DialogTitle>
        </DialogHeader>
        {order && (
          <div className="space-y-4">
            <div>
              <strong>رقم الأمر:</strong> {order.orderNumber}
            </div>
            <div>
              <strong>التاريخ:</strong> {new Date(order.date).toLocaleDateString("ar-EG")}
            </div>
            <div>
              <strong>الحالة:</strong>{" "}
              <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadgeClass(order.status)}`}>
                {order.status}
              </span>
            </div>
            <div className="border-t pt-3">
              <strong>المدخلات:</strong>
              <div className="ml-4 mt-2">
                <div>{order.inputItemName}</div>
                <div className="text-sm text-gray-600">
                  الكمية: {order.inputQuantity} {order.unit}
                </div>
                {order.inputThickness && (
                  <div className="text-sm text-gray-600">
                    المقاسات: {formatDimensions(order.inputThickness, order.inputWidth, order.inputLength)}
                  </div>
                )}
              </div>
            </div>
            <div className="border-t pt-3">
              <strong>المخرجات:</strong>
              <div className="ml-4 mt-2">
                <div>{order.outputItemName}</div>
                <div className="text-sm text-gray-600">
                  الكمية: {order.outputQuantity} {order.unit}
                </div>
                {order.outputThickness && (
                  <div className="text-sm text-gray-600">
                    المقاسات: {formatDimensions(order.outputThickness, order.outputWidth, order.outputLength)}
                  </div>
                )}
              </div>
            </div>
            {order.productionExpenses > 0 && (
              <div className="border-t pt-3">
                <strong>مصاريف الإنتاج:</strong>
                <div className="ml-4 mt-1 text-purple-700 font-semibold">
                  {order.productionExpenses.toFixed(2)} دينار
                </div>
              </div>
            )}
            {order.notes && (
              <div className="border-t pt-3">
                <strong>ملاحظات:</strong>
                <div className="ml-4 mt-1">{order.notes}</div>
              </div>
            )}
            {order.completedAt && (
              <div className="border-t pt-3">
                <strong>تاريخ الإكمال:</strong>
                <div className="ml-4 mt-1">
                  {new Date(order.completedAt).toLocaleString("ar-EG")}
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
