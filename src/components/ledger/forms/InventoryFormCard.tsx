/**
 * InventoryFormCard - Reusable component for inventory update forms
 * Supports multiple inventory items per ledger entry
 */

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { InventoryItemOption } from "@/hooks/useInventoryItems";

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
    itemAmount?: string;
  };
  onUpdate: (field: string, value: string) => void;
  onItemSelect: (itemId: string, itemName: string, unit: string) => void;
  inventoryItems: InventoryItemOption[];
  isLoadingItems?: boolean;
  error?: string | null;
  // Multi-item support
  index?: number;
  canRemove?: boolean;
  onRemove?: () => void;
  entryType?: string; // shows itemAmount field for expense entries
}

export function InventoryFormCard({
  formData,
  onUpdate,
  onItemSelect,
  inventoryItems,
  isLoadingItems = false,
  error = null,
  index,
  canRemove = false,
  onRemove,
  entryType,
}: InventoryFormCardProps) {
  const handleItemSelect = (itemId: string) => {
    if (!itemId) {
      onItemSelect("", "", "");
      return;
    }
    const selectedItem = inventoryItems.find((item) => item.id === itemId);
    if (selectedItem) {
      onItemSelect(selectedItem.id, selectedItem.name, selectedItem.unit);
    }
  };

  const cardLabel =
    index !== undefined
      ? `صنف ${(index + 1).toLocaleString("ar-EG")}`
      : "تحديث المخزون";

  const isPurchase = entryType === "مصروف";

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
      {/* Card header with label and optional remove button */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{cardLabel}</h4>
        {canRemove && onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            aria-label="إزالة الصنف"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {/* Item Selection Dropdown */}
        <div className="space-y-2">
          <Label>اسم الصنف</Label>
          <select
            value={formData.itemId || ""}
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
          {error && (
            <p className="text-xs text-red-600">{error}</p>
          )}
          {!error && inventoryItems.length === 0 && !isLoadingItems && (
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

        {/* Per-item cost — only shown for expense/purchase entries */}
        {isPurchase && (
          <Input
            type="number"
            step="0.01"
            placeholder="مبلغ الصنف (تكلفة هذا الصنف)"
            value={formData.itemAmount ?? ""}
            onChange={(e) => onUpdate("itemAmount", e.target.value)}
          />
        )}

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
