/**
 * StepPartyARAP - Step 2 of the ledger entry wizard
 * Contains: Associated Party, Owner (capital), Payment Status, and Related Records toggles
 */

import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown } from "lucide-react";
import { LedgerFormData } from "../types/ledger";
import { isLoanTransaction, isAdvanceTransaction } from "../utils/ledger-helpers";
import { NON_CASH_SUBCATEGORIES } from "../utils/ledger-constants";

interface ClientOption {
  name: string;
  source: string;
  balance?: number;
  hasBalance?: boolean;
}

interface PartnerOption {
  id: string;
  name: string;
}

interface StepPartyARAPProps {
  formData: LedgerFormData;
  onUpdate: (updates: Partial<LedgerFormData>) => void;

  // Associated party
  allClients: ClientOption[];
  clientsLoading: boolean;

  // Partners (for capital transactions)
  partners: PartnerOption[];

  // Entry type for conditional rendering
  currentEntryType: string;

  // Edit mode flag (hides payment status and related records sections)
  isEditMode: boolean;

  // Payment tracking
  hasInitialPayment: boolean;
  setHasInitialPayment: (value: boolean) => void;
  initialPaymentAmount: string;
  setInitialPaymentAmount: (value: string) => void;

  // Related records toggles
  hasIncomingCheck: boolean;
  setHasIncomingCheck: (value: boolean) => void;
  hasOutgoingCheck: boolean;
  setHasOutgoingCheck: (value: boolean) => void;
  hasInventoryUpdate: boolean;
  setHasInventoryUpdate: (value: boolean) => void;
  hasFixedAsset: boolean;
  setHasFixedAsset: (value: boolean) => void;
  createInvoice: boolean;
  setCreateInvoice: ((value: boolean) => void) | undefined;

  // Cheque list initializers
  onAddIncomingCheque: () => void;
  onAddOutgoingCheque: () => void;
  incomingChequesCount: number;
  outgoingChequesCount: number;

  // For "related records selected" message
  hasRelatedRecords: boolean;
}

export function StepPartyARAP({
  formData,
  onUpdate,
  allClients,
  clientsLoading,
  partners,
  currentEntryType,
  isEditMode,
  hasInitialPayment,
  setHasInitialPayment,
  initialPaymentAmount,
  setInitialPaymentAmount,
  hasIncomingCheck,
  setHasIncomingCheck,
  hasOutgoingCheck,
  setHasOutgoingCheck,
  hasInventoryUpdate,
  setHasInventoryUpdate,
  hasFixedAsset,
  setHasFixedAsset,
  createInvoice,
  setCreateInvoice,
  onAddIncomingCheque,
  onAddOutgoingCheque,
  incomingChequesCount,
  outgoingChequesCount,
  hasRelatedRecords,
}: StepPartyARAPProps) {
  // Local state for party dropdown
  const [showPartyDropdown, setShowPartyDropdown] = useState(false);

  // Check if this is a loan transaction - loans require party and AR/AP tracking
  const isLoan = isLoanTransaction(currentEntryType, formData.category);

  // Check if this is an advance transaction - advances track AR/AP (obligation to deliver goods/services)
  const isAdvance = isAdvanceTransaction(formData.category);

  // Check if subcategory is a non-cash expense (wastage, free samples, etc.)
  const isNonCashSubcategory = (NON_CASH_SUBCATEGORIES as readonly string[]).includes(formData.subCategory);

  // Force AR/AP tracking for loans AND advances
  // Advances represent an obligation: we owe goods/services to customer (سلفة عميل)
  // or supplier owes us goods/services (سلفة مورد)
  useEffect(() => {
    if ((isLoan || isAdvance) && !formData.trackARAP) {
      onUpdate({ trackARAP: true });
    }
    // Advances CANNOT be marked as immediate settlement (fully paid)
    // because receiving cash doesn't fulfill the obligation - delivering goods does
    if (isAdvance && formData.immediateSettlement) {
      onUpdate({ immediateSettlement: false });
    }
  }, [isLoan, isAdvance, formData.trackARAP, formData.immediateSettlement, onUpdate]);

  // Auto-select non-cash expense option for wastage/samples subcategories
  useEffect(() => {
    if (isNonCashSubcategory && currentEntryType === "مصروف") {
      // Auto-set to non-cash expense (no AR/AP, no immediate settlement)
      if (formData.trackARAP || formData.immediateSettlement) {
        onUpdate({ trackARAP: false, immediateSettlement: false });
      }
    }
  }, [isNonCashSubcategory, currentEntryType, formData.trackARAP, formData.immediateSettlement, onUpdate]);

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
    onUpdate({ associatedParty: partyName });
    setShowPartyDropdown(false);
  };

  return (
    <>
      {/* Associated Party - Not shown for equity transactions (they use Owner dropdown instead) */}
      {formData.category !== "رأس المال" && (
        <div className="space-y-2 relative">
          <Label htmlFor="associatedParty">
            {isLoan
              ? "الطرف المعني (المُقرض/المُقترض) *"
              : "الطرف المعني (العميل/المورد) - اختياري"}
          </Label>
          <div className="relative">
            <Input
              id="associatedParty"
              value={formData.associatedParty}
              onChange={(e) => {
                onUpdate({ associatedParty: e.target.value });
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
                            ? 'bg-red-100 text-red-700' // Positive = they owe us (receivable)
                            : 'bg-green-100 text-green-700' // Negative = we owe them (payable)
                        }`}>
                          {client.balance && client.balance > 0 ? 'لنا عليه: ' : 'له علينا: '}
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
            {isLoan
              ? "يجب تحديد الطرف المعني لعمليات القروض (المُقرض أو المُقترض)"
              : "اترك هذا الحقل فارغاً للمصاريف اليومية التي لا تحتاج طرف معني"}
          </p>
        </div>
      )}

      {/* Owner dropdown for capital transactions */}
      {formData.category === "رأس المال" && (
        <div className="space-y-2">
          <Label htmlFor="ownerName">اسم الشريك/المالك *</Label>
          <select
            id="ownerName"
            value={formData.ownerName}
            onChange={(e) => onUpdate({ ownerName: e.target.value })}
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

      {/* Payment Status - Only for new entries with income/expense/loan type */}
      {!isEditMode && (currentEntryType === "دخل" || currentEntryType === "مصروف" || isLoan) && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
          <Label className="font-medium">حالة الدفع</Label>
          <div className="space-y-3">
            {/* Option 1: Fully Paid - DISABLED for advances (obligation not fulfilled by receiving cash) */}
            <label className={`flex items-center space-x-2 space-x-reverse ${isAdvance ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
              <input
                type="radio"
                name="paymentStatus"
                value="paid"
                checked={formData.immediateSettlement && !hasInitialPayment}
                onChange={() => {
                  onUpdate({ immediateSettlement: true, trackARAP: true });
                  setHasInitialPayment(false);
                  setInitialPaymentAmount("");
                }}
                className="h-4 w-4"
                disabled={isAdvance}
              />
              <span>مدفوع بالكامل (نقدي أو شيك صرف)</span>
              {isAdvance && <span className="text-xs text-amber-600 ml-2">(غير متاح للسلف)</span>}
            </label>

            {/* Option 2: On Credit */}
            <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
              <input
                type="radio"
                name="paymentStatus"
                value="credit"
                checked={formData.trackARAP && !formData.immediateSettlement && !hasInitialPayment}
                onChange={() => {
                  onUpdate({ trackARAP: true, immediateSettlement: false });
                  setHasInitialPayment(false);
                  setInitialPaymentAmount("");
                }}
                className="h-4 w-4"
              />
              <span>آجل - سيتم تتبع الذمم</span>
            </label>

            {/* Option 3: Partial Payment */}
            <div className="space-y-2">
              <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                <input
                  type="radio"
                  name="paymentStatus"
                  value="partial"
                  checked={hasInitialPayment}
                  onChange={() => {
                    onUpdate({ trackARAP: true, immediateSettlement: false });
                    setHasInitialPayment(true);
                  }}
                  className="h-4 w-4"
                />
                <span>دفعة جزئية</span>
              </label>
              {hasInitialPayment && (
                <Input
                  type="number"
                  step="0.01"
                  placeholder="المبلغ المدفوع"
                  value={initialPaymentAmount}
                  onChange={(e) => setInitialPaymentAmount(e.target.value)}
                  className="ml-6 max-w-[200px]"
                />
              )}
            </div>

            {/* Option 4: Non-cash expense (for wastage, free samples, etc.) */}
            {currentEntryType === "مصروف" && (
              <label className="flex items-center space-x-2 space-x-reverse cursor-pointer">
                <input
                  type="radio"
                  name="paymentStatus"
                  value="non-cash"
                  checked={!formData.trackARAP && !formData.immediateSettlement && !hasInitialPayment}
                  onChange={() => {
                    onUpdate({ trackARAP: false, immediateSettlement: false });
                    setHasInitialPayment(false);
                    setInitialPaymentAmount("");
                  }}
                  className="h-4 w-4"
                />
                <span>مصروف غير نقدي (هدر، عينات، إهلاك)</span>
              </label>
            )}
          </div>

          {/* Helper text */}
          <p className="text-xs text-gray-500">
            {formData.immediateSettlement && !hasInitialPayment && "سيتم تسجيل المبلغ كمدفوع بالكامل"}
            {formData.trackARAP && !formData.immediateSettlement && !hasInitialPayment && "سيتم إنشاء ذمة (مدين/دائن) لمتابعة الدفع"}
            {hasInitialPayment && "سيتم تسجيل الدفعة الجزئية وإنشاء ذمة للمبلغ المتبقي"}
            {!formData.trackARAP && !formData.immediateSettlement && !hasInitialPayment && currentEntryType === "مصروف" && "سيتم تسجيل المصروف فقط بدون حركة نقدية أو ذمم"}
          </p>
        </div>
      )}

      {/* Related Records Options - Only for new entries, not for capital transactions (no options apply) */}
      {!isEditMode && formData.category !== "رأس المال" && (
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
                    if (e.target.checked && incomingChequesCount === 0) {
                      onAddIncomingCheque();
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
                    if (e.target.checked && outgoingChequesCount === 0) {
                      onAddOutgoingCheque();
                    }
                  }}
                  className="h-4 w-4"
                />
                <Label htmlFor="enableOutgoingCheck" className="cursor-pointer text-sm">
                  شيكات صادرة
                </Label>
              </div>
            )}

            {/* Inventory Update Option - Not for equity transactions */}
            {formData.category !== "رأس المال" && (
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
            )}

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
    </>
  );
}
