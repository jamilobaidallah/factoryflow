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
import { FixedAsset, FixedAssetFormData, ASSET_CATEGORIES } from "../types/fixed-assets";
import { parseAmount, safeSubtract, safeDivide } from "@/lib/currency";

interface FixedAssetFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingAsset: FixedAsset | null;
  loading: boolean;
  formData: FixedAssetFormData;
  setFormData: (data: FixedAssetFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function FixedAssetFormDialog({
  isOpen,
  onClose,
  editingAsset,
  loading,
  formData,
  setFormData,
  onSubmit,
}: FixedAssetFormDialogProps) {
  const monthlyDepreciation = formData.purchaseCost && formData.salvageValue && formData.usefulLifeYears
    ? safeDivide(safeSubtract(parseAmount(formData.purchaseCost), parseAmount(formData.salvageValue)), parseFloat(formData.usefulLifeYears) * 12)
    : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingAsset ? "تعديل أصل ثابت" : "إضافة أصل ثابت جديد"}</DialogTitle>
          <DialogDescription>
            أدخل بيانات الأصل الثابت وسيتم حساب الاستهلاك الشهري تلقائياً
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="assetName">اسم الأصل *</Label>
              <Input
                id="assetName"
                value={formData.assetName}
                onChange={(e) =>
                  setFormData({ ...formData, assetName: e.target.value })
                }
                required
                placeholder="مثال: آلة CNC موديل XYZ"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">الفئة *</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">اختر الفئة</option>
                {ASSET_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchaseDate">تاريخ الشراء *</Label>
                <Input
                  id="purchaseDate"
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) =>
                    setFormData({ ...formData, purchaseDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="purchaseCost">تكلفة الشراء (دينار) *</Label>
                <Input
                  id="purchaseCost"
                  type="number"
                  step="0.01"
                  value={formData.purchaseCost}
                  onChange={(e) =>
                    setFormData({ ...formData, purchaseCost: e.target.value })
                  }
                  required
                  placeholder="120000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="salvageValue">قيمة الخردة (دينار) *</Label>
                <Input
                  id="salvageValue"
                  type="number"
                  step="0.01"
                  value={formData.salvageValue}
                  onChange={(e) =>
                    setFormData({ ...formData, salvageValue: e.target.value })
                  }
                  required
                  placeholder="20000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="usefulLifeYears">العمر الإنتاجي (سنوات) *</Label>
                <Input
                  id="usefulLifeYears"
                  type="number"
                  step="0.1"
                  value={formData.usefulLifeYears}
                  onChange={(e) =>
                    setFormData({ ...formData, usefulLifeYears: e.target.value })
                  }
                  required
                  placeholder="5"
                />
              </div>
            </div>

            {monthlyDepreciation > 0 && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm font-semibold text-blue-900 mb-2">
                  الاستهلاك الشهري المحسوب:
                </div>
                <div className="text-2xl font-bold text-blue-600">
                  {monthlyDepreciation.toFixed(2)} دينار/شهر
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">الموقع</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="المصنع - قسم الإنتاج"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="serialNumber">الرقم التسلسلي</Label>
                <Input
                  id="serialNumber"
                  value={formData.serialNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, serialNumber: e.target.value })
                  }
                  placeholder="SN-12345"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">المورد</Label>
              <Input
                id="supplier"
                value={formData.supplier}
                onChange={(e) =>
                  setFormData({ ...formData, supplier: e.target.value })
                }
                placeholder="اسم المورد"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="ملاحظات إضافية"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? "جاري الحفظ..."
                : editingAsset
                ? "تحديث الأصل"
                : "إضافة الأصل"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
