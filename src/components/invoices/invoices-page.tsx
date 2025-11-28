"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit, Trash2, Download, Eye } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";

// Types and hooks
import { Invoice, InvoiceFormData, InvoiceItem, initialFormData, initialInvoiceItem } from "./types/invoices";
import { useInvoicesData } from "./hooks/useInvoicesData";
import { useInvoicesOperations } from "./hooks/useInvoicesOperations";

// Components
import { InvoicesFormDialog } from "./components/InvoicesFormDialog";
import { InvoicePreviewDialog } from "./components/InvoicePreviewDialog";

export default function InvoicesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data and operations hooks
  const { invoices, loading: dataLoading } = useInvoicesData();
  const { submitInvoice, deleteInvoice, updateStatus, exportPDF } = useInvoicesOperations();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData);
  const [items, setItems] = useState<InvoiceItem[]>([initialInvoiceItem]);

  const resetForm = () => {
    setFormData(initialFormData);
    setItems([initialInvoiceItem]);
    setEditingInvoice(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleEdit = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setFormData({
      clientName: invoice.clientName,
      clientAddress: invoice.clientAddress || "",
      clientPhone: invoice.clientPhone || "",
      invoiceDate: invoice.invoiceDate.toISOString().split("T")[0],
      taxRate: invoice.taxRate.toString(),
      notes: invoice.notes || "",
    });
    setItems(invoice.items);
    setIsDialogOpen(true);
  };

  const handlePreview = (invoice: Invoice) => {
    setViewInvoice(invoice);
    setIsPreviewOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const success = await submitInvoice(formData, items, editingInvoice);

    if (success) {
      resetForm();
      setIsDialogOpen(false);
    }
    setLoading(false);
  };

  const handleDelete = (invoiceId: string) => {
    confirm(
      "حذف الفاتورة",
      "هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await deleteInvoice(invoiceId);
      },
      "destructive"
    );
  };

  const handleUpdateStatus = async (invoiceId: string, newStatus: Invoice["status"]) => {
    await updateStatus(invoiceId, newStatus, invoices);
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
                          onClick={() => handlePreview(invoice)}
                          title="معاينة"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => exportPDF(invoice)}
                          title="تصدير PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(invoice)}
                          title="تعديل"
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

      {/* Dialogs */}
      <InvoicesFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        editingInvoice={editingInvoice}
        formData={formData}
        setFormData={setFormData}
        items={items}
        setItems={setItems}
        loading={loading}
        onSubmit={handleSubmit}
      />

      <InvoicePreviewDialog
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={viewInvoice}
        onExportPDF={exportPDF}
      />

      {confirmationDialog}
    </div>
  );
}
