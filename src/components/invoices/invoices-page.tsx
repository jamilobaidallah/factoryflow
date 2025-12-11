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
import { Plus, Edit, Trash2, Download, Eye, Image, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

  // Image preview state
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

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
      manualInvoiceNumber: invoice.manualInvoiceNumber || "",
      invoiceImageUrl: invoice.invoiceImageUrl || "",
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

  const getStatusBadgeClass = (status: Invoice["status"]) => {
    const classes = {
      draft: "badge-neutral",
      sent: "badge-primary",
      paid: "badge-success",
      overdue: "badge-danger",
    };
    return classes[status];
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
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">قائمة الفواتير</h2>
        <div className="card-modern overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="text-right font-semibold text-slate-700">رقم الفاتورة</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">رقم يدوي</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">العميل</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">التاريخ</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">المبلغ</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">الحالة</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">صورة</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    لا توجد فواتير بعد. انقر على &quot;فاتورة جديدة&quot; للبدء.
                  </TableCell>
                </TableRow>
              ) : (
                invoices.map((invoice) => (
                  <TableRow key={invoice.id} className="table-row-hover">
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {invoice.manualInvoiceNumber || "-"}
                    </TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{invoice.invoiceDate.toLocaleDateString("ar-JO")}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-900">
                        {invoice.total.toLocaleString()} د.أ
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={getStatusBadgeClass(invoice.status)}>
                        {getStatusLabel(invoice.status)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {invoice.invoiceImageUrl ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => setSelectedImageUrl(invoice.invoiceImageUrl || null)}
                          title="عرض صورة الفاتورة"
                        >
                          <Image className="h-4 w-4" />
                        </Button>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                          onClick={() => handlePreview(invoice)}
                          title="معاينة"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50"
                          onClick={() => exportPDF(invoice)}
                          title="تصدير PDF"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                          onClick={() => handleEdit(invoice)}
                          title="تعديل"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {invoice.status !== "paid" && (
                          <select
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDelete(invoice.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

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

      {/* Image Preview Modal */}
      {selectedImageUrl && (
        <Dialog open={!!selectedImageUrl} onOpenChange={() => setSelectedImageUrl(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>صورة الفاتورة</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedImageUrl(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center items-center overflow-auto max-h-[70vh]">
              <img
                src={selectedImageUrl}
                alt="صورة الفاتورة"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {confirmationDialog}
    </div>
  );
}
