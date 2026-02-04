"use client";

import { Button } from "@/components/ui/button";
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
import { Download } from "lucide-react";
import { Invoice } from "../types/invoices";
import { formatShortDate } from "@/lib/date-utils";

interface InvoicePreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  onExportPDF: (invoice: Invoice) => void;
}

export function InvoicePreviewDialog({
  isOpen,
  onClose,
  invoice,
  onExportPDF,
}: InvoicePreviewDialogProps) {
  if (!invoice) {return null;}

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

  // تنسيق الأبعاد بشكل موضعي ثابت - Strict positional dimension formatting
  // Format: Length × Width × Thickness (use dash for missing values)
  const formatDimensions = (length?: number, width?: number, thickness?: number): string => {
    const l = (length && length > 0) ? `${length}` : '-';
    const w = (width && width > 0) ? `${width}` : '-';
    const t = (thickness && thickness > 0) ? `${thickness}` : '-';
    return `${l} × ${w} × ${t}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto px-6">
        <DialogHeader>
          <DialogTitle>معاينة الفاتورة</DialogTitle>
          <DialogDescription>
            فاتورة رقم: {invoice.invoiceNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Client & Invoice Info */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">معلومات العميل</h3>
              <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                <p><span className="text-gray-500">الاسم:</span> {invoice.clientName}</p>
                {invoice.clientAddress && (
                  <p><span className="text-gray-500">العنوان:</span> {invoice.clientAddress}</p>
                )}
                {invoice.clientPhone && (
                  <p><span className="text-gray-500">الهاتف:</span> {invoice.clientPhone}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">معلومات الفاتورة</h3>
              <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
                <p><span className="text-gray-500">التاريخ:</span> {formatShortDate(invoice.invoiceDate)}</p>
                <p><span className="text-gray-500">الاستحقاق:</span> {formatShortDate(invoice.dueDate)}</p>
                <p>
                  <span className="text-gray-500">الحالة:</span>{" "}
                  <span className={`px-2 py-0.5 rounded text-xs ${getStatusColor(invoice.status)}`}>
                    {getStatusLabel(invoice.status)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Invoice Items Table */}
          <div className="space-y-2">
            <h3 className="font-semibold text-gray-700">بنود الفاتورة</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead>الوصف</TableHead>
                    <TableHead className="text-center">الوحدة</TableHead>
                    <TableHead className="text-center">الأبعاد (ط×ع×س) سم</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-center">السعر</TableHead>
                    <TableHead className="text-center">المجموع</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.items.map((item, index) => {
                    const unitDisplay = item.unit === 'm' ? 'متر طولي' : item.unit === 'm2' ? 'متر مربع' : 'عدد';
                    return (
                      <TableRow key={index}>
                        <TableCell>{item.description}</TableCell>
                        <TableCell className="text-center">{unitDisplay}</TableCell>
                        <TableCell className="text-center font-mono">
                          {formatDimensions(item.length, item.width, item.thickness)}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-center">{item.unitPrice.toFixed(2)} دينار</TableCell>
                        <TableCell className="text-center">{item.total.toFixed(2)} دينار</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span>المجموع الفرعي:</span>
              <span className="font-medium">{invoice.subtotal.toFixed(2)} دينار</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>الضريبة ({invoice.taxRate}%):</span>
              <span className="font-medium">{invoice.taxAmount.toFixed(2)} دينار</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>المجموع الكلي:</span>
              <span className="text-primary">{invoice.total.toFixed(2)} دينار</span>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700">ملاحظات</h3>
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                {invoice.notes}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              إغلاق
            </Button>
            <Button onClick={() => {
              onExportPDF(invoice);
              onClose();
            }}>
              <Download className="w-4 h-4 ml-2" />
              تصدير PDF
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
