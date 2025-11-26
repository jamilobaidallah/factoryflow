/**
 * RelatedRecordsDialog - Dialog for managing payments, cheques, and inventory records
 * linked to a ledger entry. Extracted from ledger-page.tsx for better maintainability.
 */

import { LedgerEntry } from "../utils/ledger-constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RelatedRecordsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedEntry: LedgerEntry | null;
  relatedTab: "payments" | "cheques" | "inventory";
  setRelatedTab: (tab: "payments" | "cheques" | "inventory") => void;
  loading: boolean;
  // Handlers
  onAddPayment: (e: React.FormEvent) => void;
  onAddCheque: (e: React.FormEvent) => void;
  onAddInventory: (e: React.FormEvent) => void;
  // Form data
  paymentFormData: any;
  setPaymentFormData: (data: any) => void;
  chequeFormData: any;
  setChequeFormData: (data: any) => void;
  inventoryFormData: any;
  setInventoryFormData: (data: any) => void;
}

export function RelatedRecordsDialog({
  isOpen,
  onClose,
  selectedEntry,
  relatedTab,
  setRelatedTab,
  loading,
  onAddPayment,
  onAddCheque,
  onAddInventory,
  paymentFormData,
  setPaymentFormData,
  chequeFormData,
  setChequeFormData,
  inventoryFormData,
  setInventoryFormData,
}: RelatedRecordsDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إدارة السجلات المرتبطة بالمعاملة</DialogTitle>
          <DialogDescription>
            {selectedEntry && (
              <div className="text-sm">
                <p><strong>الوصف:</strong> {selectedEntry.description}</p>
                <p><strong>رقم المعاملة:</strong> <span className="font-mono">{selectedEntry.transactionId}</span></p>
                <p><strong>المبلغ:</strong> {selectedEntry.amount} دينار</p>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Tabs for different record types */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setRelatedTab("payments")}
              className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                relatedTab === "payments"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              الدفعات
            </button>
            <button
              onClick={() => setRelatedTab("cheques")}
              className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                relatedTab === "cheques"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              الشيكات
            </button>
            <button
              onClick={() => setRelatedTab("inventory")}
              className={`pb-2 px-1 border-b-2 font-medium text-sm ${
                relatedTab === "inventory"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              المخزون
            </button>
          </nav>
        </div>

        <div className="py-4">
          {/* Payments Tab */}
          {relatedTab === "payments" && (
            <div className="space-y-4">
              <h3 className="font-semibold">إضافة دفعة جديدة</h3>
              <form onSubmit={onAddPayment} className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="paymentAmount">المبلغ (دينار)</Label>
                    <Input
                      id="paymentAmount"
                      type="number"
                      step="0.01"
                      value={paymentFormData.amount}
                      onChange={(e) =>
                        setPaymentFormData({ ...paymentFormData, amount: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="paymentNotes">ملاحظات</Label>
                    <Input
                      id="paymentNotes"
                      value={paymentFormData.notes}
                      onChange={(e) =>
                        setPaymentFormData({ ...paymentFormData, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "جاري الإضافة..." : "إضافة دفعة"}
                </Button>
              </form>
            </div>
          )}

          {/* Cheques Tab */}
          {relatedTab === "cheques" && (
            <div className="space-y-4">
              <h3 className="font-semibold">إضافة شيك جديد</h3>
              <form onSubmit={onAddCheque} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chequeNumber">رقم الشيك</Label>
                      <Input
                        id="chequeNumber"
                        value={chequeFormData.chequeNumber}
                        onChange={(e) =>
                          setChequeFormData({ ...chequeFormData, chequeNumber: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chequeAmount">المبلغ (دينار)</Label>
                      <Input
                        id="chequeAmount"
                        type="number"
                        step="0.01"
                        value={chequeFormData.amount}
                        onChange={(e) =>
                          setChequeFormData({ ...chequeFormData, amount: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chequeBankName">اسم البنك</Label>
                      <Input
                        id="chequeBankName"
                        value={chequeFormData.bankName}
                        onChange={(e) =>
                          setChequeFormData({ ...chequeFormData, bankName: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chequeDueDate">تاريخ الاستحقاق</Label>
                      <Input
                        id="chequeDueDate"
                        type="date"
                        value={chequeFormData.dueDate}
                        onChange={(e) =>
                          setChequeFormData({ ...chequeFormData, dueDate: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="chequeType">نوع الشيك</Label>
                      <select
                        id="chequeType"
                        value={chequeFormData.chequeType}
                        onChange={(e) =>
                          setChequeFormData({ ...chequeFormData, chequeType: e.target.value })
                        }
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        required
                      >
                        <option value="عادي">شيك عادي</option>
                        <option value="مجير">شيك مجير</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="chequeStatus">الحالة</Label>
                      <select
                        id="chequeStatus"
                        value={chequeFormData.status}
                        onChange={(e) =>
                          setChequeFormData({ ...chequeFormData, status: e.target.value })
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
                  <div className="space-y-2">
                    <Label htmlFor="chequeImage">صورة الشيك</Label>
                    <Input
                      id="chequeImage"
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setChequeFormData({ ...chequeFormData, chequeImage: file });
                      }}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500">اختياري - يمكنك رفع صورة الشيك</p>
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "جاري الإضافة..." : "إضافة شيك"}
                </Button>
              </form>
            </div>
          )}

          {/* Inventory Tab */}
          {relatedTab === "inventory" && (
            <div className="space-y-4">
              <h3 className="font-semibold">إضافة حركة مخزون</h3>
              <form onSubmit={onAddInventory} className="space-y-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="itemName">اسم الصنف</Label>
                    <Input
                      id="itemName"
                      value={inventoryFormData.itemName}
                      onChange={(e) =>
                        setInventoryFormData({ ...inventoryFormData, itemName: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">الكمية</Label>
                      <Input
                        id="quantity"
                        type="number"
                        step="0.01"
                        value={inventoryFormData.quantity}
                        onChange={(e) =>
                          setInventoryFormData({ ...inventoryFormData, quantity: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">الوحدة</Label>
                      <Input
                        id="unit"
                        value={inventoryFormData.unit}
                        onChange={(e) =>
                          setInventoryFormData({ ...inventoryFormData, unit: e.target.value })
                        }
                        required
                        placeholder="كجم، قطعة، صندوق"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>الأبعاد (اختياري)</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="thickness" className="text-xs">السماكة</Label>
                        <Input
                          id="thickness"
                          type="number"
                          step="0.01"
                          value={inventoryFormData.thickness}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, thickness: e.target.value })
                          }
                          placeholder="سم"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="width" className="text-xs">العرض</Label>
                        <Input
                          id="width"
                          type="number"
                          step="0.01"
                          value={inventoryFormData.width}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, width: e.target.value })
                          }
                          placeholder="سم"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="length" className="text-xs">الطول</Label>
                        <Input
                          id="length"
                          type="number"
                          step="0.01"
                          value={inventoryFormData.length}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, length: e.target.value })
                          }
                          placeholder="سم"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invNotes">ملاحظات</Label>
                    <Input
                      id="invNotes"
                      value={inventoryFormData.notes}
                      onChange={(e) =>
                        setInventoryFormData({ ...inventoryFormData, notes: e.target.value })
                      }
                    />
                  </div>
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? "جاري الإضافة..." : "إضافة حركة مخزون"}
                </Button>
              </form>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
