/**
 * InventoryFormCard - Reusable component for inventory update forms
 * Extracted from LedgerFormDialog.tsx to improve maintainability
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InventoryItem {
  id: string;
  name: string;
  unit: string;
}

export interface InventoryFormCardProps {
  formData: {
    itemId: string;
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
  inventoryItems: InventoryItem[];
  isLoadingItems?: boolean;
}

export function InventoryFormCard({
  formData,
  onUpdate,
  inventoryItems,
  isLoadingItems = false,
}: InventoryFormCardProps) {
  const handleItemSelect = (itemId: string) => {
    const selectedItem = inventoryItems.find((item) => item.id === itemId);
    onUpdate("itemId", itemId);
    onUpdate("itemName", selectedItem?.name || "");
    if (selectedItem?.unit) {
      onUpdate("unit", selectedItem.unit);
    }
  };

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      <h4 className="font-medium text-sm">تحديث المخزون</h4>
      <div className="space-y-2">
        {/* Item Selection Dropdown */}
        <div className="space-y-2">
          <Label>اسم الصنف</Label>
          <select
            value={formData.itemId}
            onChange={(e) => handleItemSelect(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
            disabled={isLoadingItems}
          >
            <option value="">
              {isLoadingItems ? "جاري التحميل..." : "اختر الصنف من المخزون"}
            </option>
            {inventoryItems.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          {inventoryItems.length === 0 && !isLoadingItems && (
            <p className="text-xs text-amber-600">
              لا توجد أصناف في المخزون. يرجى إضافة أصناف من صفحة المخزون أولاً.
            </p>
          )}
        </div>

        {/* Quantity and Unit */}
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
            placeholder="الوحدة"
            value={formData.unit}
            onChange={(e) => onUpdate("unit", e.target.value)}
            required
            disabled={!!formData.itemId}
            className={formData.itemId ? "bg-gray-100" : ""}
          />
        </div>

        {/* Dimensions - All in cm */}
        <div className="grid grid-cols-3 gap-2">
          <Input
            type="number"
            step="0.01"
            placeholder="السماكة (سم)"
            value={formData.thickness}
            onChange={(e) => onUpdate("thickness", e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="العرض (سم)"
            value={formData.width}
            onChange={(e) => onUpdate("width", e.target.value)}
          />
          <Input
            type="number"
            step="0.01"
            placeholder="الطول (سم)"
            value={formData.length}
            onChange={(e) => onUpdate("length", e.target.value)}
          />
        </div>

        {/* Costs */}
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
