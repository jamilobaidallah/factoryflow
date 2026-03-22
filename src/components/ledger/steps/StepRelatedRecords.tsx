/**
 * StepRelatedRecords - Step 3 of the ledger entry wizard
 * Orchestrates all related record forms: cheques, inventory, fixed assets, invoice info
 */

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Plus, AlertTriangle } from "lucide-react";
import { ChequeFormCard } from "../forms/ChequeFormCard";
import { InventoryFormCard } from "../forms/InventoryFormCard";
import { FixedAssetFormCard } from "../forms/FixedAssetFormCard";
import { safeAdd, safeSubtract, parseAmount } from "@/lib/currency";
import { formatNumber } from "@/lib/date-utils";
import type {
  LedgerFormData,
  CheckFormDataItem,
  OutgoingCheckFormDataItem,
  InventoryFormDataItem,
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

  // Inventory (multi-item list)
  hasInventoryUpdate: boolean;
  inventoryFormDataList: InventoryFormDataItem[];
  onAddInventoryItem: () => void;
  onUpdateInventoryItem: (id: string, field: string, value: string) => void;
  onRemoveInventoryItem: (id: string) => void;
  onInventoryItemSelect: (id: string, itemId: string, itemName: string, unit: string) => void;
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
  inventoryFormDataList,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onRemoveInventoryItem,
  onInventoryItemSelect,
  inventoryItems,
  inventoryItemsLoading,
  inventoryItemsError,
  hasFixedAsset,
  fixedAssetFormData,
  onUpdateFixedAsset,
  createInvoice,
}: StepRelatedRecordsProps) {
  // Calculate cheque totals using Decimal.js for precision
  const incomingChequesTotal = useMemo(() => {
    return incomingChequesList.reduce(
      (sum, c) => safeAdd(sum, parseAmount(c.chequeAmount)),
      0
    );
  }, [incomingChequesList]);

  const outgoingChequesTotal = useMemo(() => {
    return outgoingChequesList.reduce(
      (sum, c) => safeAdd(sum, parseAmount(c.chequeAmount)),
      0
    );
  }, [outgoingChequesList]);

  // Calculate difference from entry amount
  const entryAmount = parseAmount(formData.amount);
  const incomingDifference = safeSubtract(entryAmount, incomingChequesTotal);
  const outgoingDifference = safeSubtract(entryAmount, outgoingChequesTotal);

  // Calculate total of per-item amounts (for purchases with multiple items)
  const inventoryItemsTotal = useMemo(() => {
    return inventoryFormDataList.reduce(
      (sum, item) => safeAdd(sum, parseAmount(item.itemAmount ?? "")),
      0
    );
  }, [inventoryFormDataList]);
  const inventoryAmountDifference = safeSubtract(entryAmount, inventoryItemsTotal);

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

              {/* Total cheques amount with difference warning */}
              {incomingChequesList.length >= 1 && (
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-sm font-medium text-blue-700">
                      مجموع الشيكات: {formatNumber(incomingChequesTotal)} دينار
                    </p>
                  </div>
                  {Math.abs(incomingDifference) > 0.01 && (
                    <div className="p-3 bg-amber-50 rounded-md border border-amber-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm text-amber-700">
                        الفرق عن مبلغ الحركة ({formatNumber(entryAmount)} دينار): {formatNumber(Math.abs(incomingDifference))} دينار
                        {incomingDifference > 0 ? " (أقل)" : " (أكثر)"}
                      </p>
                    </div>
                  )}
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

              {/* Total cheques amount with difference warning */}
              {outgoingChequesList.length >= 1 && (
                <div className="space-y-2">
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <p className="text-sm font-medium text-blue-700">
                      مجموع الشيكات: {formatNumber(outgoingChequesTotal)} دينار
                    </p>
                  </div>
                  {Math.abs(outgoingDifference) > 0.01 && (
                    <div className="p-3 bg-amber-50 rounded-md border border-amber-200 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm text-amber-700">
                        الفرق عن مبلغ الحركة ({formatNumber(entryAmount)} دينار): {formatNumber(Math.abs(outgoingDifference))} دينار
                        {outgoingDifference > 0 ? " (أقل)" : " (أكثر)"}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inventory Update Details (multi-item) */}
      {hasInventoryUpdate && (
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">تحديث المخزون</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddInventoryItem}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              إضافة صنف آخر
            </Button>
          </div>

          <div className="space-y-4">
            {inventoryFormDataList.map((item, index) => (
              <InventoryFormCard
                key={item.id}
                formData={item}
                index={index}
                canRemove={inventoryFormDataList.length > 1}
                onRemove={() => onRemoveInventoryItem(item.id)}
                onUpdate={(field, value) => onUpdateInventoryItem(item.id, field, value)}
                onItemSelect={(itemId, itemName, unit) =>
                  onInventoryItemSelect(item.id, itemId, itemName, unit)
                }
                entryType={currentEntryType}
                inventoryItems={inventoryItems}
                isLoadingItems={inventoryItemsLoading}
                error={inventoryItemsError}
              />
            ))}
          </div>

          {/* For purchases with multiple items: show total vs entry amount */}
          {currentEntryType === "مصروف" && inventoryFormDataList.length > 1 && inventoryItemsTotal > 0 && (
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-sm font-medium text-blue-700">
                  مجموع تكاليف الأصناف: {formatNumber(inventoryItemsTotal)} دينار
                </p>
              </div>
              {Math.abs(inventoryAmountDifference) > 0.01 && (
                <div className="p-3 bg-amber-50 rounded-md border border-amber-200 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    الفرق عن مبلغ الحركة ({formatNumber(entryAmount)} دينار): {formatNumber(Math.abs(inventoryAmountDifference))} دينار
                    {inventoryAmountDifference > 0 ? " (أقل)" : " (أكثر)"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
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
