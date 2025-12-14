"use client";

import { memo } from "react";
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
import { PAYMENT_CATEGORIES } from "../constants/payments.constants";
import type { Payment } from "./PaymentsTable";

export interface PaymentFormData {
  clientName: string;
  amount: string;
  type: string;
  linkedTransactionId: string;
  date: string;
  notes: string;
  category: string;
  subCategory: string;
}

interface PaymentsFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingPayment: Payment | null;
  formData: PaymentFormData;
  setFormData: (data: PaymentFormData) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

function PaymentsFormDialogComponent({
  isOpen,
  onClose,
  editingPayment,
  formData,
  setFormData,
  loading,
  onSubmit,
}: PaymentsFormDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingPayment ? "تعديل المدفوعة" : "إضافة مدفوعة جديدة"}
          </DialogTitle>
          <DialogDescription>
            {editingPayment
              ? "قم بتعديل بيانات المدفوعة أدناه"
              : "أدخل بيانات المدفوعة الجديدة أدناه"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
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
                <option value="قبض">قبض</option>
                <option value="صرف">صرف</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">الفئة (اختياري)</Label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => {
                  setFormData({ ...formData, category: e.target.value, subCategory: "" });
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">اختر الفئة</option>
                {PAYMENT_CATEGORIES.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            {formData.category && (
              <div className="space-y-2">
                <Label htmlFor="subCategory">الفئة الفرعية (اختياري)</Label>
                <select
                  id="subCategory"
                  value={formData.subCategory}
                  onChange={(e) =>
                    setFormData({ ...formData, subCategory: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">اختر الفئة الفرعية</option>
                  {PAYMENT_CATEGORIES.find(c => c.name === formData.category)?.subcategories.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
              <Label htmlFor="date">التاريخ</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
              />
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
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : editingPayment ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const PaymentsFormDialog = memo(PaymentsFormDialogComponent);
