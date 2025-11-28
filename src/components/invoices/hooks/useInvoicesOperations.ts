"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Invoice, InvoiceFormData, InvoiceItem, CleanInvoiceItem } from "../types/invoices";

interface UseInvoicesOperationsReturn {
  submitInvoice: (
    formData: InvoiceFormData,
    items: InvoiceItem[],
    editingInvoice: Invoice | null
  ) => Promise<boolean>;
  deleteInvoice: (invoiceId: string) => Promise<boolean>;
  updateStatus: (invoiceId: string, newStatus: Invoice["status"], invoices: Invoice[]) => Promise<boolean>;
  exportPDF: (invoice: Invoice) => void;
}

export function useInvoicesOperations(): UseInvoicesOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

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

  const submitInvoice = async (
    formData: InvoiceFormData,
    items: InvoiceItem[],
    editingInvoice: Invoice | null
  ): Promise<boolean> => {
    if (!user) return false;

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
          unit: item.unit || 'piece',
        };
        // فقط أضف الأبعاد إذا كانت موجودة
        // Only add dimensions if they have values
        if (item.length !== undefined && item.length !== null) {
          cleanItem.length = item.length;
        }
        if (item.width !== undefined && item.width !== null) {
          cleanItem.width = item.width;
        }
        if (item.thickness !== undefined && item.thickness !== null) {
          cleanItem.thickness = item.thickness;
        }
        return cleanItem;
      });

      // تعيين تاريخ الاستحقاق تلقائياً (30 يوم من تاريخ الفاتورة)
      // Auto-set due date to 30 days from invoice date
      const invoiceDate = new Date(formData.invoiceDate);
      const dueDate = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (editingInvoice) {
        const invoiceRef = doc(firestore, `users/${user.uid}/invoices`, editingInvoice.id);
        await updateDoc(invoiceRef, {
          clientName: formData.clientName,
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
          invoiceDate,
          dueDate,
          items: cleanedItems,
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

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteInvoice = async (invoiceId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      await deleteDoc(doc(firestore, `users/${user.uid}/invoices`, invoiceId));
      toast({
        title: "تم الحذف",
        description: "تم حذف الفاتورة بنجاح",
      });
      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
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

  const updateStatus = async (
    invoiceId: string,
    newStatus: Invoice["status"],
    invoices: Invoice[]
  ): Promise<boolean> => {
    if (!user) return false;

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
      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const exportPDF = (invoice: Invoice) => {
    // Create a simple HTML invoice for print
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // تنسيق الأبعاد بشكل موضعي ثابت - Strict positional dimension formatting
    // Format: Length × Width × Thickness (use dash for missing values)
    const formatDimensions = (length?: number, width?: number, thickness?: number): string => {
      const l = (length && length > 0) ? `${length}` : '-';
      const w = (width && width > 0) ? `${width}` : '-';
      const t = (thickness && thickness > 0) ? `${thickness}` : '-';
      return `${l} × ${w} × ${t}`;
    };

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
              <th>الأبعاد (ط×ع×س) سم</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>المجموع</th>
            </tr>
          </thead>
          <tbody>
            ${invoice.items.map(item => {
              // تحويل الوحدة للعرض - Unit display conversion
              const unitDisplay = item.unit === 'm' ? 'متر طولي' : item.unit === 'm2' ? 'متر مربع' : 'عدد';
              const dims = formatDimensions(item.length, item.width, item.thickness);
              return `
              <tr>
                <td>${item.description}</td>
                <td>${unitDisplay}</td>
                <td style="font-family: monospace;">${dims}</td>
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

  return { submitInvoice, deleteInvoice, updateStatus, exportPDF };
}
