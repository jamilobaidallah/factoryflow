/**
 * StepRelatedRecords - Step 3 of the ledger entry wizard
 * Orchestrates all related record forms: cheques, inventory, fixed assets, invoice info
 */

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { ChequeFormCard } from "../forms/ChequeFormCard";
import { InventoryFormCard } from "../forms/InventoryFormCard";
import { FixedAssetFormCard } from "../forms/FixedAssetFormCard";
import type {
  LedgerFormData,
  CheckFormDataItem,
  OutgoingCheckFormDataItem,
  InventoryFormData,
  FixedAssetFormData,
} from "../types/ledger";
import type { InventoryItemOption } from "@/hooks/useInventoryItems";

interface StepRelatedRecordsProps {
  formData: LedgerFormData;
  currentEntryType: string;

  // Incoming Cheques
  hasIncomingCheck: boolean;
  incomingChequesList: CheckFormDataItem[];
  onAddIncomingCheque: () => void;
  onUpdateIncomingCheque: (id: string, field: string, value: string) => void;
  onRemoveIncomingCheque: (id: string) => void;

  // Outgoing Cheques
  hasOutgoingCheck: boolean;
  outgoingChequesList: OutgoingCheckFormDataItem[];
  onAddOutgoingCheque: () => void;
  onUpdateOutgoingCheque: (id: string, field: string, value: string) => void;
  onRemoveOutgoingCheque: (id: string) => void;

  // Inventory
  hasInventoryUpdate: boolean;
  inventoryFormData: InventoryFormData;
  onUpdateInventory: (field: string, value: string) => void;
  onInventoryItemSelect: (itemId: string, itemName: string, unit: string) => void;
  inventoryItems: InventoryItemOption[];
  inventoryItemsLoading: boolean;
  inventoryItemsError: string | null;

  // Fixed Asset
  hasFixedAsset: boolean;
  fixedAssetFormData: FixedAssetFormData;
  onUpdateFixedAsset: (field: string, value: string) => void;

  // Invoice
  createInvoice: boolean;
}

export function StepRelatedRecords({
  formData,
  currentEntryType,
  hasIncomingCheck,
  incomingChequesList,
  onAddIncomingCheque,
  onUpdateIncomingCheque,
  onRemoveIncomingCheque,
  hasOutgoingCheck,
  outgoingChequesList,
  onAddOutgoingCheque,
  onUpdateOutgoingCheque,
  onRemoveOutgoingCheque,
  hasInventoryUpdate,
  inventoryFormData,
  onUpdateInventory,
  onInventoryItemSelect,
  inventoryItems,
  inventoryItemsLoading,
  inventoryItemsError,
  hasFixedAsset,
  fixedAssetFormData,
  onUpdateFixedAsset,
  createInvoice,
}: StepRelatedRecordsProps) {
  return (
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
              onClick={onAddIncomingCheque}
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
                  onUpdate={onUpdateIncomingCheque}
                  onRemove={onRemoveIncomingCheque}
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
              onClick={onAddOutgoingCheque}
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
                  onUpdate={onUpdateOutgoingCheque}
                  onRemove={onRemoveOutgoingCheque}
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
          onUpdate={onUpdateInventory}
          onItemSelect={onInventoryItemSelect}
          inventoryItems={inventoryItems}
          isLoadingItems={inventoryItemsLoading}
          error={inventoryItemsError}
        />
      )}

      {/* Fixed Asset Details */}
      {hasFixedAsset && currentEntryType === "مصروف" && formData.category === "أصول ثابتة" && (
        <FixedAssetFormCard
          formData={fixedAssetFormData}
          onUpdate={onUpdateFixedAsset}
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
  );
}
