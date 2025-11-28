"use client";

import { useReducer } from "react";
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
  initialInventoryRelatedFormData,
} from "./types/ledger";
import { useLedgerData } from "./hooks/useLedgerData";
import { useLedgerForm } from "./hooks/useLedgerForm";
import { useLedgerOperations } from "./hooks/useLedgerOperations";

// Reducer
import { ledgerPageReducer, initialLedgerPageState } from "./reducers/ledgerPageReducer";

// Components
import { QuickPayDialog } from "./components/QuickPayDialog";
import { LedgerStats } from "./components/LedgerStats";
import { LedgerTable } from "./components/LedgerTable";
import { LedgerFormDialog } from "./components/LedgerFormDialog";
import { RelatedRecordsDialog } from "./components/RelatedRecordsDialog";
import { QuickInvoiceDialog } from "./components/QuickInvoiceDialog";

// Context
import { LedgerFormProvider, LedgerFormContextValue } from "./context/LedgerFormContext";

export default function LedgerPage() {
  const { toast } = useToast();
  const { confirm, dialog: confirmationDialog } = useConfirmation();

  // Consolidated state management
  const [state, dispatch] = useReducer(ledgerPageReducer, initialLedgerPageState);

  // Data and operations hooks
  const { entries, clients, partners, totalCount, totalPages, loading: dataLoading } = useLedgerData({
    pageSize: state.pagination.pageSize,
    currentPage: state.pagination.currentPage,
  });
  const { submitLedgerEntry, deleteLedgerEntry, addPaymentToEntry, addChequeToEntry, addInventoryToEntry } = useLedgerOperations();
  const formHook = useLedgerForm();

  // Related records forms (from original hook)
  const {
    paymentFormData,
    setPaymentFormData,
    chequeRelatedFormData: chequeFormData,
    setChequeRelatedFormData: setChequeFormData,
    inventoryRelatedFormData: inventoryFormData,
    setInventoryRelatedFormData: setInventoryFormData,
  } = formHook;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    dispatch({ type: "SET_LOADING", payload: true });

    // Save pending invoice data before submission
    const shouldCreateInvoice = state.ui.createInvoice && state.form.formData.associatedParty && parseFloat(state.form.formData.amount) > 0;
    const invoiceData = shouldCreateInvoice ? {
      clientName: state.form.formData.associatedParty,
      amount: parseFloat(state.form.formData.amount),
    } : null;

    try {
      const success = await submitLedgerEntry(state.form.formData, state.data.editingEntry, {
        hasIncomingCheck: state.form.hasIncomingCheck,
        checkFormData: state.form.checkFormData,
        hasOutgoingCheck: state.form.hasOutgoingCheck,
        outgoingCheckFormData: state.form.outgoingCheckFormData,
        hasInventoryUpdate: state.form.hasInventoryUpdate,
        inventoryFormData: state.form.inventoryFormData,
        hasFixedAsset: state.form.hasFixedAsset,
        fixedAssetFormData: state.form.fixedAssetFormData,
        hasInitialPayment: state.form.hasInitialPayment,
        initialPaymentAmount: state.form.initialPaymentAmount,
      });

      if (success) {
        dispatch({ type: "SUBMIT_SUCCESS", payload: invoiceData ?? undefined });
      }
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  };

  const handleEdit = (entry: LedgerEntry) => {
    dispatch({ type: "START_EDIT", payload: entry });
  };

  const handleDelete = (entry: LedgerEntry) => {
    confirm(
      "حذف الحركة المالية",
      "هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف جميع السجلات المرتبطة (مدفوعات، شيكات، حركات مخزون). لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await deleteLedgerEntry(entry, entries);
      },
      "destructive"
    );
  };

  const openAddDialog = () => dispatch({ type: "OPEN_ADD_DIALOG" });
  const openRelatedDialog = (entry: LedgerEntry) => dispatch({ type: "OPEN_RELATED_DIALOG", payload: entry });
  const openQuickPayDialog = (entry: LedgerEntry) => dispatch({ type: "OPEN_QUICK_PAY_DIALOG", payload: entry });

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.data.selectedEntry) return;
    dispatch({ type: "SET_LOADING", payload: true });
    const success = await addPaymentToEntry(state.data.selectedEntry, paymentFormData);
    if (success) {
      setPaymentFormData(initialPaymentFormData);
      dispatch({ type: "CLOSE_RELATED_DIALOG" });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  };

  const handleAddCheque = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.data.selectedEntry) return;
    dispatch({ type: "SET_LOADING", payload: true });
    const success = await addChequeToEntry(state.data.selectedEntry, chequeFormData);
    if (success) {
      setChequeFormData(initialChequeRelatedFormData);
      dispatch({ type: "CLOSE_RELATED_DIALOG" });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  };

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.data.selectedEntry) return;
    dispatch({ type: "SET_LOADING", payload: true });
    const success = await addInventoryToEntry(state.data.selectedEntry, inventoryFormData);
    if (success) {
      setInventoryFormData(initialInventoryRelatedFormData);
      dispatch({ type: "CLOSE_RELATED_DIALOG" });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  };

  // Context value for LedgerFormDialog - eliminates prop drilling
  const ledgerFormContextValue: LedgerFormContextValue = {
    isOpen: state.dialogs.form,
    onClose: () => dispatch({ type: "CLOSE_FORM_DIALOG" }),
    editingEntry: state.data.editingEntry,
    onSubmit: handleSubmit,
    loading: state.ui.loading,
    clients,
    partners,
    formData: state.form.formData,
    setFormData: (data) => dispatch({ type: "SET_FORM_DATA", payload: data }),
    hasIncomingCheck: state.form.hasIncomingCheck,
    setHasIncomingCheck: (value) => dispatch({ type: "SET_HAS_INCOMING_CHECK", payload: value }),
    hasOutgoingCheck: state.form.hasOutgoingCheck,
    setHasOutgoingCheck: (value) => dispatch({ type: "SET_HAS_OUTGOING_CHECK", payload: value }),
    hasInventoryUpdate: state.form.hasInventoryUpdate,
    setHasInventoryUpdate: (value) => dispatch({ type: "SET_HAS_INVENTORY_UPDATE", payload: value }),
    hasFixedAsset: state.form.hasFixedAsset,
    setHasFixedAsset: (value) => dispatch({ type: "SET_HAS_FIXED_ASSET", payload: value }),
    hasInitialPayment: state.form.hasInitialPayment,
    setHasInitialPayment: (value) => dispatch({ type: "SET_HAS_INITIAL_PAYMENT", payload: value }),
    initialPaymentAmount: state.form.initialPaymentAmount,
    setInitialPaymentAmount: (value) => dispatch({ type: "SET_INITIAL_PAYMENT_AMOUNT", payload: value }),
    checkFormData: state.form.checkFormData,
    setCheckFormData: (data) => dispatch({ type: "SET_CHECK_FORM_DATA", payload: data }),
    outgoingCheckFormData: state.form.outgoingCheckFormData,
    setOutgoingCheckFormData: (data) => dispatch({ type: "SET_OUTGOING_CHECK_FORM_DATA", payload: data }),
    inventoryFormData: state.form.inventoryFormData,
    setInventoryFormData: (data) => dispatch({ type: "SET_INVENTORY_FORM_DATA", payload: data }),
    fixedAssetFormData: state.form.fixedAssetFormData,
    setFixedAssetFormData: (data) => dispatch({ type: "SET_FIXED_ASSET_FORM_DATA", payload: data }),
    createInvoice: state.ui.createInvoice,
    setCreateInvoice: (value) => dispatch({ type: "SET_CREATE_INVOICE", payload: value }),
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
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (state.pagination.currentPage < totalPages) {
                          dispatch({ type: "SET_CURRENT_PAGE", payload: state.pagination.currentPage + 1 });
                        }
                      }}
                      className={state.pagination.currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  {[...Array(Math.min(5, totalPages))].map((_, i) => (
                    <PaginationItem key={i + 1}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          dispatch({ type: "SET_CURRENT_PAGE", payload: i + 1 });
                        }}
                        isActive={state.pagination.currentPage === i + 1}
                      >
                        {i + 1}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (state.pagination.currentPage > 1) {
                          dispatch({ type: "SET_CURRENT_PAGE", payload: state.pagination.currentPage - 1 });
                        }
                      }}
                      className={state.pagination.currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* LedgerFormDialog wrapped with context provider - no prop drilling! */}
      <LedgerFormProvider value={ledgerFormContextValue}>
        <LedgerFormDialog />
      </LedgerFormProvider>

      {/* Related Records Management Dialog */}
      <RelatedRecordsDialog
        isOpen={state.dialogs.related}
        onClose={() => dispatch({ type: "CLOSE_RELATED_DIALOG" })}
        selectedEntry={state.data.selectedEntry}
        relatedTab={state.ui.relatedTab}
        setRelatedTab={(tab) => dispatch({ type: "SET_RELATED_TAB", payload: tab })}
        loading={state.ui.loading}
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
        isOpen={state.dialogs.quickPay}
        onClose={() => dispatch({ type: "CLOSE_QUICK_PAY_DIALOG" })}
        entry={state.data.quickPayEntry}
        onSuccess={() => {
          // Data will refresh automatically via onSnapshot in useLedgerData
          dispatch({ type: "CLOSE_QUICK_PAY_DIALOG" });
        }}
      />

      {/* Quick Invoice Creation Dialog */}
      <QuickInvoiceDialog
        isOpen={state.dialogs.quickInvoice}
        onClose={() => dispatch({ type: "CLOSE_QUICK_INVOICE_DIALOG" })}
        pendingData={state.data.pendingInvoiceData}
      />

      {confirmationDialog}
    </div>
  );
}
