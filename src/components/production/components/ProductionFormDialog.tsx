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
import { ProductionFormData, InventoryItem } from "../types/production";

interface ProductionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  isEditMode: boolean;
  loading: boolean;
  formData: ProductionFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductionFormData>>;
  inventoryItems: InventoryItem[];
  onSubmit: (e: React.FormEvent) => void;
}

export function ProductionFormDialog({
  isOpen,
  onClose,
  isEditMode,
  loading,
  formData,
  setFormData,
  inventoryItems,
  onSubmit,
}: ProductionFormDialogProps) {
  const selectedInputItem = inventoryItems.find(item => item.id === formData.inputItemId);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "تعديل أمر الإنتاج" : "إنشاء أمر إنتاج جديد"}</DialogTitle>
          <DialogDescription>
            قم بتحويل المواد الخام إلى منتجات جاهزة
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="date">التاريخ</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-red-700">المدخلات (المادة الخام)</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inputItemId">المادة الخام</Label>
                  <select
                    id="inputItemId"
                    value={formData.inputItemId}
                    onChange={(e) =>
                      setFormData({ ...formData, inputItemId: e.target.value })
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">اختر المادة الخام</option>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.itemName} - الكمية المتوفرة: {item.quantity} {item.unit}
                        {item.thickness && ` (${item.thickness}سم)`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedInputItem && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-sm text-gray-600">
                      <strong>المادة المختارة:</strong> {selectedInputItem.itemName}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>الكمية المتوفرة:</strong> {selectedInputItem.quantity} {selectedInputItem.unit}
                    </div>
                    {selectedInputItem.thickness && (
                      <div className="text-sm text-gray-600">
                        <strong>المقاسات:</strong> {selectedInputItem.thickness}سم × {selectedInputItem.width || "-"}سم × {selectedInputItem.length || "-"}سم
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="inputQuantity">الكمية المستخدمة</Label>
                  <Input
                    id="inputQuantity"
                    type="number"
                    step="0.01"
                    value={formData.inputQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, inputQuantity: e.target.value })
                    }
                    required
                    placeholder="الكمية التي سيتم استخدامها"
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-green-700">المخرجات (المنتج النهائي)</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="outputItemName">اسم المنتج النهائي</Label>
                  <Input
                    id="outputItemName"
                    value={formData.outputItemName}
                    onChange={(e) =>
                      setFormData({ ...formData, outputItemName: e.target.value })
                    }
                    required
                    placeholder="مثال: سماحة 4سم"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="outputQuantity">الكمية المنتجة</Label>
                  <Input
                    id="outputQuantity"
                    type="number"
                    step="0.01"
                    value={formData.outputQuantity}
                    onChange={(e) =>
                      setFormData({ ...formData, outputQuantity: e.target.value })
                    }
                    required
                    placeholder="الكمية المتوقعة من المنتج النهائي"
                  />
                </div>

                <div className="space-y-2">
                  <Label>مقاسات المنتج النهائي (اختياري)</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="outputThickness" className="text-xs">السماكة (سم)</Label>
                      <Input
                        id="outputThickness"
                        type="number"
                        step="0.01"
                        value={formData.outputThickness}
                        onChange={(e) =>
                          setFormData({ ...formData, outputThickness: e.target.value })
                        }
                        placeholder="4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outputWidth" className="text-xs">العرض (سم)</Label>
                      <Input
                        id="outputWidth"
                        type="number"
                        step="0.01"
                        value={formData.outputWidth}
                        onChange={(e) =>
                          setFormData({ ...formData, outputWidth: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="outputLength" className="text-xs">الطول (سم)</Label>
                      <Input
                        id="outputLength"
                        type="number"
                        step="0.01"
                        value={formData.outputLength}
                        onChange={(e) =>
                          setFormData({ ...formData, outputLength: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {formData.inputQuantity && formData.outputQuantity && (
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-700">
                  <strong>نسبة التحويل:</strong> {formData.inputQuantity} {selectedInputItem?.unit} ← {formData.outputQuantity} {selectedInputItem?.unit}
                  {" "}
                  ({(parseFloat(formData.outputQuantity) / parseFloat(formData.inputQuantity)).toFixed(2)}x)
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3 text-purple-700">التكاليف</h3>
              <div className="space-y-2">
                <Label htmlFor="productionExpenses">مصاريف الإنتاج (دينار)</Label>
                <Input
                  id="productionExpenses"
                  type="number"
                  step="0.01"
                  value={formData.productionExpenses}
                  onChange={(e) =>
                    setFormData({ ...formData, productionExpenses: e.target.value })
                  }
                  placeholder="مثال: كهرباء، صيانة، إلخ"
                />
                <p className="text-xs text-gray-500">
                  سيتم إضافة هذا المبلغ إلى تكلفة المواد الخام لحساب تكلفة الوحدة النهائية
                </p>
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
                placeholder="ملاحظات إضافية عن عملية الإنتاج"
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
                ? (isEditMode ? "جاري التحديث..." : "جاري الإنشاء...")
                : (isEditMode ? "تحديث أمر الإنتاج" : "إنشاء أمر الإنتاج")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
