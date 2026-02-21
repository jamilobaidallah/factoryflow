"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { createLedgerService } from "@/services/ledgerService";
import { LedgerEntry } from "../utils/ledger-constants";
import { safeAdd, parseAmount } from "@/lib/currency";

interface QuickPayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntry | null;
  onSuccess?: () => void;
}

// Common discount reasons
const DISCOUNT_REASONS = [
  { value: "early_payment", label: "خصم سداد مبكر" },
  { value: "settlement", label: "خصم تسوية" },
  { value: "loyalty", label: "خصم ولاء عميل" },
  { value: "damage", label: "خصم عيب/تلف" },
  { value: "other", label: "سبب آخر" },
] as const;

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function QuickPayDialog({ isOpen, onClose, entry, onSuccess }: QuickPayDialogProps) {
  const { user, role } = useUser();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateString);
  const [loading, setLoading] = useState(false);

  // Calculate totals and validation
  const calculations = useMemo(() => {
    const paymentValue = parseAmount(amount) || 0;
    const discountValue = parseAmount(discountAmount) || 0;
    const totalSettlement = safeAdd(paymentValue, discountValue);
    const remaining = entry?.remainingBalance ?? 0;
    const isOverpaying = totalSettlement > remaining;
    const willFullySettle = Math.abs(totalSettlement - remaining) < 0.01;

    return {
      paymentValue,
      discountValue,
      totalSettlement,
      remaining,
      isOverpaying,
      willFullySettle,
    };
  }, [amount, discountAmount, entry?.remainingBalance]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !entry) { return; }

    const { paymentValue, discountValue, totalSettlement, remaining, isOverpaying } = calculations;

    // Validate: at least one of payment or discount must be positive
    if (paymentValue <= 0 && discountValue <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ دفعة أو خصم",
        variant: "destructive",
      });
      return;
    }

    // Validate: total cannot exceed remaining
    if (isOverpaying) {
      toast({
        title: "خطأ في المبلغ",
        description: `المجموع (${totalSettlement.toFixed(2)}) أكبر من المتبقي (${remaining.toFixed(2)})`,
        variant: "destructive",
      });
      return;
    }

    // Validate: discount reason required if discount given
    if (discountValue > 0 && !discountReason) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار سبب الخصم",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const service = createLedgerService(user.dataOwnerId, user.email || '', role || 'owner');

      // Get the display label for the discount reason
      const discountReasonLabel = discountValue > 0
        ? DISCOUNT_REASONS.find(r => r.value === discountReason)?.label || discountReason
        : undefined;

      const result = await service.addQuickPayment({
        amount: paymentValue,
        entryId: entry.id,
        entryTransactionId: entry.transactionId,
        entryType: entry.type,
        entryAmount: entry.amount,
        entryDescription: entry.description,
        entryCategory: entry.category,
        entrySubCategory: entry.subCategory,
        associatedParty: entry.associatedParty,
        totalPaid: entry.totalPaid || 0,
        totalDiscount: entry.totalDiscount || 0,
        remainingBalance: entry.remainingBalance || entry.amount,
        isARAPEntry: entry.isARAPEntry || false,
        date: new Date(paymentDate),
        discountAmount: discountValue > 0 ? discountValue : undefined,
        discountReason: discountReasonLabel,
      });

      if (result.success) {
        const successMessage = discountValue > 0
          ? `تم إضافة دفعة بمبلغ ${paymentValue.toFixed(2)} وخصم ${discountValue.toFixed(2)} دينار`
          : `تم إضافة دفعة بمبلغ ${paymentValue.toFixed(2)} دينار`;

        toast({
          title: "تمت الإضافة بنجاح",
          description: successMessage,
        });

        // Reset form
        setAmount("");
        setDiscountAmount("");
        setDiscountReason("");
        setPaymentDate(getTodayDateString());
        onClose();
        onSuccess?.();
      } else {
        toast({
          title: "خطأ",
          description: result.error || "حدث خطأ أثناء إضافة الدفعة",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إضافة الدفعة",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper to set full settlement (payment = remaining - discount, or just remaining if no discount)
  const handleFullSettlement = () => {
    const discountValue = parseAmount(discountAmount) || 0;
    const remaining = entry?.remainingBalance ?? 0;
    const paymentNeeded = Math.max(0, remaining - discountValue);
    setAmount(paymentNeeded.toFixed(2));
  };

  // Helper to set full discount (no cash payment)
  const handleFullDiscount = () => {
    const remaining = entry?.remainingBalance ?? 0;
    setDiscountAmount(remaining.toFixed(2));
    setAmount("0");
  };

  const { discountValue, totalSettlement, remaining, isOverpaying, willFullySettle } = calculations;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة دفعة</DialogTitle>
          <DialogDescription>
            إضافة دفعة جديدة للمعاملة (مع إمكانية إضافة خصم تسوية)
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="space-y-2 px-6 mb-4">
            <div className="text-sm">
              <span className="font-medium">المعاملة:</span> {entry.description}
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
            {entry.totalDiscount && entry.totalDiscount > 0 && (
              <div className="text-sm">
                <span className="font-medium">الخصومات السابقة:</span> {entry.totalDiscount.toFixed(2)} دينار
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4 px-6">
          {/* Payment Amount */}
          <div className="space-y-2">
            <Label htmlFor="quickPayAmount">المبلغ المدفوع</Label>
            <div className="flex gap-2">
              <Input
                id="quickPayAmount"
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
                  onClick={handleFullSettlement}
                >
                  {discountValue > 0 ? "تسوية كاملة" : "دفع الكل"}
                </Button>
              )}
            </div>
          </div>

          {/* Discount Amount */}
          <div className="space-y-2">
            <Label htmlFor="discountAmount">خصم تسوية (اختياري)</Label>
            <div className="flex gap-2">
              <Input
                id="discountAmount"
                type="number"
                step="0.01"
                min="0"
                placeholder="مبلغ الخصم"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
                className="flex-1"
              />
              {entry?.remainingBalance !== undefined && entry.remainingBalance > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFullDiscount}
                >
                  خصم كامل
                </Button>
              )}
            </div>
          </div>

          {/* Discount Reason (shown only when discount entered) */}
          {discountValue > 0 && (
            <div className="space-y-2">
              <Label htmlFor="discountReason">سبب الخصم</Label>
              <Select value={discountReason} onValueChange={setDiscountReason}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر سبب الخصم" />
                </SelectTrigger>
                <SelectContent>
                  {DISCOUNT_REASONS.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Real-time Calculation Summary */}
          {(calculations.paymentValue > 0 || discountValue > 0) && (
            <div className={`p-3 rounded-md text-sm ${isOverpaying ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex justify-between">
                <span>المدفوع:</span>
                <span>{calculations.paymentValue.toFixed(2)} د.أ</span>
              </div>
              {discountValue > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>الخصم:</span>
                  <span>{discountValue.toFixed(2)} د.أ</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t pt-1 mt-1">
                <span>المجموع:</span>
                <span className={isOverpaying ? 'text-red-600' : ''}>{totalSettlement.toFixed(2)} د.أ</span>
              </div>
              {isOverpaying && (
                <p className="text-red-600 text-xs mt-1">
                  المجموع أكبر من المتبقي ({remaining.toFixed(2)} د.أ)
                </p>
              )}
              {willFullySettle && !isOverpaying && (
                <p className="text-green-600 text-xs mt-1">
                  سيتم تسوية المعاملة بالكامل
                </p>
              )}
            </div>
          )}

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate">تاريخ الدفعة</Label>
            <Input
              id="paymentDate"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading || isOverpaying}>
              {loading ? "جاري الإضافة..." : (entry && willFullySettle) ? "تسوية كاملة" : "إضافة الدفعة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
