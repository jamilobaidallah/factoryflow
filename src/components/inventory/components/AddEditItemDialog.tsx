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
import { InventoryItem, InventoryFormData } from "../types/inventory.types";

// Category structure for inventory items
export const INVENTORY_CATEGORIES = {
  "تكلفة البضاعة المباعة": {
    label: "تكلفة البضاعة المباعة (COGS)",
    subCategories: ["مواد خام", "منتجات جاهزة"],
  },
  "إيرادات المبيعات": {
    label: "إيرادات المبيعات",
    subCategories: ["مبيعات منتجات"],
  },
} as const;

export type CategoryKey = keyof typeof INVENTORY_CATEGORIES;

interface AddEditItemDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem: InventoryItem | null;
  formData: InventoryFormData;
  setFormData: (data: InventoryFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}

export function AddEditItemDialog({
  isOpen,
  onOpenChange,
  editingItem,
  formData,
  setFormData,
  onSubmit,
  loading,
}: AddEditItemDialogProps) {
  const selectedCategory = formData.category as CategoryKey;
  const subCategories = selectedCategory && INVENTORY_CATEGORIES[selectedCategory]
    ? INVENTORY_CATEGORIES[selectedCategory].subCategories
    : [];

  const handleCategoryChange = (category: string) => {
    setFormData({
      ...formData,
      category,
      subCategory: "", // Reset sub-category when main category changes
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingItem ? "تعديل عنصر المخزون" : "إضافة عنصر جديد"}
          </DialogTitle>
          <DialogDescription>
            {editingItem
              ? "قم بتعديل بيانات العنصر أدناه"
              : "أدخل بيانات العنصر الجديد أدناه"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="itemName">اسم العنصر *</Label>
              <Input
                id="itemName"
                value={formData.itemName}
                onChange={(e) =>
                  setFormData({ ...formData, itemName: e.target.value })
                }
                required
              />
            </div>

            {/* 2-Level Category Dropdowns */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">الفئة الرئيسية *</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">اختر الفئة</option>
                  {Object.entries(INVENTORY_CATEGORIES).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subCategory">الفئة الفرعية *</Label>
                <select
                  id="subCategory"
                  value={formData.subCategory}
                  onChange={(e) =>
                    setFormData({ ...formData, subCategory: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                  disabled={!formData.category}
                >
                  <option value="">اختر الفئة الفرعية</option>
                  {subCategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">الموقع</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="مثال: مخزن A، رف 1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">الكمية *</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, quantity: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">الوحدة *</Label>
                <select
                  id="unit"
                  value={formData.unit}
                  onChange={(e) =>
                    setFormData({ ...formData, unit: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">اختر الوحدة</option>
                  <option value="م²">م² (متر مربع)</option>
                  <option value="م">م (متر طولي)</option>
                  <option value="قطعة">قطعة</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">سعر الوحدة (دينار) *</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  value={formData.unitPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, unitPrice: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">الحد الأدنى للمخزون</Label>
                <Input
                  id="minStock"
                  type="number"
                  step="0.01"
                  value={formData.minStock}
                  onChange={(e) =>
                    setFormData({ ...formData, minStock: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>الأبعاد (اختياري)</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="thickness" className="text-xs">السماكة (سم)</Label>
                  <Input
                    id="thickness"
                    type="number"
                    step="0.01"
                    value={formData.thickness}
                    onChange={(e) =>
                      setFormData({ ...formData, thickness: e.target.value })
                    }
                    placeholder="سم"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="width" className="text-xs">العرض (سم)</Label>
                  <Input
                    id="width"
                    type="number"
                    step="0.01"
                    value={formData.width}
                    onChange={(e) =>
                      setFormData({ ...formData, width: e.target.value })
                    }
                    placeholder="سم"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="length" className="text-xs">الطول (سم)</Label>
                  <Input
                    id="length"
                    type="number"
                    step="0.01"
                    value={formData.length}
                    onChange={(e) =>
                      setFormData({ ...formData, length: e.target.value })
                    }
                    placeholder="سم"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
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
              {loading ? "جاري الحفظ..." : editingItem ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
