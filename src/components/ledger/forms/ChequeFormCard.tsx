/**
 * ChequeFormCard - Reusable component for both incoming and outgoing cheque forms
 * Extracted from LedgerFormDialog.tsx to reduce duplication
 */

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { CheckFormDataItem, OutgoingCheckFormDataItem } from "../types/ledger";

export interface ChequeFormCardProps {
  cheque: CheckFormDataItem | OutgoingCheckFormDataItem;
  index: number;
  direction: 'incoming' | 'outgoing';
  onUpdate: (id: string, field: string, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

export function ChequeFormCard({
  cheque,
  index,
  direction,
  onUpdate,
  onRemove,
  canRemove,
}: ChequeFormCardProps) {
  // Direction-specific text
  const endorsedLabel = direction === 'incoming'
    ? "مظهر إلى (اسم المستفيد)"
    : "مظهر من (مصدر الشيك الأصلي)";

  const endorsedPlaceholder = direction === 'incoming'
    ? "أدخل اسم الجهة المظهر لها الشيك"
    : "أدخل اسم العميل/الجهة التي استلمنا منها الشيك";

  const endorsedFieldName = direction === 'incoming'
    ? "endorsedToName"
    : "endorsedFromName";

  const postponedWarning = direction === 'incoming'
    ? "الشيك المؤجل: سيظهر في قائمة الشيكات المعلقة"
    : "الشيك المؤجل: سيظهر في قائمة الشيكات الصادرة المعلقة";

  // Get endorsed value based on direction
  const endorsedValue = direction === 'incoming'
    ? (cheque as CheckFormDataItem).endorsedToName || ""
    : (cheque as OutgoingCheckFormDataItem).endorsedFromName || "";

  return (
    <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">شيك {index + 1}</h4>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(cheque.id)}
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
          onChange={(e) => onUpdate(cheque.id, "accountingType", e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          <option value="cashed">شيك صرف - يُصرف فوراً</option>
          <option value="postponed">شيك مؤجل - يُصرف لاحقاً</option>
          <option value="endorsed">
            {direction === 'incoming'
              ? "شيك مظهر - تحويل لطرف ثالث"
              : "شيك مظهر - شيك وارد نمرره للمورد"}
          </option>
        </select>
      </div>

      {/* Endorsee/Endorser field - only for endorsed cheques */}
      {cheque.accountingType === 'endorsed' && (
        <div className="space-y-2 p-3 bg-purple-50 rounded-md border border-purple-200">
          <Label>{endorsedLabel}</Label>
          <Input
            type="text"
            placeholder={endorsedPlaceholder}
            value={endorsedValue}
            onChange={(e) => onUpdate(cheque.id, endorsedFieldName, e.target.value)}
            required
          />
        </div>
      )}

      {/* Postponed cheque warning */}
      {cheque.accountingType === 'postponed' && (
        <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
          <p className="text-xs text-yellow-700">{postponedWarning}</p>
        </div>
      )}

      {/* Cheque details */}
      <div className="grid grid-cols-2 gap-4">
        <Input
          type="text"
          placeholder="رقم الشيك"
          value={cheque.chequeNumber}
          onChange={(e) => onUpdate(cheque.id, "chequeNumber", e.target.value)}
          required
        />
        <Input
          type="number"
          step="0.01"
          placeholder="مبلغ الشيك"
          value={cheque.chequeAmount}
          onChange={(e) => onUpdate(cheque.id, "chequeAmount", e.target.value)}
          required
        />
        <Input
          type="text"
          placeholder="اسم البنك"
          value={cheque.bankName}
          onChange={(e) => onUpdate(cheque.id, "bankName", e.target.value)}
          required
        />
        <div className="space-y-1">
          <Input
            type="date"
            value={cheque.dueDate}
            onChange={(e) => onUpdate(cheque.id, "dueDate", e.target.value)}
            required
          />
          <p className="text-xs text-gray-500">تاريخ الاستحقاق</p>
        </div>
      </div>
    </div>
  );
}
