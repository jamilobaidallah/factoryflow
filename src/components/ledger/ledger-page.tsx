"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Plus, Download } from "lucide-react";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { exportLedgerToExcel, exportLedgerToPDF, exportLedgerToHTML } from "@/lib/export-utils";
import { StatCardSkeleton, TableSkeleton } from "@/components/ui/loading-skeleton";

// Types and hooks
import {
  LedgerEntry,
  initialPaymentFormData,
  initialChequeRelatedFormData,
  initialInventoryRelatedFormData
} from "./types/ledger";
import { useLedgerData } from "./hooks/useLedgerData";
import { useLedgerForm } from "./hooks/useLedgerForm";
import { useLedgerOperations } from "./hooks/useLedgerOperations";

// Components
import { QuickPayDialog } from "./components/QuickPayDialog";
import { LedgerStats } from "./components/LedgerStats";
import { LedgerTable } from "./components/LedgerTable";
import { LedgerFormDialog } from "./components/LedgerFormDialog";
import { RelatedRecordsDialog } from "./components/RelatedRecordsDialog";
import { QuickInvoiceDialog } from "./components/QuickInvoiceDialog";

export default function LedgerPage() {
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);

  // Data and operations hooks
  const { entries, clients, partners, totalCount, totalPages, loading: dataLoading } = useLedgerData({
    pageSize,
    currentPage,
  });
  const { submitLedgerEntry, deleteLedgerEntry, addPaymentToEntry, addChequeToEntry, addInventoryToEntry } = useLedgerOperations();
  const formHook = useLedgerForm();

  // UI state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntry | null>(null);
  const [loading, setLoading] = useState(false);

  // Related records management
  const [isRelatedDialogOpen, setIsRelatedDialogOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [relatedTab, setRelatedTab] = useState<"payments" | "cheques" | "inventory">("payments");

  // Quick payment dialog
  const [isQuickPayDialogOpen, setIsQuickPayDialogOpen] = useState(false);
  const [quickPayEntry, setQuickPayEntry] = useState<LedgerEntry | null>(null);

  // Invoice creation bridge
  const [createInvoice, setCreateInvoice] = useState(false);
  const [isQuickInvoiceDialogOpen, setIsQuickInvoiceDialogOpen] = useState(false);
  const [pendingInvoiceData, setPendingInvoiceData] = useState<{
    clientName: string;
    amount: number;
  } | null>(null);

  // Destructure form state from hook
  const {
    formData,
    setFormData,
    hasIncomingCheck,
    setHasIncomingCheck,
    hasOutgoingCheck,
    setHasOutgoingCheck,
    hasInventoryUpdate,
    setHasInventoryUpdate,
    hasFixedAsset,
    setHasFixedAsset,
    hasInitialPayment,
    setHasInitialPayment,
    initialPaymentAmount,
    setInitialPaymentAmount,
    checkFormData,
    setCheckFormData,
    outgoingCheckFormData,
    setOutgoingCheckFormData,
    inventoryFormData: inventoryFormDataNew,
    setInventoryFormData: setInventoryFormDataNew,
    fixedAssetFormData,
    setFixedAssetFormData,
    paymentFormData,
    setPaymentFormData,
    chequeRelatedFormData: chequeFormData,
    setChequeRelatedFormData: setChequeFormData,
    inventoryRelatedFormData: inventoryFormData,
    setInventoryRelatedFormData: setInventoryFormData,
    resetAllForms,
    loadEntryForEdit,
  } = formHook;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Save pending invoice data before submission
    const shouldCreateInvoice = createInvoice && formData.associatedParty && parseFloat(formData.amount) > 0;
    const invoiceData = shouldCreateInvoice ? {
      clientName: formData.associatedParty,
      amount: parseFloat(formData.amount),
    } : null;

    try {
      const success = await submitLedgerEntry(formData, editingEntry, {
        hasIncomingCheck,
        checkFormData,
        hasOutgoingCheck,
        outgoingCheckFormData,
        hasInventoryUpdate,
        inventoryFormData: inventoryFormDataNew,
        hasFixedAsset,
        fixedAssetFormData,
        hasInitialPayment,
        initialPaymentAmount,
      });

      if (success) {
        resetAllForms();
        setEditingEntry(null);
        setIsDialogOpen(false);
        setCreateInvoice(false);

        // Open invoice creation dialog if option was enabled
        if (invoiceData) {
          setPendingInvoiceData(invoiceData);
          setIsQuickInvoiceDialogOpen(true);
        }
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

  const handleEdit = (entry: LedgerEntry) => { setEditingEntry(entry); loadEntryForEdit(entry); setIsDialogOpen(true); };
  const handleDelete = (entry: LedgerEntry) => confirm("حذف الحركة المالية", "هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف جميع السجلات المرتبطة (مدفوعات، شيكات، حركات مخزون). لا يمكن التراجع عن هذا الإجراء.", async () => { await deleteLedgerEntry(entry, entries); }, "destructive");

  const openAddDialog = () => { resetAllForms(); setEditingEntry(null); setCreateInvoice(false); setIsDialogOpen(true); };
  const openRelatedDialog = (entry: LedgerEntry) => { setSelectedEntry(entry); setIsRelatedDialogOpen(true); };
  const openQuickPayDialog = (entry: LedgerEntry) => { setQuickPayEntry(entry); setIsQuickPayDialogOpen(true); };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    setLoading(true);
    const success = await addPaymentToEntry(selectedEntry, paymentFormData);
    if (success) { setPaymentFormData(initialPaymentFormData); setIsRelatedDialogOpen(false); }
    setLoading(false);
  };

  const handleAddCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    setLoading(true);
    const success = await addChequeToEntry(selectedEntry, chequeFormData);
    if (success) { setChequeFormData(initialChequeRelatedFormData); setIsRelatedDialogOpen(false); }
    setLoading(false);
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEntry) return;
    setLoading(true);
    const success = await addInventoryToEntry(selectedEntry, inventoryFormData);
    if (success) { setInventoryFormData(initialInventoryRelatedFormData); setIsRelatedDialogOpen(false); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">دفتر الأستاذ</h1>
          <p className="text-gray-600 mt-2">تسجيل جميع الحركات المالية</p>
        </div>
        <Button className="gap-2" onClick={openAddDialog}>
          <Plus className="w-4 h-4" />
          إضافة حركة مالية
        </Button>
      </div>

      {dataLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <LedgerStats entries={entries} />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>سجل الحركات المالية ({entries.length})</CardTitle>
            {entries.length > 0 && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportLedgerToExcel(entries, `الحركات_المالية_${new Date().toISOString().split('T')[0]}`)}
                >
                  <Download className="w-4 h-4 ml-2" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportLedgerToHTML(entries)}
                  title="طباعة باللغة العربية"
                >
                  <Download className="w-4 h-4 ml-2" />
                  PDF عربي
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportLedgerToPDF(entries, `الحركات_المالية_${new Date().toISOString().split('T')[0]}`)}
                >
                  <Download className="w-4 h-4 ml-2" />
                  PDF (EN)
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
            <TableSkeleton rows={10} />
          ) : (
            <LedgerTable
              entries={entries}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onQuickPay={openQuickPayDialog}
              onViewRelated={openRelatedDialog}
            />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">عرض {entries.length} من {totalCount} حركة</div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); if (currentPage < totalPages) setCurrentPage(currentPage + 1); }}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""} />
                  </PaginationItem>
                  {[...Array(Math.min(5, totalPages))].map((_, i) => (
                    <PaginationItem key={i + 1}>
                      <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(i + 1); }}
                        isActive={currentPage === i + 1}>{i + 1}</PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext href="#" onClick={(e) => { e.preventDefault(); if (currentPage > 1) setCurrentPage(currentPage - 1); }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      <LedgerFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        editingEntry={editingEntry}
        onSubmit={handleSubmit}
        loading={loading}
        clients={clients}
        partners={partners}
        formData={formData}
        setFormData={setFormData}
        hasIncomingCheck={hasIncomingCheck}
        setHasIncomingCheck={setHasIncomingCheck}
        hasOutgoingCheck={hasOutgoingCheck}
        setHasOutgoingCheck={setHasOutgoingCheck}
        hasInventoryUpdate={hasInventoryUpdate}
        setHasInventoryUpdate={setHasInventoryUpdate}
        hasFixedAsset={hasFixedAsset}
        setHasFixedAsset={setHasFixedAsset}
        hasInitialPayment={hasInitialPayment}
        setHasInitialPayment={setHasInitialPayment}
        initialPaymentAmount={initialPaymentAmount}
        setInitialPaymentAmount={setInitialPaymentAmount}
        checkFormData={checkFormData}
        setCheckFormData={setCheckFormData}
        outgoingCheckFormData={outgoingCheckFormData}
        setOutgoingCheckFormData={setOutgoingCheckFormData}
        inventoryFormData={inventoryFormDataNew}
        setInventoryFormData={setInventoryFormDataNew}
        fixedAssetFormData={fixedAssetFormData}
        setFixedAssetFormData={setFixedAssetFormData}
        createInvoice={createInvoice}
        setCreateInvoice={setCreateInvoice}
      />

      {/* Related Records Management Dialog */}
      <RelatedRecordsDialog
        isOpen={isRelatedDialogOpen}
        onClose={() => setIsRelatedDialogOpen(false)}
        selectedEntry={selectedEntry}
        relatedTab={relatedTab}
        setRelatedTab={setRelatedTab}
        loading={loading}
        onAddPayment={handleAddPayment}
        onAddCheque={handleAddCheque}
        onAddInventory={handleAddInventory}
        paymentFormData={paymentFormData}
        setPaymentFormData={setPaymentFormData}
        chequeFormData={chequeFormData}
        setChequeFormData={setChequeFormData}
        inventoryFormData={inventoryFormData}
        setInventoryFormData={setInventoryFormData}
      />

      {/* Quick Payment Dialog */}
      <QuickPayDialog
        isOpen={isQuickPayDialogOpen}
        onClose={() => setIsQuickPayDialogOpen(false)}
        entry={quickPayEntry}
        onSuccess={() => {
          // Data will refresh automatically via onSnapshot in useLedgerData
          setIsQuickPayDialogOpen(false);
          setQuickPayEntry(null);
        }}
      />

      {/* Quick Invoice Creation Dialog */}
      <QuickInvoiceDialog
        isOpen={isQuickInvoiceDialogOpen}
        onClose={() => {
          setIsQuickInvoiceDialogOpen(false);
          setPendingInvoiceData(null);
        }}
        pendingData={pendingInvoiceData}
      />

      {confirmationDialog}
    </div>
  );
}
