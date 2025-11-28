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
import { Plus, Trash2 } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { collection, addDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";

// وحدات القياس للمصنع - Unit types for manufacturing
type InvoiceItemUnit = 'm' | 'm2' | 'piece';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unit?: InvoiceItemUnit;
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
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // حالة النموذج - Form state
  const [formData, setFormData] = useState({
    clientPhone: "",
    clientAddress: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    taxRate: "0",
    notes: "",
  });

  // بنود الفاتورة مع القيم الافتراضية من الدفعة
  // Invoice items with default values from payment
  const [items, setItems] = useState<InvoiceItem[]>([
    {
      description: "",
      quantity: 1,
      unitPrice: pendingData?.amount || 0,
      total: pendingData?.amount || 0,
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

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    return `INV-${year}-${random}`;
  };

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

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }

    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !pendingData) { return; }

    setLoading(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals(items, parseFloat(formData.taxRate));
      const invoiceNumber = generateInvoiceNumber();

      await addDoc(collection(firestore, `users/${user.uid}/invoices`), {
        invoiceNumber,
        clientName: pendingData.clientName,
        clientAddress: formData.clientAddress,
        clientPhone: formData.clientPhone,
        invoiceDate: new Date(formData.invoiceDate),
        dueDate: new Date(formData.dueDate),
        items,
        subtotal,
        taxRate: parseFloat(formData.taxRate),
        taxAmount,
        total,
        status: "draft",
        notes: formData.notes,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      toast({
        title: "تم إنشاء الفاتورة",
        description: `تم إنشاء الفاتورة ${invoiceNumber} للعميل ${pendingData.clientName}`,
      });

      // إعادة تعيين النموذج - Reset form
      resetForm();
      onClose();
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
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      taxRate: "0",
      notes: "",
    });
    setItems([{
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
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
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

          {/* التواريخ والضريبة - Dates and Tax */}
          <div className="grid grid-cols-3 gap-4">
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
              <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
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
              <table className="w-full min-w-[900px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-2 text-xs font-medium text-right">الوصف</th>
                    <th className="px-2 py-2 text-xs font-medium text-right w-20">الوحدة</th>
                    <th className="px-2 py-2 text-xs font-medium text-right w-16">الطول</th>
                    <th className="px-2 py-2 text-xs font-medium text-right w-16">العرض</th>
                    <th className="px-2 py-2 text-xs font-medium text-right w-16">السماكة</th>
                    <th className="px-2 py-2 text-xs font-medium text-right w-20">الكمية</th>
                    <th className="px-2 py-2 text-xs font-medium text-right w-20">السعر</th>
                    <th className="px-2 py-2 text-xs font-medium text-right w-24">المجموع</th>
                    <th className="px-2 py-2 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index} className="border-t">
                      {/* الوصف */}
                      <td className="px-1 py-1">
                        <Input
                          value={item.description}
                          onChange={(e) => handleItemChange(index, "description", e.target.value)}
                          placeholder="وصف المنتج"
                          required
                          className="h-8 text-sm"
                        />
                      </td>
                      {/* الوحدة - Unit dropdown */}
                      <td className="px-1 py-1">
                        <select
                          value={item.unit || 'piece'}
                          onChange={(e) => handleItemChange(index, "unit", e.target.value as InvoiceItemUnit)}
                          className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          <option value="m">متر طولي</option>
                          <option value="m2">متر مربع</option>
                          <option value="piece">عدد</option>
                        </select>
                      </td>
                      {/* الطول - Length */}
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.length ?? ''}
                          onChange={(e) => handleItemChange(index, "length", e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="م"
                          className="h-8 text-sm"
                        />
                      </td>
                      {/* العرض - Width */}
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.width ?? ''}
                          onChange={(e) => handleItemChange(index, "width", e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="م"
                          className="h-8 text-sm"
                        />
                      </td>
                      {/* السماكة - Thickness (CRITICAL) */}
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.thickness ?? ''}
                          onChange={(e) => handleItemChange(index, "thickness", e.target.value ? parseFloat(e.target.value) : undefined)}
                          placeholder="مم"
                          className="h-8 text-sm"
                        />
                      </td>
                      {/* الكمية - Quantity */}
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", parseFloat(e.target.value) || 0)}
                          required
                          className="h-8 text-sm"
                        />
                      </td>
                      {/* السعر - Price */}
                      <td className="px-1 py-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, "unitPrice", parseFloat(e.target.value) || 0)}
                          required
                          className="h-8 text-sm"
                        />
                      </td>
                      {/* المجموع - Total */}
                      <td className="px-1 py-1">
                        <Input value={item.total.toFixed(2)} disabled className="h-8 text-sm bg-gray-50" />
                      </td>
                      {/* حذف - Delete */}
                      <td className="px-1 py-1">
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
  );
}
