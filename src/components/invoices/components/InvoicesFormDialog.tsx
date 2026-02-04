"use client";

import { useState } from "react";
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
import { Plus, Trash2, Upload, X } from "lucide-react";
import { Invoice, InvoiceFormData, InvoiceItem, InvoiceItemUnit, InvoiceItemType } from "../types/invoices";
import { roundCurrency, safeMultiply, safeDivide } from "@/lib/currency";

interface InvoicesFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingInvoice: Invoice | null;
  formData: InvoiceFormData;
  setFormData: (data: InvoiceFormData) => void;
  items: InvoiceItem[];
  setItems: (items: InvoiceItem[]) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function InvoicesFormDialog({
  isOpen,
  onClose,
  editingInvoice,
  formData,
  setFormData,
  items,
  setItems,
  loading,
  onSubmit,
}: InvoicesFormDialogProps) {
  // حالة معاينة الصورة - Image preview state
  const [showImagePreview, setShowImagePreview] = useState(false);

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        description: "",
        quantity: 1,
        unitPrice: 0,
        total: 0,
        itemType: 'material',
        unit: 'piece',
        length: undefined,
        width: undefined,
        thickness: undefined,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number | InvoiceItemUnit | InvoiceItemType | undefined
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "quantity" || field === "unitPrice") {
      // Forward calculation: Total = Qty × Price
      newItems[index].total = safeMultiply(newItems[index].quantity, newItems[index].unitPrice);
    } else if (field === "total") {
      // Reverse calculation: Price = Total / Qty
      newItems[index].unitPrice = safeDivide(newItems[index].total, newItems[index].quantity);
    }

    setItems(newItems);
  };

  const calculateTotals = (itemsList: InvoiceItem[], taxRate: number) => {
    const subtotal = itemsList.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  // Handle invoice image upload (converts to base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, invoiceImageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const totals = calculateTotals(items, parseFloat(formData.taxRate));

  return (
    <>
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto px-6">
        <DialogHeader>
          <DialogTitle>
            {editingInvoice ? "تعديل الفاتورة" : "فاتورة جديدة"}
          </DialogTitle>
          <DialogDescription>
            املأ بيانات الفاتورة والبنود بالأسفل
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="clientName">اسم العميل *</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientPhone">رقم الهاتف</Label>
              <Input
                id="clientPhone"
                value={formData.clientPhone}
                onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clientAddress">العنوان</Label>
            <Input
              id="clientAddress"
              value={formData.clientAddress}
              onChange={(e) => setFormData({ ...formData, clientAddress: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceDate">تاريخ الفاتورة</Label>
              <Input
                id="invoiceDate"
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxRate">نسبة الضريبة (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.1"
                value={formData.taxRate}
                onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              />
            </div>
          </div>

          {/* رقم الفاتورة اليدوي وصورة الفاتورة */}
          {/* Manual Invoice Number and Invoice Image */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manualInvoiceNumber">رقم الفاتورة اليدوي (ورقي)</Label>
              <Input
                id="manualInvoiceNumber"
                value={formData.manualInvoiceNumber}
                onChange={(e) => setFormData({ ...formData, manualInvoiceNumber: e.target.value })}
                placeholder="رقم الفاتورة الورقية..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invoiceImage">صورة الفاتورة</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="invoiceImage"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('invoiceImage')?.click()}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 ml-2" />
                  {formData.invoiceImageUrl ? 'تغيير الصورة' : 'رفع صورة'}
                </Button>
                {formData.invoiceImageUrl && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowImagePreview(true)}
                      title="معاينة الصورة"
                    >
                      معاينة
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, invoiceImageUrl: '' })}
                      className="text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              {formData.invoiceImageUrl && (
                <p className="text-xs text-green-600">تم رفع الصورة بنجاح</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>بنود الفاتورة</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة بند
              </Button>
            </div>

            {/* جدول بنود الفاتورة مع أبعاد التصنيع */}
            {/* Invoice items table with manufacturing dimensions */}
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full min-w-[850px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-xs font-medium text-right min-w-[140px]">الوصف</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-24">النوع</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-24">الوحدة</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-20">الطول (سم)</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-20">العرض (سم)</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-20">السماكة (سم)</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-24">الكمية</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-28">السعر</th>
                    <th className="px-2 py-2 text-xs font-medium text-center w-28">المجموع</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t align-middle">
                      {/* الوصف */}
                      <td className="px-1 py-1.5">
                        <Input
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          placeholder="وصف المنتج"
                          required
                          className="h-8 text-sm"
                        />
                      </td>
                      {/* النوع - Type dropdown (Material/Service) */}
                      <td className="px-1 py-1.5">
                        <select
                          value={item.itemType || 'material'}
                          onChange={(e) => handleItemChange(index, "itemType", e.target.value as InvoiceItemType)}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-1 py-1 text-sm text-center"
                        >
                          <option value="material">مادة</option>
                          <option value="service">خدمة</option>
                        </select>
                      </td>
                      {/* الوحدة - Unit dropdown */}
                      <td className="px-1 py-1.5">
                        <select
                          value={item.unit || 'piece'}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value as InvoiceItemUnit)}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-1 py-1 text-sm text-center"
                        >
                          <option value="m">متر طولي</option>
                          <option value="m2">متر مربع</option>
                          <option value="piece">عدد</option>
                        </select>
                      </td>
                      {/* الطول - Length (hidden for service) */}
                      <td className="px-1 py-1.5">
                        {item.itemType !== 'service' ? (
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.length ?? ''}
                            onChange={(e) => handleItemChange(index, "length", e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="h-8 text-sm text-center w-full"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      {/* العرض - Width (hidden for service) */}
                      <td className="px-1 py-1.5">
                        {item.itemType !== 'service' ? (
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.width ?? ''}
                            onChange={(e) => handleItemChange(index, "width", e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="h-8 text-sm text-center w-full"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      {/* السماكة - Thickness (hidden for service) */}
                      <td className="px-1 py-1.5">
                        {item.itemType !== 'service' ? (
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={item.thickness ?? ''}
                            onChange={(e) => handleItemChange(index, "thickness", e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="h-8 text-sm text-center w-full"
                          />
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      {/* الكمية - Quantity */}
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                          required
                          className="h-8 text-sm text-center w-full"
                        />
                      </td>
                      {/* السعر - Price */}
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, "unitPrice", roundCurrency(parseFloat(e.target.value)) || 0)}
                          required
                          className="h-8 text-sm text-center w-full"
                        />
                      </td>
                      {/* المجموع - Total (editable for reverse calculation) */}
                      <td className="px-1 py-1.5">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.total}
                          onChange={(e) => handleItemChange(index, "total", roundCurrency(parseFloat(e.target.value)) || 0)}
                          className="h-8 text-sm text-center w-full"
                        />
                      </td>
                      {/* حذف - Delete */}
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length === 1}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>المجموع الفرعي:</span>
              <span className="font-medium">{totals.subtotal.toFixed(2)} دينار</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>الضريبة ({formData.taxRate}%):</span>
              <span className="font-medium">{totals.taxAmount.toFixed(2)} دينار</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>المجموع الكلي:</span>
              <span className="text-primary">{totals.total.toFixed(2)} دينار</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <textarea
              id="notes"
              className="w-full min-h-[80px] px-3 py-2 border rounded-md"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="ملاحظات إضافية للفاتورة..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : editingInvoice ? "تحديث" : "حفظ"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* Image Preview Modal */}
    {showImagePreview && formData.invoiceImageUrl && (
      <Dialog open={showImagePreview} onOpenChange={setShowImagePreview}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>معاينة صورة الفاتورة</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowImagePreview(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center items-center overflow-auto max-h-[70vh]">
            <img
              src={formData.invoiceImageUrl}
              alt="صورة الفاتورة"
              className="max-w-full max-h-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}
