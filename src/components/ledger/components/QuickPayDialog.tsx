"use client";

import { useState } from "react";
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
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { createLedgerService } from "@/services/ledgerService";
import { LedgerEntry } from "../utils/ledger-constants";

interface QuickPayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntry | null;
  onSuccess?: () => void;
}

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

export function QuickPayDialog({ isOpen, onClose, entry, onSuccess }: QuickPayDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateString);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !entry) { return; }

    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح",
        variant: "destructive",
      });
      return;
    }

    // Validate payment amount
    if (entry.remainingBalance !== undefined && paymentAmount > entry.remainingBalance) {
      toast({
        title: "خطأ في المبلغ",
        description: `المبلغ المتبقي هو ${entry.remainingBalance.toFixed(2)} دينار فقط`,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const service = createLedgerService(user.uid);

      const result = await service.addQuickPayment({
        amount: paymentAmount,
        entryId: entry.id,
        entryTransactionId: entry.transactionId,
        entryType: entry.type,
        entryAmount: entry.amount,
        entryDescription: entry.description,
        entryCategory: entry.category,
        entrySubCategory: entry.subCategory,
        associatedParty: entry.associatedParty,
        totalPaid: entry.totalPaid || 0,
        remainingBalance: entry.remainingBalance || entry.amount,
        isARAPEntry: entry.isARAPEntry || false,
        date: new Date(paymentDate),
      });

      if (result.success) {
        toast({
          title: "تمت الإضافة بنجاح",
          description: `تم إضافة دفعة بمبلغ ${paymentAmount.toFixed(2)} دينار`,
        });

        setAmount("");
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>إضافة دفعة</DialogTitle>
          <DialogDescription>
            إضافة دفعة جديدة للمعاملة
          </DialogDescription>
        </DialogHeader>
        {entry && (
          <div className="space-y-2 mb-4">
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
                <span className="font-medium">المدفوع:</span> {entry.totalPaid.toFixed(2)} دينار
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quickPayAmount">المبلغ المدفوع</Label>
            <div className="flex gap-2">
              <Input
                id="quickPayAmount"
                type="number"
                step="0.01"
                placeholder="أدخل المبلغ"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1"
                required
              />
              {entry?.remainingBalance !== undefined && entry.remainingBalance > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAmount(entry.remainingBalance!.toFixed(2))}
                >
                  دفع الكل
                </Button>
              )}
            </div>
            {entry?.remainingBalance !== undefined && entry.remainingBalance > 0 && (
              <p className="text-xs text-gray-500">
                الحد الأقصى: {entry.remainingBalance.toFixed(2)} دينار
              </p>
            )}
          </div>
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
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الإضافة..." : "إضافة الدفعة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
