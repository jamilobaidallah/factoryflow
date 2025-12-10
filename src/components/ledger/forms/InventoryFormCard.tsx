/**
 * InventoryFormCard - Reusable component for inventory update forms
 * Extracted from LedgerFormDialog.tsx to improve maintainability
 */

import { Input } from "@/components/ui/input";

export interface InventoryFormCardProps {
  formData: {
    itemName: string;
    quantity: string;
    unit: string;
    thickness: string;
    width: string;
    length: string;
    shippingCost: string;
    otherCosts: string;
  };
  onUpdate: (field: string, value: string) => void;
}

export function InventoryFormCard({ formData, onUpdate }: InventoryFormCardProps) {
  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <h4 className="font-medium text-sm">تحديث المخزون</h4>
      <div className="space-y-2">
        <Input
          type="text"
          placeholder="اسم الصنف"
          value={formData.itemName}
          onChange={(e) => onUpdate("itemName", e.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            step="0.01"
            placeholder="الكمية"
            value={formData.quantity}
            onChange={(e) => onUpdate("quantity", e.target.value)}
            required
          />
          <Input
            type="text"
            placeholder="الوحدة (كغ، متر، قطعة)"
            value={formData.unit}
            onChange={(e) => onUpdate("unit", e.target.value)}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            step="0.01"
            placeholder="السماكة (مم)"
            value={formData.thickness}
            onChange={(e) => onUpdate("thickness", e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="العرض (متر)"
            value={formData.width}
            onChange={(e) => onUpdate("width", e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="الطول (متر)"
            value={formData.length}
            onChange={(e) => onUpdate("length", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            step="0.01"
            placeholder="تكلفة الشحن (اختياري)"
            value={formData.shippingCost}
            onChange={(e) => onUpdate("shippingCost", e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="تكاليف أخرى (اختياري)"
            value={formData.otherCosts}
            onChange={(e) => onUpdate("otherCosts", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
