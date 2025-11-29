import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface PaymentDateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentDate: Date) => void;
  defaultDate: Date;
  chequeNumber: string;
}

export function PaymentDateModal({
  isOpen,
  onClose,
  onConfirm,
  defaultDate,
  chequeNumber,
}: PaymentDateModalProps) {
  const [paymentDate, setPaymentDate] = useState<string>(
    defaultDate.toISOString().split('T')[0]
  );

  const handleConfirm = () => {
    const selectedDate = new Date(paymentDate);
    onConfirm(selectedDate);
  };

  const handleCancel = () => {
    // Reset to default date when cancelled
    setPaymentDate(defaultDate.toISOString().split('T')[0]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>تاريخ الصرف</DialogTitle>
          <DialogDescription>
            حدد تاريخ صرف الشيك رقم {chequeNumber}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="payment-date" className="text-right">
              التاريخ
            </Label>
            <Input
              id="payment-date"
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="col-span-3"
              dir="ltr"
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            إلغاء
          </Button>
          <Button type="button" onClick={handleConfirm}>
            تأكيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
