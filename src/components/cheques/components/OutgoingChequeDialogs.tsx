"use client";

import Image from "next/image";
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
import { Cheque } from "../types/cheques";

interface ImageViewerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

export function ImageViewerDialog({ isOpen, onClose, imageUrl }: ImageViewerDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>صورة الشيك</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center p-4">
          {imageUrl && (
            <div className="relative w-full h-[70vh]">
              <Image
                src={imageUrl}
                alt="Cheque"
                fill
                className="object-contain rounded-lg shadow-lg"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
          >
            إغلاق
          </Button>
          {imageUrl && (
            <Button
              type="button"
              onClick={() => window.open(imageUrl, '_blank')}
            >
              فتح في تبويب جديد
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LinkTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: Cheque | null;
  transactionId: string;
  setTransactionId: (id: string) => void;
  loading: boolean;
  onLink: () => void;
}

export function LinkTransactionDialog({
  isOpen,
  onClose,
  cheque,
  transactionId,
  setTransactionId,
  loading,
  onLink,
}: LinkTransactionDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ربط الشيك بفاتورة المورد</DialogTitle>
          <DialogDescription>
            {cheque && (
              <div className="text-sm mt-2 space-y-1">
                <p><strong>رقم الشيك:</strong> {cheque.chequeNumber}</p>
                <p><strong>المورد:</strong> {cheque.clientName}</p>
                <p><strong>المبلغ:</strong> {cheque.amount} دينار</p>
                <p className="text-blue-600 mt-2">
                  💡 أدخل رقم المعاملة من دفتر الأستاذ لربط الشيك بفاتورة المورد
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="linkTransactionId">
              رقم المعاملة / الفاتورة
              <span className="text-xs text-gray-500 block mt-1">
                اتركه فارغاً لإلغاء الربط
              </span>
            </Label>
            <Input
              id="linkTransactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="TXN-20250109-123456-789"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={onLink}
            disabled={loading}
          >
            {loading ? "جاري الحفظ..." : "حفظ الربط"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
