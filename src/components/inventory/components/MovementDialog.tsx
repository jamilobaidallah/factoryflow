"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InventoryItem, MovementFormData } from "../types/inventory.types";

interface MovementDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedItem: InventoryItem | null;
  movementData: MovementFormData;
  setMovementData: (data: MovementFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export function MovementDialog({
  isOpen,
  onOpenChange,
  selectedItem,
  movementData,
  setMovementData,
  onSubmit,
  loading,
}: MovementDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تسجيل حركة مخزون</DialogTitle>
          <DialogDescription>
            {selectedItem && `العنصر: ${selectedItem.itemName} - الكمية الحالية: ${selectedItem.quantity} ${selectedItem.unit}`}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="movementType">نوع الحركة</Label>
              <select
                id="movementType"
                value={movementData.type}
                onChange={(e) =>
                  setMovementData({ ...movementData, type: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="دخول">دخول</option>
                <option value="خروج">خروج</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="movementQuantity">الكمية</Label>
              <Input
                id="movementQuantity"
                type="number"
                step="0.01"
                value={movementData.quantity}
                onChange={(e) =>
                  setMovementData({ ...movementData, quantity: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedTransactionId">رقم المعاملة المرتبطة (اختياري)</Label>
              <Input
                id="linkedTransactionId"
                value={movementData.linkedTransactionId}
                onChange={(e) =>
                  setMovementData({ ...movementData, linkedTransactionId: e.target.value })
                }
                placeholder="TXN-20250109-123456-789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="movementNotes">ملاحظات</Label>
              <Input
                id="movementNotes"
                value={movementData.notes}
                onChange={(e) =>
                  setMovementData({ ...movementData, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري التسجيل..." : "تسجيل"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
