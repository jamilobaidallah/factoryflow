"use client";

import { memo, useState, useMemo, useEffect } from "react";
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
import { ChevronDown } from "lucide-react";
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

interface ClientInfo {
  name: string;
  balance?: number;
  hasBalance?: boolean;
}

interface PaymentsFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingPayment: Payment | null;
  formData: PaymentFormData;
  setFormData: (data: PaymentFormData) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
  /** List of clients/partners for dropdown */
  clients?: ClientInfo[];
  /** Whether clients are loading */
  clientsLoading?: boolean;
}

function PaymentsFormDialogComponent({
  isOpen,
  onClose,
  editingPayment,
  formData,
  setFormData,
  loading,
  onSubmit,
  clients = [],
  clientsLoading = false,
}: PaymentsFormDialogProps) {
  // State for client dropdown
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  // Reset dropdown state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setShowClientDropdown(false);
    }
  }, [isOpen]);

  // Filter clients based on search input
  const filteredClients = useMemo(() => {
    if (!formData.clientName.trim()) {
      return clients;
    }
    const searchTerm = formData.clientName.toLowerCase();
    return clients.filter((client) =>
      client.name.toLowerCase().includes(searchTerm)
    );
  }, [clients, formData.clientName]);

  // Handle client selection from dropdown
  const handleClientSelect = (name: string) => {
    setFormData({ ...formData, clientName: name });
    setShowClientDropdown(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
          <div className="grid gap-4 px-6 py-4">
            <div className="space-y-2 relative">
              <Label htmlFor="clientName">اسم العميل / المورد</Label>
              <div className="relative">
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => {
                    setFormData({ ...formData, clientName: e.target.value });
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder={clientsLoading ? "جاري التحميل..." : "اختر أو ابحث..."}
                  autoComplete="off"
                  required
                />
                <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              {showClientDropdown && !clientsLoading && (
                <div className="absolute z-[100] w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredClients.length === 0 && !formData.clientName.trim() ? (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                      لا يوجد عملاء/موردين
                    </div>
                  ) : filteredClients.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                      لا توجد نتائج
                    </div>
                  ) : (
                    filteredClients.slice(0, 15).map((client) => (
                      <button
                        key={client.name}
                        type="button"
                        onClick={() => handleClientSelect(client.name)}
                        className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 flex items-center justify-between"
                      >
                        <span>{client.name}</span>
                        {client.hasBalance && client.balance !== 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            client.balance && client.balance > 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {client.balance && client.balance > 0 ? 'عليه: ' : 'له: '}
                            {Math.abs(client.balance || 0).toFixed(2)}
                          </span>
                        )}
                      </button>
                    ))
                  )}
                  {formData.clientName.trim() && !clients.some(c => c.name === formData.clientName.trim()) && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowClientDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-right text-sm border-t hover:bg-blue-50 text-blue-600"
                    >
                      + استخدام &quot;{formData.clientName}&quot; كاسم جديد
                    </button>
                  )}
                </div>
              )}
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
