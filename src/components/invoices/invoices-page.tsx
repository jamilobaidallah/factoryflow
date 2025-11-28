"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Download, Eye, Send } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";

// وحدات القياس للمصنع
// Unit types for manufacturing
type InvoiceItemUnit = 'm' | 'm2' | 'piece';

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  // بيانات التصنيع - Manufacturing data
  unit?: InvoiceItemUnit;
  length?: number;    // الطول (متر)
  width?: number;     // العرض (متر)
  thickness?: number; // السماكة (مم) - CRITICAL FIELD
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  invoiceDate: Date;
  dueDate: Date;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: "draft" | "sent" | "paid" | "overdue";
  notes?: string;
  linkedTransactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function InvoicesPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const [formData, setFormData] = useState({
    clientName: "",
    clientAddress: "",
    clientPhone: "",
    invoiceDate: new Date().toISOString().split("T")[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    taxRate: "0",
    notes: "",
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0, unit: 'piece', length: undefined, width: undefined, thickness: undefined },
  ]);

  useEffect(() => {
    if (!user) {return;}

    const invoicesRef = collection(firestore, `users/${user.uid}/invoices`);
    // Limit to 1000 most recent invoices
    const q = query(invoicesRef, orderBy("invoiceDate", "desc"), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData: Invoice[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        invoicesData.push({
          id: doc.id,
          ...data,
          invoiceDate: data.invoiceDate?.toDate ? data.invoiceDate.toDate() : new Date(),
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
        } as Invoice);
      });
      setInvoices(invoicesData);

      // Auto-update overdue status
      invoicesData.forEach(async (invoice) => {
        if (invoice.status === "sent" && new Date() > invoice.dueDate) {
          const invoiceRef = doc(firestore, `users/${user.uid}/invoices`, invoice.id);
          await updateDoc(invoiceRef, { status: "overdue" });
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

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
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, total: 0, unit: 'piece', length: undefined, width: undefined, thickness: undefined }]);
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
    if (!user) {return;}

    setLoading(true);
    try {
      const { subtotal, taxAmount, total } = calculateTotals(items, parseFloat(formData.taxRate));

      if (editingInvoice) {
        const invoiceRef = doc(firestore, `users/${user.uid}/invoices`, editingInvoice.id);
        await updateDoc(invoiceRef, {
          clientName: formData.clientName,
          clientAddress: formData.clientAddress,
          clientPhone: formData.clientPhone,
          invoiceDate: new Date(formData.invoiceDate),
          dueDate: new Date(formData.dueDate),
          items,
          subtotal,
          taxRate: parseFloat(formData.taxRate),
          taxAmount,
          total,
          notes: formData.notes,
          updatedAt: new Date(),
        });

        toast({
          title: "تم التحديث",
          description: "تم تحديث الفاتورة بنجاح",
        });
      } else {
        const invoiceNumber = generateInvoiceNumber();

        await addDoc(collection(firestore, `users/${user.uid}/invoices`), {
          invoiceNumber,
          clientName: formData.clientName,
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
          title: "تمت الإضافة",
          description: `تم إنشاء الفاتورة ${invoiceNumber} بنجاح`,
        });
      }

      resetForm();
      setIsDialogOpen(false);
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

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      clientName: invoice.clientName,
      clientAddress: invoice.clientAddress || "",
      clientPhone: invoice.clientPhone || "",
      invoiceDate: invoice.invoiceDate.toISOString().split("T")[0],
      dueDate: invoice.dueDate.toISOString().split("T")[0],
      taxRate: invoice.taxRate.toString(),
      notes: invoice.notes || "",
    });
    setItems(invoice.items);
    setIsDialogOpen(true);
  };

  const handleDelete = (invoiceId: string) => {
    if (!user) {return;}

    confirm(
      "حذف الفاتورة",
      "هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          await deleteDoc(doc(firestore, `users/${user.uid}/invoices`, invoiceId));
          toast({
            title: "تم الحذف",
            description: "تم حذف الفاتورة بنجاح",
          });
        } catch (error) {
          const appError = handleError(error);
          toast({
            title: getErrorTitle(appError),
            description: appError.message,
            variant: "destructive",
          });
        }
      },
      "destructive"
    );
  };

  const handleUpdateStatus = async (invoiceId: string, newStatus: Invoice["status"]) => {
    if (!user) {return;}

    try {
      const invoiceRef = doc(firestore, `users/${user.uid}/invoices`, invoiceId);
      await updateDoc(invoiceRef, {
        status: newStatus,
        updatedAt: new Date(),
      });

      // If marked as paid, create ledger entry
      if (newStatus === "paid") {
        const invoice = invoices.find((inv) => inv.id === invoiceId);
        if (invoice) {
          const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
          await addDoc(ledgerRef, {
            transactionId: `PAY-${invoice.invoiceNumber}`,
            description: `دفعة فاتورة ${invoice.invoiceNumber} - ${invoice.clientName}`,
            type: "دخل",
            amount: invoice.total,
            category: "إيرادات المبيعات",
            subCategory: "مبيعات منتجات",
            associatedParty: invoice.clientName,
            date: new Date(),
            reference: invoice.invoiceNumber,
            notes: `دفعة فاتورة مرتبطة`,
            createdAt: new Date(),
          });
        }
      }

      toast({
        title: "تم التحديث",
        description: `تم تحديث حالة الفاتورة إلى: ${getStatusLabel(newStatus)}`,
      });
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = (invoice: Invoice) => {
    // Create a simple HTML invoice for print
    const printWindow = window.open("", "_blank");
    if (!printWindow) {return;}

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة ${invoice.invoiceNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
          .company-name { font-size: 24px; font-weight: bold; color: #2563eb; }
          .invoice-title { font-size: 20px; margin-top: 10px; }
          .info-section { display: flex; justify-content: space-between; margin: 30px 0; }
          .info-block { width: 48%; }
          .info-block h3 { font-size: 14px; color: #666; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background-color: #f3f4f6; font-weight: bold; }
          .totals { margin-top: 30px; text-align: left; }
          .totals-table { width: 300px; margin-right: auto; }
          .totals-table td { border: none; padding: 8px; }
          .total-row { font-size: 18px; font-weight: bold; background-color: #f3f4f6; }
          .notes { margin-top: 30px; padding: 15px; background-color: #f9fafb; border-radius: 5px; }
          .footer { margin-top: 50px; text-align: center; color: #666; font-size: 12px; }
          @media print { button { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="company-name">FactoryFlow</div>
          <div class="invoice-title">فاتورة رقم: ${invoice.invoiceNumber}</div>
        </div>

        <div class="info-section">
          <div class="info-block">
            <h3>معلومات العميل:</h3>
            <p><strong>الاسم:</strong> ${invoice.clientName}</p>
            ${invoice.clientAddress ? `<p><strong>العنوان:</strong> ${invoice.clientAddress}</p>` : ""}
            ${invoice.clientPhone ? `<p><strong>الهاتف:</strong> ${invoice.clientPhone}</p>` : ""}
          </div>
          <div class="info-block">
            <h3>معلومات الفاتورة:</h3>
            <p><strong>تاريخ الفاتورة:</strong> ${invoice.invoiceDate.toLocaleDateString("ar-JO")}</p>
            <p><strong>تاريخ الاستحقاق:</strong> ${invoice.dueDate.toLocaleDateString("ar-JO")}</p>
            <p><strong>الحالة:</strong> ${getStatusLabel(invoice.status)}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>الوصف</th>
              <th>الوحدة</th>
              <th>الأبعاد (ط×ع×س)</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => {
              // تحويل الوحدة للعرض - Unit display conversion
              const unitDisplay = item.unit === 'm' ? 'متر طولي' : item.unit === 'm2' ? 'متر مربع' : 'عدد';
              // تنسيق الأبعاد - Format dimensions
              const dims = [
                item.length ? `${item.length}م` : '',
                item.width ? `${item.width}م` : '',
                item.thickness ? `${item.thickness}مم` : ''
              ].filter(Boolean).join(' × ') || '-';
              return `
              <tr>
                <td>${item.description}</td>
                <td>${unitDisplay}</td>
                <td>${dims}</td>
                <td>${item.quantity}</td>
                <td>${item.unitPrice.toFixed(2)} دينار</td>
                <td>${item.total.toFixed(2)} دينار</td>
              </tr>
            `;}).join("")}
          </tbody>
        </table>

        <div class="totals">
          <table class="totals-table">
            <tr>
              <td>المجموع الفرعي:</td>
              <td style="text-align: left;">${invoice.subtotal.toFixed(2)} دينار</td>
            </tr>
            <tr>
              <td>الضريبة (${invoice.taxRate}%):</td>
              <td style="text-align: left;">${invoice.taxAmount.toFixed(2)} دينار</td>
            </tr>
            <tr class="total-row">
              <td>المجموع الكلي:</td>
              <td style="text-align: left;">${invoice.total.toFixed(2)} دينار</td>
            </tr>
          </table>
        </div>

        ${invoice.notes ? `
          <div class="notes">
            <strong>ملاحظات:</strong><br>
            ${invoice.notes}
          </div>
        ` : ""}

        <div class="footer">
          <p>شكراً لتعاملكم معنا</p>
          <p>تم إنشاء هذه الفاتورة بواسطة نظام FactoryFlow</p>
        </div>

        <button onclick="window.print()" style="margin: 20px auto; display: block; padding: 10px 30px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
          طباعة / حفظ كـ PDF
        </button>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  const getStatusLabel = (status: Invoice["status"]) => {
    const labels = {
      draft: "مسودة",
      sent: "مرسلة",
      paid: "مدفوعة",
      overdue: "متأخرة",
    };
    return labels[status];
  };

  const getStatusColor = (status: Invoice["status"]) => {
    const colors = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      overdue: "bg-red-100 text-red-800",
    };
    return colors[status];
  };

  const resetForm = () => {
    setFormData({
      clientName: "",
      clientAddress: "",
      clientPhone: "",
      invoiceDate: new Date().toISOString().split("T")[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      taxRate: "0",
      notes: "",
    });
    setItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unit: 'piece', length: undefined, width: undefined, thickness: undefined }]);
    setEditingInvoice(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const totals = calculateTotals(items, parseFloat(formData.taxRate));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">الفواتير</h1>
          <p className="text-gray-500 mt-1">إنشاء وإدارة فواتير العملاء</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 ml-2" />
          فاتورة جديدة
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">إجمالي الفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">المدفوعة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {invoices.filter((inv) => inv.status === "paid").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">المتأخرة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {invoices.filter((inv) => inv.status === "overdue").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">القيمة الكلية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <CardTitle>قائمة الفواتير</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الفاتورة</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الاستحقاق</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    لا توجد فواتير بعد. انقر على &quot;فاتورة جديدة&quot; للبدء.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{invoice.invoiceDate.toLocaleDateString("ar-JO")}</TableCell>
                    <TableCell>{invoice.dueDate.toLocaleDateString("ar-JO")}</TableCell>
                    <TableCell>{invoice.total.toFixed(2)} د.أ</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(invoice.status)}`}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExportPDF(invoice)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(invoice)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        {invoice.status !== "paid" && (
                          <select
                            className="text-xs border rounded px-2 py-1"
                            value={invoice.status}
                            onChange={(e) =>
                              handleUpdateStatus(invoice.id, e.target.value as Invoice["status"])
                            }
                          >
                            <option value="draft">مسودة</option>
                            <option value="sent">مرسلة</option>
                            <option value="paid">مدفوعة</option>
                            <option value="overdue">متأخرة</option>
                          </select>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(invoice.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvoice ? "تعديل الفاتورة" : "فاتورة جديدة"}
            </DialogTitle>
            <DialogDescription>
              املأ بيانات الفاتورة والبنود بالأسفل
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "جاري الحفظ..." : editingInvoice ? "تحديث" : "حفظ"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {confirmationDialog}
    </div>
  );
}
