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
import { collection, addDoc, doc, updateDoc } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { LedgerEntry } from "../utils/ledger-constants";

interface QuickPayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  entry: LedgerEntry | null;
  onSuccess?: () => void;
}

export function QuickPayDialog({ isOpen, onClose, entry, onSuccess }: QuickPayDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !entry) return;

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
      const paymentType = entry.type === "دخل" ? "قبض" : "صرف";

      // Add payment record
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      await addDoc(paymentsRef, {
        clientName: entry.associatedParty || "غير محدد",
        amount: paymentAmount,
        type: paymentType,
        linkedTransactionId: entry.transactionId,
        date: new Date(),
        notes: `دفعة جزئية - ${entry.description}`,
        category: entry.category,
        subCategory: entry.subCategory,
        createdAt: new Date(),
      });

      // Update ledger entry AR/AP tracking
      const newTotalPaid = (entry.totalPaid || 0) + paymentAmount;
      const newRemainingBalance = entry.amount - newTotalPaid;
      const newStatus = newRemainingBalance === 0 ? "paid" : newRemainingBalance < entry.amount ? "partial" : "unpaid";

      const ledgerEntryRef = doc(firestore, `users/${user.uid}/ledger`, entry.id);
      await updateDoc(ledgerEntryRef, {
        totalPaid: newTotalPaid,
        remainingBalance: newRemainingBalance,
        paymentStatus: newStatus,
      });

      toast({
        title: "تمت الإضافة بنجاح",
        description: `تم إضافة دفعة بمبلغ ${paymentAmount.toFixed(2)} دينار`,
      });

      setAmount("");
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error("Error adding quick payment:", error);
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
            <Input
              id="quickPayAmount"
              type="number"
              step="0.01"
              placeholder="أدخل المبلغ"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            {entry && entry.remainingBalance && (
              <p className="text-xs text-gray-500">
                الحد الأقصى: {entry.remainingBalance.toFixed(2)} دينار
              </p>
            )}
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
