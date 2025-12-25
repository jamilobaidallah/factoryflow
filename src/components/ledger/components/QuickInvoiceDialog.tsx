/**
 * QuickInvoiceDialog - إنشاء فاتورة سريعة من دفتر الأستاذ
 * Quick invoice creation dialog from ledger
 *
 * يسمح للمستخدم بإنشاء فاتورة مباشرة بعد تسجيل حركة قبض
 * Allows user to create an invoice immediately after recording an income entry
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, CheckCircle, AlertTriangle, Upload, X } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { createLedgerService } from "@/services/ledgerService";

// وحدات القياس للمصنع - Unit types for manufacturing
type InvoiceItemUnit = 'm' | 'm2' | 'piece';
type InvoiceItemType = 'material' | 'service';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemType?: InvoiceItemType;
  unit?: InvoiceItemUnit;
  length?: number;
  width?: number;
  thickness?: number;
}

// نوع البيانات للحفظ في Firestore
interface CleanInvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  itemType: InvoiceItemType;
  unit: InvoiceItemUnit;
  length?: number;
  width?: number;
  thickness?: number;
}

interface PendingInvoiceData {
  clientName: string;
  amount: number;
}

interface QuickInvoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  pendingData: PendingInvoiceData | null;
}

export function QuickInvoiceDialog({
  isOpen,
  onClose,
  pendingData,
}: QuickInvoiceDialogProps) {
  const { user, role } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // حالة النموذج - Form state
  const [formData, setFormData] = useState({
    clientPhone: "",
    clientAddress: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    taxRate: "0",
    notes: "",
    manualInvoiceNumber: "",
    invoiceImageUrl: "",
  });

  // حالة معاينة الصورة - Image preview state
  const [showImagePreview, setShowImagePreview] = useState(false);

  // بنود الفاتورة مع القيم الافتراضية من الدفعة
  // Invoice items with default values from payment
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: "",
      quantity: 1,
      unitPrice: pendingData?.amount || 0,
      total: pendingData?.amount || 0,
      itemType: 'material',
      unit: 'piece',
      length: undefined,
      width: undefined,
      thickness: undefined,
    },
  ]);

  // تحديث البنود عند تغيير pendingData
  // Update items when pendingData changes
  if (pendingData && items[0].unitPrice === 0 && items[0].total === 0) {
    setItems([{
      ...items[0],
      unitPrice: pendingData.amount,
      total: pendingData.amount,
    }]);
  }

  const calculateTotals = (itemsList: InvoiceItem[], taxRate: number) => {
    const subtotal = itemsList.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * taxRate) / 100;
    const total = subtotal + taxAmount;
    return { subtotal, taxAmount, total };
  };

  const handleAddItem = () => {
    setItems([...items, {
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
      itemType: 'material',
      unit: 'piece',
      length: undefined,
      width: undefined,
      thickness: undefined,
    }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number | InvoiceItemUnit | InvoiceItemType | undefined) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // Helper to round to 2 decimal places
    const round2 = (num: number) => Math.round(num * 100) / 100;

    if (field === "quantity" || field === "unitPrice") {
      // Forward calculation: Total = Qty × Price (rounded to 2 decimals)
      newItems[index].total = round2(newItems[index].quantity * newItems[index].unitPrice);
    } else if (field === "total") {
      // Reverse calculation: Price = Total / Qty (rounded to 2 decimals)
      if (newItems[index].quantity > 0) {
        newItems[index].unitPrice = round2(newItems[index].total / newItems[index].quantity);
      }
    }

    setItems(newItems);
  };

  // Handle invoice image upload (converts to base64)
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormData({ ...formData, invoiceImageUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pendingData) { return; }

    setLoading(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals(items, parseFloat(formData.taxRate));

      // تنظيف البنود من القيم الفارغة - Firestore لا يقبل undefined
      // Clean items from undefined values - Firestore doesn't accept undefined
      const cleanedItems: CleanInvoiceItem[] = items.map(item => {
        const cleanItem: CleanInvoiceItem = {
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          itemType: item.itemType || 'material',
          unit: item.unit || 'piece',
        };
        // فقط أضف الأبعاد إذا كانت موجودة (للمواد فقط)
        // Only add dimensions if they have values (materials only)
        if (item.itemType !== 'service') {
          if (item.length !== undefined && item.length !== null) {
            cleanItem.length = item.length;
          }
          if (item.width !== undefined && item.width !== null) {
            cleanItem.width = item.width;
          }
          if (item.thickness !== undefined && item.thickness !== null) {
            cleanItem.thickness = item.thickness;
          }
        }
        return cleanItem;
      });

      // تعيين تاريخ الاستحقاق تلقائياً (30 يوم من تاريخ الفاتورة)
      // Auto-set due date to 30 days from invoice date
      const invoiceDate = new Date(formData.invoiceDate);
      const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');
      const result = await service.createInvoice({
        clientName: pendingData.clientName,
        clientAddress: formData.clientAddress,
        clientPhone: formData.clientPhone,
        invoiceDate,
        dueDate,
        items: cleanedItems,
        subtotal,
        taxRate: parseFloat(formData.taxRate),
        taxAmount,
        total,
        notes: formData.notes,
        manualInvoiceNumber: formData.manualInvoiceNumber || undefined,
        invoiceImageUrl: formData.invoiceImageUrl || undefined,
      });

      if (result.success) {
        toast({
          title: "تم إنشاء الفاتورة",
          description: `تم إنشاء الفاتورة ${result.data} للعميل ${pendingData.clientName}`,
        });

        // إعادة تعيين النموذج - Reset form
        resetForm();
        onClose();
      } else {
        toast({
          title: "خطأ",
          description: result.error || "حدث خطأ أثناء إنشاء الفاتورة",
          variant: "destructive",
        });
      }
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      clientPhone: "",
      clientAddress: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      taxRate: "0",
      notes: "",
      manualInvoiceNumber: "",
      invoiceImageUrl: "",
    });
    setShowImagePreview(false);
    setItems([{
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
      itemType: 'material',
      unit: 'piece',
      length: undefined,
      width: undefined,
      thickness: undefined,
    }]);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const totals = calculateTotals(items, parseFloat(formData.taxRate));

  if (!pendingData) { return null; }

  return (
    <>
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto px-6">
        <DialogHeader>
          <DialogTitle>إنشاء فاتورة جديدة</DialogTitle>
          <DialogDescription>
            إنشاء فاتورة للعميل: <strong>{pendingData.clientName}</strong> - المبلغ المسجل: <strong>{pendingData.amount.toFixed(2)} دينار</strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* معلومات العميل - Client Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم العميل</Label>
              <Input value={pendingData.clientName} disabled className="bg-gray-50" />
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

          {/* التاريخ والضريبة - Date and Tax */}
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

          {/* بنود الفاتورة - Invoice Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>بنود الفاتورة</Label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة بند
              </Button>
            </div>

            {/* جدول بنود الفاتورة مع أبعاد التصنيع */}
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
                          onChange={(e) => handleItemChange(index, "unitPrice", Math.round(parseFloat(e.target.value) * 100) / 100 || 0)}
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
                          onChange={(e) => handleItemChange(index, "total", Math.round(parseFloat(e.target.value) * 100) / 100 || 0)}
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

          {/* المجاميع - Totals */}
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

          {/* مطابقة القيد - Ledger Reconciliation */}
          {/* Relaxed validation: allows match if rounded values are equal */}
          {pendingData && (
            <div className={`p-3 rounded-lg border ${
              Math.round(totals.total) === Math.round(pendingData.amount)
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">المبلغ من القيد:</span>
                    <span className="font-medium">{pendingData.amount.toFixed(2)} دينار</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">مجموع الفاتورة:</span>
                    <span className="font-medium">{totals.total.toFixed(2)} دينار</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {Math.round(totals.total) === Math.round(pendingData.amount) ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-medium text-sm">مطابق</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-5 h-5 text-yellow-600" />
                      <span className="text-yellow-700 font-medium text-sm">غير مطابق</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ملاحظات - Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <textarea
              id="notes"
              className="w-full min-h-[60px] px-3 py-2 border rounded-md"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="ملاحظات إضافية للفاتورة..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              تخطي
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الإنشاء..." : "إنشاء الفاتورة"}
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
