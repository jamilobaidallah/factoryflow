"use client";

import { useState, useMemo, useReducer } from "react";
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
import { Plus, Edit, Trash2, Download, Eye, Image, X, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { PermissionGate } from "@/components/auth";
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
import { formatShortDate, formatNumber } from "@/lib/date-utils";

// UI state management with useReducer
interface UIState {
  isDialogOpen: boolean;
  isPreviewOpen: boolean;
  editingInvoice: Invoice | null;
  viewInvoice: Invoice | null;
  loading: boolean;
  selectedImageUrl: string | null;
}

type UIAction =
  | { type: 'OPEN_ADD_DIALOG' }
  | { type: 'OPEN_EDIT_DIALOG'; invoice: Invoice }
  | { type: 'CLOSE_DIALOG' }
  | { type: 'OPEN_PREVIEW'; invoice: Invoice }
  | { type: 'CLOSE_PREVIEW' }
  | { type: 'SET_LOADING'; value: boolean }
  | { type: 'OPEN_IMAGE_VIEWER'; url: string }
  | { type: 'CLOSE_IMAGE_VIEWER' };

const initialUIState: UIState = {
  isDialogOpen: false,
  isPreviewOpen: false,
  editingInvoice: null,
  viewInvoice: null,
  loading: false,
  selectedImageUrl: null,
};

// Sort types for invoice table
type InvoiceSortField = "invoiceNumber" | "clientName" | "invoiceDate" | "total" | "status";
type SortDirection = "asc" | "desc";

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'OPEN_ADD_DIALOG':
      return { ...state, isDialogOpen: true, editingInvoice: null };
    case 'OPEN_EDIT_DIALOG':
      return { ...state, isDialogOpen: true, editingInvoice: action.invoice };
    case 'CLOSE_DIALOG':
      return { ...state, isDialogOpen: false, editingInvoice: null };
    case 'OPEN_PREVIEW':
      return { ...state, isPreviewOpen: true, viewInvoice: action.invoice };
    case 'CLOSE_PREVIEW':
      return { ...state, isPreviewOpen: false, viewInvoice: null };
    case 'SET_LOADING':
      return { ...state, loading: action.value };
    case 'OPEN_IMAGE_VIEWER':
      return { ...state, selectedImageUrl: action.url };
    case 'CLOSE_IMAGE_VIEWER':
      return { ...state, selectedImageUrl: null };
    default:
      return state;
  }
}

export default function InvoicesPage() {
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Data and operations hooks
  const { invoices, loading: dataLoading } = useInvoicesData();
  const { submitInvoice, deleteInvoice, updateStatus, exportPDF } = useInvoicesOperations();

  // UI state - consolidated with useReducer
  const [ui, dispatch] = useReducer(uiReducer, initialUIState);

  // Form state (kept separate due to complexity)
  const [formData, setFormData] = useState<InvoiceFormData>(initialFormData);
  const [items, setItems] = useState<InvoiceItem[]>([initialInvoiceItem]);

  // Sort state
  const [sortField, setSortField] = useState<InvoiceSortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Sort handler
  const handleSort = (field: InvoiceSortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort icon component
  const SortIcon = ({ field }: { field: InvoiceSortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 text-slate-300" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 text-blue-600" />
    ) : (
      <ChevronDown className="h-4 w-4 text-blue-600" />
    );
  };

  // Sorted invoices with memoization
  const sortedInvoices = useMemo(() => {
    if (!sortField) return invoices;

    return [...invoices].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case "invoiceNumber":
          comparison = a.invoiceNumber.localeCompare(b.invoiceNumber);
          break;
        case "clientName":
          comparison = a.clientName.localeCompare(b.clientName, "ar");
          break;
        case "invoiceDate": {
          const dateA = a.invoiceDate instanceof Date ? a.invoiceDate : new Date(a.invoiceDate);
          const dateB = b.invoiceDate instanceof Date ? b.invoiceDate : new Date(b.invoiceDate);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        }
        case "total":
          comparison = a.total - b.total;
          break;
        case "status": {
          const statusOrder = { draft: 0, sent: 1, overdue: 2, paid: 3 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [invoices, sortField, sortDirection]);

  // Memoized calculations for statistics cards
  const invoiceStats = useMemo(() => ({
    total: invoices.length,
    paidCount: invoices.filter((inv) => inv.status === "paid").length,
    overdueCount: invoices.filter((inv) => inv.status === "overdue").length,
    totalValue: invoices.reduce((sum, inv) => sum + inv.total, 0),
  }), [invoices]);

  const resetForm = () => {
    setFormData(initialFormData);
    setItems([initialInvoiceItem]);
  };

  const openAddDialog = () => {
    resetForm();
    dispatch({ type: 'OPEN_ADD_DIALOG' });
  };

  const handleEdit = (invoice: Invoice) => {
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
    dispatch({ type: 'OPEN_EDIT_DIALOG', invoice });
  };

  const handlePreview = (invoice: Invoice) => {
    dispatch({ type: 'OPEN_PREVIEW', invoice });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: 'SET_LOADING', value: true });

    const success = await submitInvoice(formData, items, ui.editingInvoice);

    if (success) {
      resetForm();
      dispatch({ type: 'CLOSE_DIALOG' });
    }
    dispatch({ type: 'SET_LOADING', value: false });
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
        <PermissionGate action="create" module="invoices">
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 ml-2" />
            فاتورة جديدة
          </Button>
        </PermissionGate>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">إجمالي الفواتير</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoiceStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">المدفوعة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {invoiceStats.paidCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">المتأخرة</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {invoiceStats.overdueCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">القيمة الكلية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoiceStats.totalValue.toFixed(2)} د.أ
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">قائمة الفواتير</h2>
        <div className="card-modern overflow-hidden">
          <Table containerClassName="max-h-[70vh]">
            <TableHeader sticky className="bg-slate-50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-right font-semibold text-slate-700">
                  <button
                    onClick={() => handleSort("invoiceNumber")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    رقم الفاتورة
                    <SortIcon field="invoiceNumber" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">رقم يدوي</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">
                  <button
                    onClick={() => handleSort("clientName")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    العميل
                    <SortIcon field="clientName" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">
                  <button
                    onClick={() => handleSort("invoiceDate")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    التاريخ
                    <SortIcon field="invoiceDate" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">
                  <button
                    onClick={() => handleSort("total")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    المبلغ
                    <SortIcon field="total" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">
                  <button
                    onClick={() => handleSort("status")}
                    className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                  >
                    الحالة
                    <SortIcon field="status" />
                  </button>
                </TableHead>
                <TableHead className="text-right font-semibold text-slate-700">صورة</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                    لا توجد فواتير بعد. انقر على &quot;فاتورة جديدة&quot; للبدء.
                  </TableCell>
                </TableRow>
              ) : (
                sortedInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="table-row-hover">
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {invoice.manualInvoiceNumber || "-"}
                    </TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{formatShortDate(invoice.invoiceDate)}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-900">
                        {formatNumber(invoice.total)} د.أ
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
                          onClick={() => dispatch({ type: 'OPEN_IMAGE_VIEWER', url: invoice.invoiceImageUrl! })}
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
                        <PermissionGate action="export" module="invoices">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50"
                            onClick={() => exportPDF(invoice)}
                            title="تصدير PDF"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="update" module="invoices">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                            onClick={() => handleEdit(invoice)}
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate action="update" module="invoices">
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
                        </PermissionGate>
                        <PermissionGate action="delete" module="invoices">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(invoice.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </PermissionGate>
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
        isOpen={ui.isDialogOpen}
        onClose={() => dispatch({ type: 'CLOSE_DIALOG' })}
        editingInvoice={ui.editingInvoice}
        formData={formData}
        setFormData={setFormData}
        items={items}
        setItems={setItems}
        loading={ui.loading}
        onSubmit={handleSubmit}
      />

      <InvoicePreviewDialog
        isOpen={ui.isPreviewOpen}
        onClose={() => dispatch({ type: 'CLOSE_PREVIEW' })}
        invoice={ui.viewInvoice}
        onExportPDF={exportPDF}
      />

      {/* Image Preview Modal */}
      {ui.selectedImageUrl && (
        <Dialog open={!!ui.selectedImageUrl} onOpenChange={() => dispatch({ type: 'CLOSE_IMAGE_VIEWER' })}>
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>صورة الفاتورة</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => dispatch({ type: 'CLOSE_IMAGE_VIEWER' })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            <div className="flex justify-center items-center overflow-auto max-h-[70vh]">
              <img
                src={ui.selectedImageUrl}
                alt="صورة الفاتورة"
                className="max-w-full max-h-full object-contain"
                loading="lazy"
                decoding="async"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {confirmationDialog}
    </div>
  );
}
