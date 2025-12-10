/**
 * LedgerFormDialog - Main form dialog for adding/editing ledger entries
 * Uses LedgerFormContext to eliminate prop drilling
 */

import { useState, useEffect, useRef } from "react";
import { CATEGORIES } from "../utils/ledger-constants";
import { getCategoryType } from "../utils/ledger-helpers";
import { useLedgerFormContext } from "../context/LedgerFormContext";
import { CheckFormDataItem, OutgoingCheckFormDataItem } from "../types/ledger";
import { useAllClients } from "@/hooks/useAllClients";
import { useInventoryItems } from "@/hooks/useInventoryItems";
import { cn } from "@/lib/utils";
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
import { Plus } from "lucide-react";
import { ChequeFormCard } from "../forms/ChequeFormCard";
import { InventoryFormCard } from "../forms/InventoryFormCard";
import { FixedAssetFormCard } from "../forms/FixedAssetFormCard";
import { StepBasicInfo } from "../steps/StepBasicInfo";
import { StepPartyARAP } from "../steps/StepPartyARAP";

export function LedgerFormDialog() {
  const {
    isOpen,
    onClose,
    editingEntry,
    onSubmit,
    loading,
    // clients - not used here, using allClients from useAllClients hook
    partners,
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
    // checkFormData - legacy, using incomingChequesList instead
    // outgoingCheckFormData - legacy, using outgoingChequesList instead
    incomingChequesList,
    setIncomingChequesList,
    outgoingChequesList,
    setOutgoingChequesList,
    inventoryFormData,
    setInventoryFormData,
    fixedAssetFormData,
    setFixedAssetFormData,
    createInvoice,
    setCreateInvoice,
  } = useLedgerFormContext();

  // Get all clients from ledger, partners, AND clients collection for dropdown
  const { clients: allClients, loading: clientsLoading } = useAllClients({ includeClientsCollection: true });

  // Get inventory items for dropdown
  const { items: inventoryItems, loading: inventoryLoading, error: inventoryError } = useInventoryItems();

  // Wizard step state (only for new entries)
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Ref to track intentional submit clicks (prevents auto-submit bugs)
  const intentionalSubmitRef = useRef(false);

  // Determine if step 3 is needed (related records)
  const hasRelatedRecords = hasIncomingCheck || hasOutgoingCheck ||
                            hasInventoryUpdate || hasFixedAsset || !!createInvoice;
  const totalSteps = !editingEntry ? (hasRelatedRecords ? 3 : 2) : 1;

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1); // Reset wizard to first step
      setStepError(null); // Clear any validation errors
    }
  }, [isOpen]);

  // Helper functions for multiple cheques management
  const addIncomingCheque = () => {
    const newCheque: CheckFormDataItem = {
      id: Date.now().toString(),
      chequeNumber: "",
      chequeAmount: "",
      bankName: "",
      dueDate: new Date().toISOString().split("T")[0],
      accountingType: "cashed",
      endorsedToName: "",
    };
    setIncomingChequesList([...incomingChequesList, newCheque]);
  };

  const updateIncomingCheque = (id: string, field: string, value: string) => {
    setIncomingChequesList(
      incomingChequesList.map((cheque) =>
        cheque.id === id ? { ...cheque, [field]: value } : cheque
      )
    );
  };

  const removeIncomingCheque = (id: string) => {
    setIncomingChequesList(incomingChequesList.filter((cheque) => cheque.id !== id));
  };

  const addOutgoingCheque = () => {
    const newCheque: OutgoingCheckFormDataItem = {
      id: Date.now().toString(),
      chequeNumber: "",
      chequeAmount: "",
      bankName: "",
      dueDate: new Date().toISOString().split("T")[0],
      accountingType: "cashed",
      endorsedFromName: "",
    };
    setOutgoingChequesList([...outgoingChequesList, newCheque]);
  };

  const updateOutgoingCheque = (id: string, field: string, value: string) => {
    setOutgoingChequesList(
      outgoingChequesList.map((cheque) =>
        cheque.id === id ? { ...cheque, [field]: value } : cheque
      )
    );
  };

  const removeOutgoingCheque = (id: string) => {
    setOutgoingChequesList(outgoingChequesList.filter((cheque) => cheque.id !== id));
  };

  const currentEntryType = getCategoryType(formData.category, formData.subCategory);

  // Validate current step before advancing
  const validateStep = (currentStep: number): boolean => {
    setStepError(null);

    if (currentStep === 1) {
      if (!formData.description?.trim()) {
        setStepError("الوصف مطلوب");
        return false;
      }
      if (!formData.category) {
        setStepError("التصنيف الرئيسي مطلوب");
        return false;
      }
      if (!formData.subCategory) {
        setStepError("الفئة الفرعية مطلوبة");
        return false;
      }
      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        setStepError("المبلغ مطلوب ويجب أن يكون أكبر من صفر");
        return false;
      }
      if (!formData.date) {
        setStepError("التاريخ مطلوب");
        return false;
      }
    }

    if (currentStep === 2) {
      // Owner is required for capital transactions
      if (formData.category === "رأس المال" && !formData.ownerName) {
        setStepError("اسم الشريك/المالك مطلوب لعمليات رأس المال");
        return false;
      }
    }

    return true;
  };

  // Handle next step with validation
  const handleNextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  // Handle intentional submit button click
  const handleSubmitClick = () => {
    intentionalSubmitRef.current = true;
  };

  // Guard against accidental form submission when not on final step
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault(); // Always prevent default first

    // Only allow submission if user intentionally clicked submit
    if (!intentionalSubmitRef.current) {
      return;
    }
    intentionalSubmitRef.current = false; // Reset for next time

    // For new entries, only allow submission on the final step
    if (!editingEntry && step < totalSteps) {
      return;
    }
    // Validate before submitting
    if (!editingEntry && !validateStep(step)) {
      return;
    }
    onSubmit(e);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingEntry ? "تعديل الحركة المالية" : "إضافة حركة مالية جديدة"}
          </DialogTitle>
          <DialogDescription>
            {editingEntry
              ? "قم بتعديل بيانات الحركة أدناه"
              : "أدخل بيانات الحركة المالية الجديدة أدناه"}
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress Indicator - Only for new entries */}
        {!editingEntry && (
          <div className="mb-4">
            {/* Step labels */}
            <div className="flex justify-between text-xs text-gray-500 mb-2">
              <span className={cn(step >= 1 && "text-primary font-medium")}>
                المعلومات الأساسية
              </span>
              <span className={cn(step >= 2 && "text-primary font-medium")}>
                الطرف والذمم
              </span>
              {hasRelatedRecords && (
                <span className={cn(step >= 3 && "text-primary font-medium")}>
                  السجلات المرتبطة
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="flex gap-2">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-2 flex-1 rounded transition-colors",
                    s <= step ? "bg-primary" : "bg-gray-200"
                  )}
                />
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleFormSubmit}>
          <div className="grid gap-4 py-4">
            {/* ===== STEP 1: Basic Info ===== */}
            {(step === 1 || editingEntry) && (
              <StepBasicInfo
                formData={formData}
                onUpdate={(updates) => setFormData({ ...formData, ...updates })}
                categories={CATEGORIES}
              />
            )}

            {/* ===== STEP 2: Party & AR/AP ===== */}
            {(step === 2 || editingEntry) && (
              <StepPartyARAP
                formData={formData}
                onUpdate={(updates) => setFormData({ ...formData, ...updates })}
                allClients={allClients}
                clientsLoading={clientsLoading}
                partners={partners}
                currentEntryType={currentEntryType}
                isEditMode={!!editingEntry}
                hasInitialPayment={hasInitialPayment}
                setHasInitialPayment={setHasInitialPayment}
                initialPaymentAmount={initialPaymentAmount}
                setInitialPaymentAmount={setInitialPaymentAmount}
                hasIncomingCheck={hasIncomingCheck}
                setHasIncomingCheck={setHasIncomingCheck}
                hasOutgoingCheck={hasOutgoingCheck}
                setHasOutgoingCheck={setHasOutgoingCheck}
                hasInventoryUpdate={hasInventoryUpdate}
                setHasInventoryUpdate={setHasInventoryUpdate}
                hasFixedAsset={hasFixedAsset}
                setHasFixedAsset={setHasFixedAsset}
                createInvoice={createInvoice || false}
                setCreateInvoice={setCreateInvoice}
                onAddIncomingCheque={addIncomingCheque}
                onAddOutgoingCheque={addOutgoingCheque}
                incomingChequesCount={incomingChequesList.length}
                outgoingChequesCount={outgoingChequesList.length}
                hasRelatedRecords={hasRelatedRecords}
              />
            )}

            {/* ===== STEP 3: Related Records Details ===== */}
            {step === 3 && !editingEntry && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm">تفاصيل السجلات المرتبطة</h3>

                {/* Incoming Cheques Details */}
                {hasIncomingCheck && (currentEntryType === "دخل" || currentEntryType === "إيراد") && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">شيكات واردة</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addIncomingCheque}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        إضافة شيك آخر
                      </Button>
                    </div>

                    {incomingChequesList.length > 0 && (
                      <div className="space-y-4">
                        {incomingChequesList.map((cheque, index) => (
                          <ChequeFormCard
                            key={cheque.id}
                            cheque={cheque}
                            index={index}
                            direction="incoming"
                            onUpdate={updateIncomingCheque}
                            onRemove={removeIncomingCheque}
                            canRemove={incomingChequesList.length > 1}
                          />
                        ))}

                        {/* Total cheques amount */}
                        {incomingChequesList.length > 1 && (
                          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                            <p className="text-sm font-medium text-blue-700">
                              مجموع الشيكات: {incomingChequesList.reduce((sum, c) => sum + (parseFloat(c.chequeAmount) || 0), 0).toFixed(2)} دينار
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Outgoing Cheques Details */}
                {hasOutgoingCheck && currentEntryType === "مصروف" && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">شيكات صادرة</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addOutgoingCheque}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        إضافة شيك آخر
                      </Button>
                    </div>

                    {outgoingChequesList.length > 0 && (
                      <div className="space-y-4">
                        {outgoingChequesList.map((cheque, index) => (
                          <ChequeFormCard
                            key={cheque.id}
                            cheque={cheque}
                            index={index}
                            direction="outgoing"
                            onUpdate={updateOutgoingCheque}
                            onRemove={removeOutgoingCheque}
                            canRemove={outgoingChequesList.length > 1}
                          />
                        ))}

                        {/* Total cheques amount */}
                        {outgoingChequesList.length > 1 && (
                          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                            <p className="text-sm font-medium text-blue-700">
                              مجموع الشيكات: {outgoingChequesList.reduce((sum, c) => sum + (parseFloat(c.chequeAmount) || 0), 0).toFixed(2)} دينار
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Inventory Update Details */}
                {hasInventoryUpdate && (
                  <InventoryFormCard
                    formData={inventoryFormData}
                    onUpdate={(field, value) =>
                      setInventoryFormData({ ...inventoryFormData, [field]: value })
                    }
                    onItemSelect={(itemId, itemName, unit) =>
                      setInventoryFormData({
                        ...inventoryFormData,
                        itemId,
                        itemName,
                        unit: unit || inventoryFormData.unit,
                      })
                    }
                    inventoryItems={inventoryItems}
                    isLoadingItems={inventoryLoading}
                    error={inventoryError}
                  />
                )}

                {/* Fixed Asset Details */}
                {hasFixedAsset && currentEntryType === "مصروف" && formData.category === "أصول ثابتة" && (
                  <FixedAssetFormCard
                    formData={fixedAssetFormData}
                    onUpdate={(field, value) =>
                      setFixedAssetFormData({ ...fixedAssetFormData, [field]: value })
                    }
                    entryAmount={formData.amount}
                  />
                )}

                {/* Create Invoice Info */}
                {createInvoice && currentEntryType === "دخل" && formData.associatedParty && (
                  <div className="p-4 bg-blue-50 rounded-md border border-blue-200">
                    <h4 className="font-medium text-sm mb-2">إنشاء فاتورة</h4>
                    <p className="text-xs text-blue-700">
                      سيتم فتح نموذج إنشاء فاتورة جديدة للعميل &quot;{formData.associatedParty}&quot; بعد حفظ هذه الحركة.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Validation Error Message */}
          {stepError && (
            <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{stepError}</p>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            {/* Previous button - only for wizard mode, step > 1 */}
            {!editingEntry && step > 1 ? (
              <Button type="button" variant="outline" onClick={() => { setStepError(null); setStep(step - 1); }}>
                السابق
              </Button>
            ) : (
              <div /> /* Spacer for alignment */
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                إلغاء
              </Button>

              {/* For editing: show save button */}
              {editingEntry ? (
                <Button type="submit" disabled={loading} onClick={handleSubmitClick}>
                  {loading ? "جاري الحفظ..." : "تحديث"}
                </Button>
              ) : (
                /* For new entries: show next or save based on step */
                step < totalSteps ? (
                  <Button type="button" onClick={handleNextStep}>
                    التالي
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading} onClick={handleSubmitClick}>
                    {loading ? "جاري الحفظ..." : "إضافة"}
                  </Button>
                )
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
