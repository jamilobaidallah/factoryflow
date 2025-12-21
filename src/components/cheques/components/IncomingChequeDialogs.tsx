"use client";

import { useState, useMemo, useEffect } from "react";
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
import { ChevronDown } from "lucide-react";
import { Cheque } from "../types/cheques";

interface ClientInfo {
  name: string;
  source: 'ledger' | 'partner' | 'client' | 'both' | 'multiple';
  balance?: number;
  hasBalance?: boolean;
}

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
  transactionId: string;
  setTransactionId: (id: string) => void;
  loading: boolean;
  onEndorse: () => void;
  clients?: ClientInfo[];
  clientsLoading?: boolean;
}

export function EndorseDialog({
  isOpen,
  onClose,
  cheque,
  supplierName,
  setSupplierName,
  transactionId,
  setTransactionId,
  loading,
  onEndorse,
  clients = [],
  clientsLoading = false,
}: EndorseDialogProps) {
  const [showDropdown, setShowDropdown] = useState(false);

  // Filter clients based on search input, excluding the original cheque client
  const filteredClients = useMemo(() => {
    const baseClients = clients.filter(
      (client) => client.name !== cheque?.clientName
    );
    if (!supplierName.trim()) {
      return baseClients;
    }
    const searchTerm = supplierName.toLowerCase();
    return baseClients.filter((client) =>
      client.name.toLowerCase().includes(searchTerm)
    );
  }, [clients, supplierName, cheque?.clientName]);

  const handleClientSelect = (clientName: string) => {
    setSupplierName(clientName);
    setShowDropdown(false);
  };

  // Close dropdown when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setShowDropdown(false);
    }
  }, [isOpen]);

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
                  ⚠️ سيتم تسجيل دفعة للعميل وللمورد وتحديث أرصدة الذمم تلقائياً
                </p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2 relative">
            <Label htmlFor="endorseToSupplier">اسم المورد المظهر له الشيك</Label>
            <div className="relative">
              <Input
                id="endorseToSupplier"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder={clientsLoading ? "جاري التحميل..." : "اختر أو ابحث عن مورد..."}
                autoComplete="off"
                required
              />
              <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {showDropdown && !clientsLoading && (
              <div className="absolute z-[100] w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredClients.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                    {clients.length === 0 ? "لا يوجد عملاء/موردين" : "لا توجد نتائج"}
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
                        {client.hasBalance && client.balance !== 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            client.balance && client.balance > 0
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {client.balance && client.balance > 0 ? 'له: ' : 'عليه: '}
                            {Math.abs(client.balance || 0).toFixed(2)}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">
                          {client.source === 'ledger' ? 'دفتر' : client.source === 'partner' ? 'شريك' : client.source === 'client' ? 'عميل' : 'متعدد'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
                {/* Option to add new supplier manually */}
                {supplierName.trim() && !clients.some(c => c.name === supplierName.trim()) && (
                  <button
                    type="button"
                    onClick={() => setShowDropdown(false)}
                    className="w-full px-3 py-2 text-right text-sm border-t hover:bg-blue-50 text-blue-600"
                  >
                    + استخدام &quot;{supplierName}&quot; كاسم جديد
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="endorseTransactionId">
              رقم معاملة المورد <span className="text-red-500">*</span>
              <span className="text-xs text-gray-500 block mt-1">
                مطلوب لتحديث رصيد ذمة المورد في دفتر الأستاذ
              </span>
            </Label>
            <Input
              id="endorseTransactionId"
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="TXN-20250109-123456-789"
              required
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            إلغاء
          </Button>
          <Button type="button" onClick={onEndorse} disabled={loading || !supplierName.trim() || !transactionId.trim()}>
            {loading ? "جاري التظهير..." : "تظهير الشيك"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
