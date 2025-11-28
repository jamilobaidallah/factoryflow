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
                unoptimized
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          {imageUrl && (
            <Button type="button" onClick={() => window.open(imageUrl, '_blank')}>
              فتح في تبويب جديد
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EndorseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: Cheque | null;
  supplierName: string;
  setSupplierName: (name: string) => void;
  loading: boolean;
  onEndorse: () => void;
}

export function EndorseDialog({
  isOpen,
  onClose,
  cheque,
  supplierName,
  setSupplierName,
  loading,
  onEndorse,
}: EndorseDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تظهير الشيك</DialogTitle>
          <DialogDescription>
            {cheque && (
              <div className="text-sm mt-2 space-y-1">
                <p><strong>رقم الشيك:</strong> {cheque.chequeNumber}</p>
                <p><strong>من العميل:</strong> {cheque.clientName}</p>
                <p><strong>المبلغ:</strong> {cheque.amount} دينار</p>
                <p className="text-amber-600 mt-2">
                  سيتم تسجيل دفعة للعميل وللمورد دون حركة نقدية فعلية
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="endorseToSupplier">اسم المورد المظهر له الشيك</Label>
            <Input
              id="endorseToSupplier"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="أدخل اسم المورد"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button type="button" onClick={onEndorse} disabled={loading || !supplierName.trim()}>
            {loading ? "جاري التظهير..." : "تظهير الشيك"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ClearChequeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: Cheque | null;
  loading: boolean;
  onClear: () => void;
}

export function ClearChequeDialog({
  isOpen,
  onClose,
  cheque,
  loading,
  onClear,
}: ClearChequeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تأكيد تحصيل الشيك</DialogTitle>
          <DialogDescription>
            {cheque && (
              <div className="text-sm mt-2 space-y-1">
                <p><strong>رقم الشيك:</strong> {cheque.chequeNumber}</p>
                <p><strong>العميل:</strong> {cheque.clientName}</p>
                <p><strong>المبلغ:</strong> {cheque.amount} دينار</p>
                <p><strong>تاريخ الاستحقاق:</strong> {new Date(cheque.dueDate).toLocaleDateString("ar-EG")}</p>
                <p className="text-green-600 mt-2">
                  سيتم تحديث حالة الشيك إلى &quot;تم الصرف&quot; وتسجيل دفعة وتحديث رصيد العميل
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={onClear}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "جاري التحصيل..." : "تأكيد التحصيل"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BounceChequeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cheque: Cheque | null;
  loading: boolean;
  onBounce: () => void;
}

export function BounceChequeDialog({
  isOpen,
  onClose,
  cheque,
  loading,
  onBounce,
}: BounceChequeDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>تسجيل شيك مرتجع</DialogTitle>
          <DialogDescription>
            {cheque && (
              <div className="text-sm mt-2 space-y-1">
                <p><strong>رقم الشيك:</strong> {cheque.chequeNumber}</p>
                <p><strong>العميل:</strong> {cheque.clientName}</p>
                <p><strong>المبلغ:</strong> {cheque.amount} دينار</p>
                <p><strong>تاريخ الاستحقاق:</strong> {new Date(cheque.dueDate).toLocaleDateString("ar-EG")}</p>
                <p className="text-red-600 mt-2">
                  سيتم تسجيل الشيك كمرتجع. رصيد العميل لن يتغير - لا يزال مديناً بالمبلغ.
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button type="button" onClick={onBounce} disabled={loading} variant="destructive">
            {loading ? "جاري التسجيل..." : "تسجيل كمرتجع"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
