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
import { Upload, X, ChevronDown } from "lucide-react";
import { Cheque, ChequeFormData } from "../types/cheques";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR } from "@/lib/constants";

interface ClientInfo {
  name: string;
  source: 'ledger' | 'partner' | 'both';
  hasOutstandingDebt?: boolean;
  totalOutstanding?: number;
}

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
  /** List of clients for autocomplete dropdown */
  clients?: ClientInfo[];
  /** Loading state for clients */
  clientsLoading?: boolean;
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
  clients = [],
  clientsLoading = false,
}: ChequesFormDialogProps) {
  // Client dropdown state
  const [showClientDropdown, setShowClientDropdown] = useState(false);

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

  const handleClientSelect = (clientName: string) => {
    setFormData({ ...formData, clientName });
    setShowClientDropdown(false);
  };

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
              <div className="space-y-2 relative">
                <Label htmlFor="clientName">اسم العميل</Label>
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
                  <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredClients.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500 text-center">
                        {clients.length === 0 ? "لا يوجد عملاء" : "لا توجد نتائج"}
                      </div>
                    ) : (
                      filteredClients.map((client) => (
                        <button
                          key={client.name}
                          type="button"
                          onClick={() => handleClientSelect(client.name)}
                          className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 flex items-center justify-between"
                        >
                          <span>{client.name}</span>
                          <div className="flex items-center gap-1">
                            {client.hasOutstandingDebt && (
                              <span className="text-xs px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                                ذمم: {client.totalOutstanding?.toFixed(2)}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {client.source === 'ledger' ? 'دفتر' : client.source === 'partner' ? 'شريك' : 'دفتر+شريك'}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                    {/* Option to add new client manually */}
                    {formData.clientName.trim() && !clients.some(c => c.name === formData.clientName.trim()) && (
                      <button
                        type="button"
                        onClick={() => setShowClientDropdown(false)}
                        className="w-full px-3 py-2 text-right text-sm border-t hover:bg-blue-50 text-blue-600"
                      >
                        + استخدام &quot;{formData.clientName}&quot; كاسم جديد
                      </button>
                    )}
                  </div>
                )}
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
                  <option value={CHEQUE_TYPES.INCOMING}>{CHEQUE_TYPES.INCOMING}</option>
                  <option value={CHEQUE_TYPES.OUTGOING}>{CHEQUE_TYPES.OUTGOING}</option>
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
                  <option value={CHEQUE_STATUS_AR.PENDING}>{CHEQUE_STATUS_AR.PENDING}</option>
                  <option value={CHEQUE_STATUS_AR.CASHED}>{CHEQUE_STATUS_AR.CASHED}</option>
                  <option value={CHEQUE_STATUS_AR.BOUNCED}>{CHEQUE_STATUS_AR.BOUNCED}</option>
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
