/**
 * LedgerFormDialog - Main form dialog for adding/editing ledger entries
 * Uses LedgerFormContext to eliminate prop drilling
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { CATEGORIES } from "../utils/ledger-constants";
import { getCategoryType } from "../utils/ledger-helpers";
import { useLedgerFormContext } from "../context/LedgerFormContext";
import { CheckFormDataItem, OutgoingCheckFormDataItem } from "../types/ledger";
import { useAllClients } from "@/hooks/useAllClients";
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
import { Plus, Trash2, ChevronDown } from "lucide-react";

export function LedgerFormDialog() {
  const {
    isOpen,
    onClose,
    editingEntry,
    onSubmit,
    loading,
    clients,
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
    checkFormData,
    setCheckFormData,
    outgoingCheckFormData,
    setOutgoingCheckFormData,
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

  // Associated party dropdown state
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Wizard step state (only for new entries)
  const [step, setStep] = useState(1);
  const [stepError, setStepError] = useState<string | null>(null);

  // Ref to track intentional submit clicks (prevents auto-submit bugs)
  const intentionalSubmitRef = useRef(false);

  // Determine if step 3 is needed (related records)
  const hasRelatedRecords = hasIncomingCheck || hasOutgoingCheck ||
                            hasInventoryUpdate || hasFixedAsset || createInvoice;
  const totalSteps = !editingEntry ? (hasRelatedRecords ? 3 : 2) : 1;

  // Filter clients based on search input
  const filteredClients = useMemo(() => {
    if (!formData.associatedParty?.trim()) {
      return allClients;
    }
    const searchTerm = formData.associatedParty.toLowerCase();
    return allClients.filter((client) =>
      client.name.toLowerCase().includes(searchTerm)
    );
  }, [allClients, formData.associatedParty]);

  const handlePartySelect = (partyName: string) => {
    setFormData({ ...formData, associatedParty: partyName });
    setShowPartyDropdown(false);
  };

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowPartyDropdown(false);
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

  const updateIncomingCheque = (id: string, field: keyof CheckFormDataItem, value: string) => {
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

  const updateOutgoingCheque = (id: string, field: keyof OutgoingCheckFormDataItem, value: string) => {
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
              <>
                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    required
                  />
                </div>

                {/* Category & Subcategory */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">التصنيف الرئيسي</Label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value, subCategory: "" })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                    >
                      <option value="">اختر التصنيف</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.name} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subCategory">الفئة الفرعية</Label>
                    <select
                      id="subCategory"
                      value={formData.subCategory}
                      onChange={(e) =>
                        setFormData({ ...formData, subCategory: e.target.value })
                      }
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      required
                      disabled={!formData.category}
                    >
                      <option value="">اختر الفئة الفرعية</option>
                      {formData.category && CATEGORIES
                        .find(cat => cat.name === formData.category)
                        ?.subcategories.map((sub) => (
                          <option key={sub} value={sub}>{sub}</option>
                        ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* ===== STEP 2: Party & AR/AP ===== */}
            {(step === 2 || editingEntry) && (
              <>
                {/* Associated Party */}
            <div className="space-y-2 relative">
              <Label htmlFor="associatedParty">الطرف المعني (العميل/المورد) - اختياري</Label>
              <div className="relative">
                <Input
                  id="associatedParty"
                  value={formData.associatedParty}
                  onChange={(e) => {
                    setFormData({ ...formData, associatedParty: e.target.value });
                    setShowPartyDropdown(true);
                  }}
                  onFocus={() => setShowPartyDropdown(true)}
                  placeholder={clientsLoading ? "جاري التحميل..." : "اختر أو ابحث... (اتركه فارغاً للمصاريف اليومية)"}
                  autoComplete="off"
                />
                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              {showPartyDropdown && !clientsLoading && (
                <div className="absolute z-[100] w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {/* Option to clear/leave empty */}
                  {formData.associatedParty && (
                    <button
                      type="button"
                      onClick={() => handlePartySelect("")}
                      className="w-full px-3 py-2 text-right text-sm border-b hover:bg-gray-100 text-gray-500"
                    >
                      × مسح الاختيار (بدون طرف معني)
                    </button>
                  )}
                  {filteredClients.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                      {allClients.length === 0 ? "لا يوجد عملاء مسجلين في الدفتر" : "لا توجد نتائج"}
                    </div>
                  ) : (
                    filteredClients.map((client) => (
                      <button
                        key={client.name}
                        type="button"
                        onClick={() => handlePartySelect(client.name)}
                        className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span>{client.name}</span>
                        <div className="flex items-center gap-1">
                          {client.hasBalance && client.balance !== 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              client.balance && client.balance > 0
                                ? 'bg-red-100 text-red-700' // They owe us (receivable)
                                : 'bg-green-100 text-green-700' // We owe them (payable)
                            }`}>
                              {client.balance && client.balance > 0 ? 'له علينا: ' : 'لنا عليه: '}
                              {Math.abs(client.balance || 0).toFixed(2)}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {client.source === 'ledger' ? 'دفتر' : client.source === 'partner' ? 'شريك' : client.source === 'client' ? 'عميل' : 'متعدد'}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                  {/* Option to add new party manually */}
                  {formData.associatedParty?.trim() && !allClients.some(c => c.name === formData.associatedParty?.trim()) && (
                    <button
                      type="button"
                      onClick={() => setShowPartyDropdown(false)}
                      className="w-full px-3 py-2 text-right text-sm border-t hover:bg-blue-50 text-blue-600"
                    >
                      + استخدام &quot;{formData.associatedParty}&quot; كاسم جديد
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500">
                اترك هذا الحقل فارغاً للمصاريف اليومية التي لا تحتاج طرف معني
              </p>
            </div>

            {/* Owner dropdown for capital transactions */}
            {formData.category === "رأس المال" && (
              <div className="space-y-2">
                <Label htmlFor="ownerName">اسم الشريك/المالك *</Label>
                <select
                  id="ownerName"
                  value={formData.ownerName}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerName: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">اختر الشريك</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.name}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
              </>
            )}

            {/* Amount & Date - Part of Step 1 */}
            {(step === 1 || editingEntry) && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amount">المبلغ (دينار)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date">التاريخ</Label>
                    <Input
                      id="date"
                      type="date"
                      value={formData.date}
                      onChange={(e) =>
                        setFormData({ ...formData, date: e.target.value })
                      }
                      required
                    />
                  </div>
                </div>

                {/* Reference & Notes */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reference">رقم المرجع (اختياري)</Label>
                    <Input
                      id="reference"
                      value={formData.reference}
                      onChange={(e) =>
                        setFormData({ ...formData, reference: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData({ ...formData, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
              </>
            )}

            {/* AR/AP Tracking - Part of Step 2 (new entries only) */}
            {step === 2 && !editingEntry && (currentEntryType === "دخل" || currentEntryType === "مصروف") && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id="trackARAP"
                    checked={formData.trackARAP}
                    onChange={(e) =>
                      setFormData({ ...formData, trackARAP: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="trackARAP" className="cursor-pointer">
                    تتبع الذمم (حسابات القبض/الدفع)
                  </Label>
                </div>

                {formData.trackARAP && (
                  <div className="space-y-4 pr-6">
                    {/* Immediate Settlement Option */}
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input type="checkbox"
                        id="immediateSettlement"
                        checked={formData.immediateSettlement}
                        onChange={(e) =>
                          setFormData({ ...formData, immediateSettlement: e.target.checked })
                        }
                      />
                      <Label htmlFor="immediateSettlement" className="cursor-pointer">
                        تسوية فورية (نقدي)
                      </Label>
                    </div>

                    {/* Initial Payment Option (only if not immediate settlement) */}
                    {!formData.immediateSettlement && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <input type="checkbox"
                            id="hasInitialPayment"
                            checked={hasInitialPayment}
                            onChange={(e) =>
                              setHasInitialPayment(e.target.checked)
                            }
                          />
                          <Label htmlFor="hasInitialPayment" className="cursor-pointer">
                            دفعة أولية
                          </Label>
                        </div>
                        {hasInitialPayment && (
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="المبلغ المدفوع"
                            value={initialPaymentAmount}
                            onChange={(e) => setInitialPaymentAmount(e.target.value)}
                            className="mr-6"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Related Records Options - Show on Step 2 to enable Step 3 */}
            {step === 2 && !editingEntry && (
              <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                <h4 className="font-medium text-sm">هل تريد إضافة سجلات مرتبطة؟</h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Incoming Cheques Option */}
                  {(currentEntryType === "دخل" || currentEntryType === "إيراد") && (
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        id="enableIncomingCheck"
                        checked={hasIncomingCheck}
                        onChange={(e) => {
                          setHasIncomingCheck(e.target.checked);
                          if (e.target.checked && incomingChequesList.length === 0) {
                            addIncomingCheque();
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="enableIncomingCheck" className="cursor-pointer text-sm">
                        شيكات واردة
                      </Label>
                    </div>
                  )}

                  {/* Outgoing Cheques Option */}
                  {currentEntryType === "مصروف" && (
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        id="enableOutgoingCheck"
                        checked={hasOutgoingCheck}
                        onChange={(e) => {
                          setHasOutgoingCheck(e.target.checked);
                          if (e.target.checked && outgoingChequesList.length === 0) {
                            addOutgoingCheque();
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="enableOutgoingCheck" className="cursor-pointer text-sm">
                        شيكات صادرة
                      </Label>
                    </div>
                  )}

                  {/* Inventory Update Option */}
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input
                      type="checkbox"
                      id="enableInventoryUpdate"
                      checked={hasInventoryUpdate}
                      onChange={(e) => setHasInventoryUpdate(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="enableInventoryUpdate" className="cursor-pointer text-sm">
                      تحديث المخزون
                    </Label>
                  </div>

                  {/* Fixed Asset Option */}
                  {currentEntryType === "مصروف" && formData.category === "أصول ثابتة" && (
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        id="enableFixedAsset"
                        checked={hasFixedAsset}
                        onChange={(e) => setHasFixedAsset(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="enableFixedAsset" className="cursor-pointer text-sm">
                        إضافة كأصل ثابت
                      </Label>
                    </div>
                  )}

                  {/* Create Invoice Option */}
                  {currentEntryType === "دخل" && formData.associatedParty && setCreateInvoice && (
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        id="enableCreateInvoice"
                        checked={createInvoice || false}
                        onChange={(e) => setCreateInvoice(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="enableCreateInvoice" className="cursor-pointer text-sm">
                        إنشاء فاتورة
                      </Label>
                    </div>
                  )}
                </div>
                {hasRelatedRecords && (
                  <p className="text-xs text-blue-600">
                    ستظهر تفاصيل السجلات المختارة في الخطوة التالية
                  </p>
                )}
              </div>
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
                          <div key={cheque.id} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">شيك {index + 1}</h4>
                              {incomingChequesList.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeIncomingCheque(cheque.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {/* Cheque Type Selection */}
                            <div className="space-y-2">
                              <Label>نوع الشيك المحاسبي</Label>
                              <select
                                value={cheque.accountingType || "cashed"}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "accountingType", e.target.value)
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                required
                              >
                                <option value="cashed">شيك صرف - يُصرف فوراً</option>
                                <option value="postponed">شيك مؤجل - يُصرف لاحقاً</option>
                                <option value="endorsed">شيك مظهر - تحويل لطرف ثالث</option>
                              </select>
                            </div>

                            {/* Endorsee field - only for endorsed cheques */}
                            {cheque.accountingType === 'endorsed' && (
                              <div className="space-y-2 p-3 bg-purple-50 rounded-md border border-purple-200">
                                <Label>مظهر إلى (اسم المستفيد)</Label>
                                <Input
                                  type="text"
                                  placeholder="أدخل اسم الجهة المظهر لها الشيك"
                                  value={cheque.endorsedToName || ""}
                                  onChange={(e) =>
                                    updateIncomingCheque(cheque.id, "endorsedToName", e.target.value)
                                  }
                                  required
                                />
                              </div>
                            )}

                            {/* Postponed cheque warning */}
                            {cheque.accountingType === 'postponed' && (
                              <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                                <p className="text-xs text-yellow-700">
                                  الشيك المؤجل: سيظهر في قائمة الشيكات المعلقة
                                </p>
                              </div>
                            )}

                            {/* Cheque details */}
                            <div className="grid grid-cols-2 gap-4">
                              <Input
                                type="text"
                                placeholder="رقم الشيك"
                                value={cheque.chequeNumber}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "chequeNumber", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="مبلغ الشيك"
                                value={cheque.chequeAmount}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "chequeAmount", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="text"
                                placeholder="اسم البنك"
                                value={cheque.bankName}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "bankName", e.target.value)
                                }
                                required
                              />
                              <div className="space-y-1">
                                <Input
                                  type="date"
                                  value={cheque.dueDate}
                                  onChange={(e) =>
                                    updateIncomingCheque(cheque.id, "dueDate", e.target.value)
                                  }
                                  required
                                />
                                <p className="text-xs text-gray-500">تاريخ الاستحقاق</p>
                              </div>
                            </div>
                          </div>
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
                          <div key={cheque.id} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">شيك {index + 1}</h4>
                              {outgoingChequesList.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOutgoingCheque(cheque.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {/* Cheque Type Selection */}
                            <div className="space-y-2">
                              <Label>نوع الشيك المحاسبي</Label>
                              <select
                                value={cheque.accountingType || "cashed"}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "accountingType", e.target.value)
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                required
                              >
                                <option value="cashed">شيك صرف - يُصرف فوراً</option>
                                <option value="postponed">شيك مؤجل - يُصرف لاحقاً</option>
                                <option value="endorsed">شيك مظهر - شيك وارد نمرره للمورد</option>
                              </select>
                            </div>

                            {/* Endorsed from field - only for endorsed cheques */}
                            {cheque.accountingType === 'endorsed' && (
                              <div className="space-y-2 p-3 bg-purple-50 rounded-md border border-purple-200">
                                <Label>مظهر من (مصدر الشيك الأصلي)</Label>
                                <Input
                                  type="text"
                                  placeholder="أدخل اسم العميل/الجهة التي استلمنا منها الشيك"
                                  value={cheque.endorsedFromName || ""}
                                  onChange={(e) =>
                                    updateOutgoingCheque(cheque.id, "endorsedFromName", e.target.value)
                                  }
                                  required
                                />
                              </div>
                            )}

                            {/* Postponed cheque warning */}
                            {cheque.accountingType === 'postponed' && (
                              <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                                <p className="text-xs text-yellow-700">
                                  الشيك المؤجل: سيظهر في قائمة الشيكات الصادرة المعلقة
                                </p>
                              </div>
                            )}

                            {/* Cheque details */}
                            <div className="grid grid-cols-2 gap-4">
                              <Input
                                type="text"
                                placeholder="رقم الشيك"
                                value={cheque.chequeNumber}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "chequeNumber", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="مبلغ الشيك"
                                value={cheque.chequeAmount}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "chequeAmount", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="text"
                                placeholder="اسم البنك"
                                value={cheque.bankName}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "bankName", e.target.value)
                                }
                                required
                              />
                              <div className="space-y-1">
                                <Input
                                  type="date"
                                  value={cheque.dueDate}
                                  onChange={(e) =>
                                    updateOutgoingCheque(cheque.id, "dueDate", e.target.value)
                                  }
                                  required
                                />
                                <p className="text-xs text-gray-500">تاريخ الاستحقاق</p>
                              </div>
                            </div>
                          </div>
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
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-sm">تحديث المخزون</h4>
                    <div className="space-y-2">
                      <Input
                        type="text"
                        placeholder="اسم الصنف"
                        value={inventoryFormData.itemName}
                        onChange={(e) =>
                          setInventoryFormData({ ...inventoryFormData, itemName: e.target.value })
                        }
                        required={hasInventoryUpdate}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="الكمية"
                          value={inventoryFormData.quantity}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, quantity: e.target.value })
                          }
                          required={hasInventoryUpdate}
                        />
                        <Input
                          type="text"
                          placeholder="الوحدة (كغ، متر، قطعة)"
                          value={inventoryFormData.unit}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, unit: e.target.value })
                          }
                          required={hasInventoryUpdate}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="السماكة (مم)"
                          value={inventoryFormData.thickness}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, thickness: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="العرض (متر)"
                          value={inventoryFormData.width}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, width: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="الطول (متر)"
                          value={inventoryFormData.length}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, length: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="تكلفة الشحن (اختياري)"
                          value={inventoryFormData.shippingCost}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, shippingCost: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="تكاليف أخرى (اختياري)"
                          value={inventoryFormData.otherCosts}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, otherCosts: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Fixed Asset Details */}
                {hasFixedAsset && currentEntryType === "مصروف" && formData.category === "أصول ثابتة" && (
                  <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                    <h4 className="font-medium text-sm">إضافة كأصل ثابت</h4>
                    <div className="space-y-2">
                        <Input
                          type="text"
                          placeholder="اسم الأصل"
                          value={fixedAssetFormData.assetName}
                          onChange={(e) =>
                            setFixedAssetFormData({ ...fixedAssetFormData, assetName: e.target.value })
                          }
                          required={hasFixedAsset}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor="usefulLifeYears">العمر الإنتاجي (سنوات)</Label>
                            <Input
                              id="usefulLifeYears"
                              type="number"
                              step="0.1"
                              placeholder="مثال: 5"
                              value={fixedAssetFormData.usefulLifeYears}
                              onChange={(e) =>
                                setFixedAssetFormData({ ...fixedAssetFormData, usefulLifeYears: e.target.value })
                              }
                              required={hasFixedAsset}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="salvageValue">القيمة المتبقية (دينار)</Label>
                            <Input
                              id="salvageValue"
                              type="number"
                              step="0.01"
                              placeholder="مثال: 500"
                              value={fixedAssetFormData.salvageValue}
                              onChange={(e) =>
                                setFixedAssetFormData({ ...fixedAssetFormData, salvageValue: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        {fixedAssetFormData.usefulLifeYears && fixedAssetFormData.salvageValue && (
                          <p className="text-xs text-gray-600 pr-2">
                            الإهلاك الشهري المقدر:{" "}
                            {(
                              (parseFloat(formData.amount || "0") - parseFloat(fixedAssetFormData.salvageValue)) /
                              (parseFloat(fixedAssetFormData.usefulLifeYears) * 12)
                            ).toFixed(2)}{" "}
                            دينار/شهر
                          </p>
                        )}
                    </div>
                  </div>
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
