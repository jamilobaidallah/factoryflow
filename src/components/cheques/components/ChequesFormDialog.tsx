"use client";

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
import { Upload, X } from "lucide-react";
import { Cheque, ChequeFormData } from "../types/cheques";

interface ChequesFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingCheque: Cheque | null;
  formData: ChequeFormData;
  setFormData: React.Dispatch<React.SetStateAction<ChequeFormData>>;
  chequeImage: File | null;
  setChequeImage: React.Dispatch<React.SetStateAction<File | null>>;
  imagePreview: string | null;
  setImagePreview: React.Dispatch<React.SetStateAction<string | null>>;
  loading: boolean;
  uploadingImage: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function ChequesFormDialog({
  isOpen,
  onClose,
  editingCheque,
  formData,
  setFormData,
  chequeImage,
  setChequeImage,
  imagePreview,
  setImagePreview,
  loading,
  uploadingImage,
  onSubmit,
}: ChequesFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingCheque ? "تعديل الشيك" : "إضافة شيك جديد"}
          </DialogTitle>
          <DialogDescription>
            {editingCheque
              ? "قم بتعديل بيانات الشيك أدناه"
              : "أدخل بيانات الشيك الجديد أدناه"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chequeNumber">رقم الشيك</Label>
                <Input
                  id="chequeNumber"
                  value={formData.chequeNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, chequeNumber: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientName">اسم العميل</Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) =>
                    setFormData({ ...formData, clientName: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">المبلغ (دينار)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bankName">اسم البنك</Label>
                <Input
                  id="bankName"
                  value={formData.bankName}
                  onChange={(e) =>
                    setFormData({ ...formData, bankName: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">النوع</Label>
                <select
                  id="type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="وارد">وارد</option>
                  <option value="صادر">صادر</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">الحالة</Label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="قيد الانتظار">قيد الانتظار</option>
                  <option value="تم الصرف">تم الصرف</option>
                  <option value="مرفوض">مرفوض</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="issueDate">تاريخ الإصدار</Label>
                <Input
                  id="issueDate"
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, issueDate: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">تاريخ الاستحقاق</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) =>
                    setFormData({ ...formData, dueDate: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="linkedTransactionId">رقم المعاملة المرتبطة (اختياري)</Label>
              <Input
                id="linkedTransactionId"
                value={formData.linkedTransactionId}
                onChange={(e) =>
                  setFormData({ ...formData, linkedTransactionId: e.target.value })
                }
                placeholder="TXN-20250109-123456-789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chequeImage">صورة الشيك (اختياري)</Label>
              <div className="space-y-2">
                {imagePreview && (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="معاينة صورة الشيك"
                      className="max-h-32 rounded-md border object-contain"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={() => {
                        setChequeImage(null);
                        setImagePreview(null);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    id="chequeImage"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setChequeImage(file);
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setImagePreview(reader.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="cursor-pointer"
                  />
                  <Upload className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-500">
                  {editingCheque?.chequeImageUrl && !chequeImage
                    ? "الصورة الحالية محفوظة. اختر صورة جديدة لاستبدالها"
                    : "يمكنك رفع صورة الشيك بصيغة JPG أو PNG"}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
            >
              إلغاء
            </Button>
            <Button type="submit" disabled={loading || uploadingImage}>
              {uploadingImage ? "جاري رفع الصورة..." : loading ? "جاري الحفظ..." : editingCheque ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
