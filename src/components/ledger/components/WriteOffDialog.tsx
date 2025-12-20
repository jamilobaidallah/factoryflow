"use client";

/**
 * WriteOffDialog Component
 *
 * Dialog for writing off bad debt (ديون معدومة).
 * Features:
 * - Amount field (default: full remaining balance)
 * - Required reason field
 * - Warning message about irreversibility
 * - Captures current user for audit trail
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { createLedgerService } from "@/services/ledgerService";
import { LedgerEntry } from "../utils/ledger-constants";

interface WriteOffDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntry | null;
  onSuccess?: () => void;
}

// Common write-off reasons
const WRITEOFF_REASONS = [
  { value: "bankruptcy", label: "إفلاس العميل" },
  { value: "uncollectible", label: "استحالة التحصيل" },
  { value: "dispute", label: "نزاع قانوني" },
  { value: "death", label: "وفاة المدين" },
  { value: "closure", label: "إغلاق الشركة" },
  { value: "other", label: "سبب آخر" },
] as const;

export function WriteOffDialog({ isOpen, onClose, entry, onSuccess }: WriteOffDialogProps) {
  const { user, role } = useUser();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [reasonType, setReasonType] = useState("");
  const [reasonDetails, setReasonDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Reset form when dialog opens with new entry
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setAmount("");
      setReasonType("");
      setReasonDetails("");
      setConfirmed(false);
      onClose();
    }
  };

  // Calculate values
  const calculations = useMemo(() => {
    const writeoffValue = parseFloat(amount) || 0;
    const remaining = entry?.remainingBalance ?? 0;
    const isOverAmount = writeoffValue > remaining;
    const willFullyWriteOff = Math.abs(writeoffValue - remaining) < 0.01;

    return {
      writeoffValue,
      remaining,
      isOverAmount,
      willFullyWriteOff,
    };
  }, [amount, entry?.remainingBalance]);

  // Set full remaining amount
  const handleFullWriteOff = () => {
    const remaining = entry?.remainingBalance ?? 0;
    setAmount(remaining.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !entry) { return; }

    const { writeoffValue, remaining, isOverAmount } = calculations;

    // Validate amount
    if (writeoffValue <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح للشطب",
        variant: "destructive",
      });
      return;
    }

    if (isOverAmount) {
      toast({
        title: "خطأ في المبلغ",
        description: `المبلغ للشطب (${writeoffValue.toFixed(2)}) أكبر من المتبقي (${remaining.toFixed(2)})`,
        variant: "destructive",
      });
      return;
    }

    // Validate reason
    if (!reasonType) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار سبب الشطب",
        variant: "destructive",
      });
      return;
    }

    // Build full reason text
    const reasonLabel = WRITEOFF_REASONS.find(r => r.value === reasonType)?.label || reasonType;
    const fullReason = reasonDetails
      ? `${reasonLabel}: ${reasonDetails}`
      : reasonLabel;

    setLoading(true);
    try {
      const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');

      const result = await service.writeOffBadDebt({
        entryId: entry.id,
        entryTransactionId: entry.transactionId,
        entryAmount: entry.amount,
        entryType: entry.type,
        entryDescription: entry.description,
        associatedParty: entry.associatedParty,
        totalPaid: entry.totalPaid || 0,
        totalDiscount: entry.totalDiscount || 0,
        currentWriteoff: entry.writeoffAmount || 0,
        remainingBalance: entry.remainingBalance || entry.amount,
        writeoffAmount: writeoffValue,
        writeoffReason: fullReason,
        writeoffBy: user.email || user.uid,
      });

      if (result.success) {
        toast({
          title: "تم الشطب بنجاح",
          description: `تم شطب مبلغ ${writeoffValue.toFixed(2)} دينار كدين معدوم`,
        });

        // Reset form
        setAmount("");
        setReasonType("");
        setReasonDetails("");
        setConfirmed(false);
        onClose();
        onSuccess?.();
      } else {
        toast({
          title: "خطأ",
          description: result.error || "حدث خطأ أثناء شطب الدين",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء شطب الدين",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const { writeoffValue, remaining, isOverAmount, willFullyWriteOff } = calculations;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>شطب كدين معدوم</DialogTitle>
          <DialogDescription>
            شطب جزء أو كل المبلغ المتبقي كدين غير قابل للتحصيل
          </DialogDescription>
        </DialogHeader>

        {entry && (
          <div className="space-y-2 px-6 mb-4">
            <div className="text-sm">
              <span className="font-medium">المعاملة:</span> {entry.description}
            </div>
            <div className="text-sm">
              <span className="font-medium">الطرف:</span> {entry.associatedParty}
            </div>
            <div className="text-sm">
              <span className="font-medium">المبلغ الإجمالي:</span> {entry.amount.toFixed(2)} دينار
            </div>
            <div className="text-sm">
              <span className="font-medium">المبلغ المتبقي:</span>{" "}
              <span className="text-red-600 font-bold">
                {entry.remainingBalance?.toFixed(2)} دينار
              </span>
            </div>
            {entry.totalPaid && entry.totalPaid > 0 && (
              <div className="text-sm">
                <span className="font-medium">المدفوع سابقاً:</span> {entry.totalPaid.toFixed(2)} دينار
              </div>
            )}
            {entry.writeoffAmount && entry.writeoffAmount > 0 && (
              <div className="text-sm text-amber-700">
                <span className="font-medium">المشطوب سابقاً:</span> {entry.writeoffAmount.toFixed(2)} دينار
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 px-6">
          {/* Warning Alert */}
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>تحذير هام</AlertTitle>
            <AlertDescription>
              شطب الدين كمعدوم هو إجراء لا يمكن التراجع عنه.
              سيتم تسجيل المبلغ كمصروف ديون معدومة في السجلات المحاسبية.
            </AlertDescription>
          </Alert>

          {/* Write-off Amount */}
          <div className="space-y-2">
            <Label htmlFor="writeoffAmount">مبلغ الشطب</Label>
            <div className="flex gap-2">
              <Input
                id="writeoffAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="أدخل المبلغ"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
              />
              {entry?.remainingBalance !== undefined && entry.remainingBalance > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFullWriteOff}
                >
                  شطب الكل
                </Button>
              )}
            </div>
            {isOverAmount && (
              <p className="text-xs text-red-600">
                المبلغ أكبر من المتبقي ({remaining.toFixed(2)} دينار)
              </p>
            )}
            {willFullyWriteOff && writeoffValue > 0 && !isOverAmount && (
              <p className="text-xs text-amber-600">
                سيتم شطب كامل المبلغ المتبقي وإغلاق المعاملة
              </p>
            )}
          </div>

          {/* Reason Type */}
          <div className="space-y-2">
            <Label htmlFor="reasonType">سبب الشطب</Label>
            <Select value={reasonType} onValueChange={setReasonType}>
              <SelectTrigger>
                <SelectValue placeholder="اختر سبب الشطب" />
              </SelectTrigger>
              <SelectContent>
                {WRITEOFF_REASONS.map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason Details */}
          <div className="space-y-2">
            <Label htmlFor="reasonDetails">تفاصيل إضافية (اختياري)</Label>
            <Textarea
              id="reasonDetails"
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              placeholder="أي تفاصيل إضافية عن سبب الشطب..."
              rows={2}
            />
          </div>

          {/* Confirmation Checkbox */}
          <div className="flex items-center space-x-2 space-x-reverse">
            <input
              type="checkbox"
              id="confirm"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="confirm" className="text-sm cursor-pointer">
              أؤكد أنني أريد شطب هذا المبلغ كدين معدوم
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={loading || !confirmed || isOverAmount || writeoffValue <= 0}
            >
              {loading ? "جاري الشطب..." : "شطب الدين"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
