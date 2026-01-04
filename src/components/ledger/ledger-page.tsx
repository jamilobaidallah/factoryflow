"use client";

import { useReducer, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { useUser } from "@/firebase/provider";
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

// Core components (loaded immediately)
import { LedgerStats } from "./components/LedgerStats";
import { LedgerTable } from "./components/LedgerTable";

// Lazy-loaded components (dialogs - only loaded when needed)
const LedgerFormDialog = dynamic(() => import("./components/LedgerFormDialog").then(m => ({ default: m.LedgerFormDialog })), { ssr: false });
const RelatedRecordsDialog = dynamic(() => import("./components/RelatedRecordsDialog").then(m => ({ default: m.RelatedRecordsDialog })), { ssr: false });
const QuickPayDialog = dynamic(() => import("./components/QuickPayDialog").then(m => ({ default: m.QuickPayDialog })), { ssr: false });
const WriteOffDialog = dynamic(() => import("./components/WriteOffDialog").then(m => ({ default: m.WriteOffDialog })), { ssr: false });
const QuickInvoiceDialog = dynamic(() => import("./components/QuickInvoiceDialog").then(m => ({ default: m.QuickInvoiceDialog })), { ssr: false });
const AdvanceAllocationDialog = dynamic(() => import("./components/AdvanceAllocationDialog").then(m => ({ default: m.AdvanceAllocationDialog })), { ssr: false });

// Context
import { LedgerFormProvider, LedgerFormContextValue } from "./context/LedgerFormContext";

// Filters
import {
  useLedgerFilters,
  LedgerFilters,
  PaymentStatus,
  EntryType,
  ViewMode,
} from "./filters";
import { isEquityTransaction, getCategoryType } from "./utils/ledger-helpers";
import { useAvailableAdvances, getAdvanceTypeForEntry } from "./hooks/useAvailableAdvances";
import type { AdvanceAllocationResult } from "./components/AdvanceAllocationDialog";

// Lazy load export utilities (only needed when user exports)
const loadExportUtils = () => import("@/lib/export-utils");
const loadExportExcel = () => import("@/lib/export-ledger-excel");
const loadLedgerService = () => import("@/services/ledgerService");

export default function LedgerPage() {
  const { toast } = useToast();
  const { user } = useUser();
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const searchParams = useSearchParams();

  // Read URL params for initial filter state
  const urlPaymentStatus = searchParams.get("paymentStatus") as PaymentStatus | null;
  const urlType = searchParams.get("type");
  const urlCategory = searchParams.get("category");
  const urlSubcategory = searchParams.get("subcategory");
  const urlSearch = searchParams.get("search");

  // Map URL type param to EntryType
  const initialEntryType: EntryType | undefined = urlType === "income" ? "دخل" : urlType === "expense" ? "مصروف" : undefined;

  // Map URL paymentStatus to ViewMode
  const initialViewMode: ViewMode | undefined =
    urlPaymentStatus === "unpaid" || urlPaymentStatus === "partial" || urlPaymentStatus === "outstanding"
      ? "unpaid"
      : urlType === "income"
      ? "income"
      : urlType === "expense"
      ? "expense"
      : undefined;

  // Consolidated state management
  const [state, dispatch] = useReducer(ledgerPageReducer, initialLedgerPageState);

  // Data and operations hooks
  // Separate loading states: dataLoading for table (fast), statsLoading for stats cards (slower)
  const { entries, allEntriesForStats, clients, partners, totalCount, totalPages, loading: dataLoading, statsLoading } = useLedgerData({
    pageSize: state.pagination.pageSize,
    currentPage: state.pagination.currentPage,
  });
  const { submitLedgerEntry, deleteLedgerEntry, addPaymentToEntry, addChequeToEntry, addInventoryToEntry } = useLedgerOperations();
  const formHook = useLedgerForm();

  // Determine the current entry type based on selected category
  const currentEntryType = getCategoryType(state.form.formData.category, state.form.formData.subCategory);
  const advanceType = getAdvanceTypeForEntry(currentEntryType);

  // Query available advances for the associated party (only when creating income/expense entries)
  const {
    advances: availableAdvances,
    totalAvailable: totalAdvancesAvailable,
    loading: advancesLoading,
    refetch: refetchAdvances,
  } = useAvailableAdvances(
    // Only fetch when we have a party name and the entry type supports advances
    advanceType && state.form.formData.associatedParty ? state.form.formData.associatedParty : null,
    advanceType || "customer"
  );

  // Filters - initialize from URL params if present
  const {
    filters,
    setDatePreset,
    setEntryType,
    setCategory,
    setSubCategory,
    setPaymentStatus,
    setSearch,
    setViewMode,
    clearFilters,
    hasActiveFilters,
    filterEntries,
    calculateTotals,
  } = useLedgerFilters({
    initialPaymentStatus: urlPaymentStatus || undefined,
    initialEntryType: initialEntryType,
    initialCategory: urlCategory || undefined,
    initialSubCategory: urlSubcategory || undefined,
    initialViewMode: initialViewMode,
    initialSearch: urlSearch || undefined,
  });

  // Apply filters to entries
  // When filters are active, search ALL entries (allEntriesForStats)
  // When no filters, show paginated entries for performance
  const filteredEntries = useMemo(() => {
    if (hasActiveFilters) {
      return filterEntries(allEntriesForStats);
    }
    return filterEntries(entries);
  }, [filterEntries, entries, allEntriesForStats, hasActiveFilters]);

  // Calculate totals for filtered entries
  const filteredTotals = useMemo(() => calculateTotals(filteredEntries), [calculateTotals, filteredEntries]);

  // Calculate unpaid count for stats and filter tabs (from all entries, not just current page)
  // Exclude equity/capital transactions - they don't have AR/AP
  const unpaidCount = useMemo(() => {
    return allEntriesForStats.filter(
      (e) => e.isARAPEntry &&
             e.paymentStatus !== "paid" &&
             !isEquityTransaction(e.type, e.category)
    ).length;
  }, [allEntriesForStats]);

  // Related records forms (from original hook)
  const {
    paymentFormData,
    setPaymentFormData,
    chequeRelatedFormData: chequeFormData,
    setChequeRelatedFormData: setChequeFormData,
    inventoryRelatedFormData: inventoryFormData,
    setInventoryRelatedFormData: setInventoryFormData,
  } = formHook;

  // Export handlers - fetch ALL entries, not just current page
  // Uses lazy-loaded modules to reduce initial bundle size
  const handleExportExcel = useCallback(async () => {
    if (!user) return;
    try {
      const [{ createLedgerService }, { exportLedgerToExcelProfessional }] = await Promise.all([
        loadLedgerService(),
        loadExportExcel(),
      ]);
      const service = createLedgerService(user.dataOwnerId);
      const allEntries = await service.getAllLedgerEntries();
      // Apply current filters to all entries
      const filteredAllEntries = filterEntries(allEntries);
      exportLedgerToExcelProfessional(filteredAllEntries);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: "خطأ في التصدير",
        description: appError.message,
        variant: "destructive",
      });
    }
  }, [user, filterEntries, toast]);

  const handleExportPDF = useCallback(async () => {
    if (!user) return;
    try {
      const [{ createLedgerService }, { exportLedgerToHTML }] = await Promise.all([
        loadLedgerService(),
        loadExportUtils(),
      ]);
      const service = createLedgerService(user.dataOwnerId);
      const allEntries = await service.getAllLedgerEntries();
      // Apply current filters to all entries
      const filteredAllEntries = filterEntries(allEntries);
      exportLedgerToHTML(filteredAllEntries);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: "خطأ في التصدير",
        description: appError.message,
        variant: "destructive",
      });
    }
  }, [user, filterEntries, toast]);

  // Handle unpaid card click - set view mode to unpaid
  const handleUnpaidClick = useCallback(() => {
    setViewMode("unpaid");
  }, [setViewMode]);

  // Perform the actual ledger entry submission (after advance allocation check)
  const performActualSubmit = useCallback(async (allocations: AdvanceAllocationResult[] = []) => {
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
        // Multiple cheques support
        incomingChequesList: state.form.incomingChequesList,
        outgoingChequesList: state.form.outgoingChequesList,
        hasInventoryUpdate: state.form.hasInventoryUpdate,
        inventoryFormData: state.form.inventoryFormData,
        hasFixedAsset: state.form.hasFixedAsset,
        fixedAssetFormData: state.form.fixedAssetFormData,
        hasInitialPayment: state.form.hasInitialPayment,
        initialPaymentAmount: state.form.initialPaymentAmount,
        // Advance allocation data
        advanceAllocations: allocations.length > 0 ? allocations : undefined,
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
  }, [state.ui.createInvoice, state.form, state.data.editingEntry, submitLedgerEntry, toast]);

  // Handle form submission - checks for available advances first
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if this is a new entry (not editing) with a party that has available advances
    const isNewEntry = !state.data.editingEntry;
    const hasParty = !!state.form.formData.associatedParty;
    const hasAdvances = totalAdvancesAvailable > 0 && availableAdvances.length > 0;
    const supportsAdvances = advanceType !== null;

    // If conditions are met, show advance allocation dialog
    if (isNewEntry && hasParty && hasAdvances && supportsAdvances && !advancesLoading) {
      dispatch({ type: "OPEN_ADVANCE_ALLOCATION_DIALOG" });
      return;
    }

    // Otherwise, proceed with normal submission
    await performActualSubmit([]);
  }, [state.data.editingEntry, state.form.formData.associatedParty, totalAdvancesAvailable, availableAdvances.length, advanceType, advancesLoading, performActualSubmit]);

  // Handle advance allocation confirmation
  const handleAdvanceAllocationConfirm = useCallback(async (allocations: AdvanceAllocationResult[]) => {
    dispatch({ type: "SET_ADVANCE_ALLOCATIONS", payload: allocations });
    dispatch({ type: "CLOSE_ADVANCE_ALLOCATION_DIALOG" });
    await performActualSubmit(allocations);
  }, [performActualSubmit]);

  // Handle advance allocation skip (proceed without applying advances)
  const handleAdvanceAllocationSkip = useCallback(async () => {
    dispatch({ type: "CLOSE_ADVANCE_ALLOCATION_DIALOG" });
    await performActualSubmit([]);
  }, [performActualSubmit]);

  const handleEdit = useCallback((entry: LedgerEntry) => {
    dispatch({ type: "START_EDIT", payload: entry });
  }, []);

  const handleDelete = useCallback((entry: LedgerEntry) => {
    confirm(
      "حذف الحركة المالية",
      "هل أنت متأكد من حذف هذه الحركة؟ سيتم حذف جميع السجلات المرتبطة (مدفوعات، شيكات، حركات مخزون). لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        await deleteLedgerEntry(entry, entries);
      },
      "destructive"
    );
  }, [confirm, deleteLedgerEntry, entries]);

  const openAddDialog = useCallback(() => dispatch({ type: "OPEN_ADD_DIALOG" }), []);
  const openRelatedDialog = useCallback((entry: LedgerEntry) => dispatch({ type: "OPEN_RELATED_DIALOG", payload: entry }), []);
  const openQuickPayDialog = useCallback((entry: LedgerEntry) => dispatch({ type: "OPEN_QUICK_PAY_DIALOG", payload: entry }), []);
  const openWriteOffDialog = useCallback((entry: LedgerEntry) => dispatch({ type: "OPEN_WRITE_OFF_DIALOG", payload: entry }), []);

  const handleAddPayment = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.data.selectedEntry) return;
    dispatch({ type: "SET_LOADING", payload: true });
    const success = await addPaymentToEntry(state.data.selectedEntry, paymentFormData);
    if (success) {
      setPaymentFormData(initialPaymentFormData);
      dispatch({ type: "CLOSE_RELATED_DIALOG" });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  }, [state.data.selectedEntry, addPaymentToEntry, paymentFormData, setPaymentFormData]);

  const handleAddCheque = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.data.selectedEntry) return;
    dispatch({ type: "SET_LOADING", payload: true });
    const success = await addChequeToEntry(state.data.selectedEntry, chequeFormData);
    if (success) {
      setChequeFormData(initialChequeRelatedFormData);
      dispatch({ type: "CLOSE_RELATED_DIALOG" });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  }, [state.data.selectedEntry, addChequeToEntry, chequeFormData, setChequeFormData]);

  const handleAddInventory = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!state.data.selectedEntry) return;
    dispatch({ type: "SET_LOADING", payload: true });
    const success = await addInventoryToEntry(state.data.selectedEntry, inventoryFormData);
    if (success) {
      setInventoryFormData(initialInventoryRelatedFormData);
      dispatch({ type: "CLOSE_RELATED_DIALOG" });
    }
    dispatch({ type: "SET_LOADING", payload: false });
  }, [state.data.selectedEntry, addInventoryToEntry, inventoryFormData, setInventoryFormData]);

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
    incomingChequesList: state.form.incomingChequesList,
    setIncomingChequesList: (data) => dispatch({ type: "SET_INCOMING_CHEQUES_LIST", payload: data }),
    outgoingChequesList: state.form.outgoingChequesList,
    setOutgoingChequesList: (data) => dispatch({ type: "SET_OUTGOING_CHEQUES_LIST", payload: data }),
    inventoryFormData: state.form.inventoryFormData,
    setInventoryFormData: (data) => dispatch({ type: "SET_INVENTORY_FORM_DATA", payload: data }),
    fixedAssetFormData: state.form.fixedAssetFormData,
    setFixedAssetFormData: (data) => dispatch({ type: "SET_FIXED_ASSET_FORM_DATA", payload: data }),
    createInvoice: state.ui.createInvoice,
    setCreateInvoice: (value) => dispatch({ type: "SET_CREATE_INVOICE", payload: value }),
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">دفتر الأستاذ</h1>
          <p className="text-slate-500 text-sm mt-1">تسجيل وإدارة جميع الحركات المالية</p>
        </div>
        <PermissionGate action="create" module="ledger">
          <Button
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
            onClick={openAddDialog}
          >
            <Plus className="w-5 h-5" />
            إضافة حركة مالية
          </Button>
        </PermissionGate>
      </div>

      {/* Summary Cards - uses statsLoading to load independently from table */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <LedgerStats entries={allEntriesForStats} onUnpaidClick={handleUnpaidClick} />
      )}

      {/* Filters */}
      {!dataLoading && (
        <LedgerFilters
          filters={filters}
          onDatePresetChange={setDatePreset}
          onEntryTypeChange={setEntryType}
          onCategoryChange={setCategory}
          onSubCategoryChange={setSubCategory}
          onSearchChange={setSearch}
          onViewModeChange={setViewMode}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          entries={entries}
          filteredEntries={filteredEntries}
          filteredTotals={filteredTotals}
          unpaidCount={unpaidCount}
          onExportExcel={handleExportExcel}
          onExportPDF={handleExportPDF}
        />
      )}

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {dataLoading ? (
          <div className="p-6">
            <TableSkeleton rows={10} />
          </div>
        ) : (
          <>
            <LedgerTable
              entries={filteredEntries}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onQuickPay={openQuickPayDialog}
              onWriteOff={openWriteOffDialog}
              onViewRelated={openRelatedDialog}
              highlightedSubcategory={filters.subCategory}
              onClearFilters={clearFilters}
              isFiltered={hasActiveFilters}
            />

            {/* Pagination - hidden when filters are active (showing all filtered results) */}
            {!hasActiveFilters && totalPages > 1 && filteredEntries.length > 0 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  عرض {filteredEntries.length} من {totalCount} حركة
                </p>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
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
                          if (state.pagination.currentPage < totalPages) {
                            dispatch({ type: "SET_CURRENT_PAGE", payload: state.pagination.currentPage + 1 });
                          }
                        }}
                        className={state.pagination.currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            {/* Filter results count - shown when filters are active */}
            {hasActiveFilters && filteredEntries.length > 0 && (
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
                <p className="text-sm text-slate-500">
                  نتائج البحث: {filteredEntries.length} حركة من إجمالي {allEntriesForStats.length}
                </p>
              </div>
            )}
          </>
        )}
      </div>

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

      {/* Bad Debt Write-Off Dialog */}
      <WriteOffDialog
        isOpen={state.dialogs.writeOff}
        onClose={() => dispatch({ type: "CLOSE_WRITE_OFF_DIALOG" })}
        entry={state.data.writeOffEntry}
        onSuccess={() => {
          // Data will refresh automatically via onSnapshot in useLedgerData
          dispatch({ type: "CLOSE_WRITE_OFF_DIALOG" });
        }}
      />

      {/* Quick Invoice Creation Dialog */}
      <QuickInvoiceDialog
        isOpen={state.dialogs.quickInvoice}
        onClose={() => dispatch({ type: "CLOSE_QUICK_INVOICE_DIALOG" })}
        pendingData={state.data.pendingInvoiceData}
      />

      {/* Advance Allocation Dialog - shown when creating invoice for party with available advances */}
      <AdvanceAllocationDialog
        isOpen={state.dialogs.advanceAllocation}
        onClose={() => dispatch({ type: "CLOSE_ADVANCE_ALLOCATION_DIALOG" })}
        onConfirm={handleAdvanceAllocationConfirm}
        onSkip={handleAdvanceAllocationSkip}
        advances={availableAdvances}
        invoiceAmount={parseFloat(state.form.formData.amount) || 0}
        partyName={state.form.formData.associatedParty}
        isCustomer={advanceType === "customer"}
      />

      {confirmationDialog}
    </div>
  );
}
