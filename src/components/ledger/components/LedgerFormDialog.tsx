/**
 * LedgerFormDialog - Main form dialog for adding/editing ledger entries
 * Uses LedgerFormContext to eliminate prop drilling
 */

import { CATEGORIES } from "../utils/ledger-constants";
import { getCategoryType } from "../utils/ledger-helpers";
import { useLedgerFormContext } from "../context/LedgerFormContext";
import { CheckFormDataItem, OutgoingCheckFormDataItem } from "../types/ledger";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export function LedgerFormDialog() {
  const {
    isOpen,
    onClose,
    editingEntry,
    onSubmit,
    loading,
    clients,
    partners,
    formData,
    setFormData,
    hasIncomingCheck,
    setHasIncomingCheck,
    hasOutgoingCheck,
    setHasOutgoingCheck,
    hasInventoryUpdate,
    setHasInventoryUpdate,
    hasFixedAsset,
    setHasFixedAsset,
    hasInitialPayment,
    setHasInitialPayment,
    initialPaymentAmount,
    setInitialPaymentAmount,
    checkFormData,
    setCheckFormData,
    outgoingCheckFormData,
    setOutgoingCheckFormData,
    incomingChequesList,
    setIncomingChequesList,
    outgoingChequesList,
    setOutgoingChequesList,
    inventoryFormData,
    setInventoryFormData,
    fixedAssetFormData,
    setFixedAssetFormData,
    createInvoice,
    setCreateInvoice,
  } = useLedgerFormContext();

  // Helper functions for multiple cheques management
  const addIncomingCheque = () => {
    const newCheque: CheckFormDataItem = {
      id: Date.now().toString(),
      chequeNumber: "",
      chequeAmount: "",
      bankName: "",
      dueDate: new Date().toISOString().split("T")[0],
      accountingType: "cashed",
      endorsedToName: "",
    };
    setIncomingChequesList([...incomingChequesList, newCheque]);
  };

  const updateIncomingCheque = (id: string, field: keyof CheckFormDataItem, value: string) => {
    setIncomingChequesList(
      incomingChequesList.map((cheque) =>
        cheque.id === id ? { ...cheque, [field]: value } : cheque
      )
    );
  };

  const removeIncomingCheque = (id: string) => {
    setIncomingChequesList(incomingChequesList.filter((cheque) => cheque.id !== id));
  };

  const addOutgoingCheque = () => {
    const newCheque: OutgoingCheckFormDataItem = {
      id: Date.now().toString(),
      chequeNumber: "",
      chequeAmount: "",
      bankName: "",
      dueDate: new Date().toISOString().split("T")[0],
      accountingType: "cashed",
      endorsedFromName: "",
    };
    setOutgoingChequesList([...outgoingChequesList, newCheque]);
  };

  const updateOutgoingCheque = (id: string, field: keyof OutgoingCheckFormDataItem, value: string) => {
    setOutgoingChequesList(
      outgoingChequesList.map((cheque) =>
        cheque.id === id ? { ...cheque, [field]: value } : cheque
      )
    );
  };

  const removeOutgoingCheque = (id: string) => {
    setOutgoingChequesList(outgoingChequesList.filter((cheque) => cheque.id !== id));
  };

  const currentEntryType = getCategoryType(formData.category, formData.subCategory);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingEntry ? "تعديل الحركة المالية" : "إضافة حركة مالية جديدة"}
          </DialogTitle>
          <DialogDescription>
            {editingEntry
              ? "قم بتعديل بيانات الحركة أدناه"
              : "أدخل بيانات الحركة المالية الجديدة أدناه"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit}>
          <div className="grid gap-4 py-4">
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">الوصف</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                required
              />
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">التصنيف الرئيسي</Label>
                <select
                  id="category"
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value, subCategory: "" })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">اختر التصنيف</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.name} value={cat.name}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subCategory">الفئة الفرعية</Label>
                <select
                  id="subCategory"
                  value={formData.subCategory}
                  onChange={(e) =>
                    setFormData({ ...formData, subCategory: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                  disabled={!formData.category}
                >
                  <option value="">اختر الفئة الفرعية</option>
                  {formData.category && CATEGORIES
                    .find(cat => cat.name === formData.category)
                    ?.subcategories.map((sub) => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Associated Party */}
            <div className="space-y-2">
              <Label htmlFor="associatedParty">الطرف المعني (العميل/المورد)</Label>
              <Input
                id="associatedParty"
                list="clients-list"
                value={formData.associatedParty}
                onChange={(e) =>
                  setFormData({ ...formData, associatedParty: e.target.value })
                }
                placeholder="اختر من القائمة أو اكتب اسم جديد"
              />
              <datalist id="clients-list">
                {clients.map((client) => (
                  <option key={client.id} value={client.name} />
                ))}
              </datalist>
            </div>

            {/* Owner dropdown for capital transactions */}
            {formData.category === "رأس المال" && (
              <div className="space-y-2">
                <Label htmlFor="ownerName">اسم الشريك/المالك *</Label>
                <select
                  id="ownerName"
                  value={formData.ownerName}
                  onChange={(e) =>
                    setFormData({ ...formData, ownerName: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  <option value="">اختر الشريك</option>
                  {partners.map((partner) => (
                    <option key={partner.id} value={partner.name}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount & Date */}
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
            </div>

            {/* Reference & Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reference">رقم المرجع (اختياري)</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) =>
                    setFormData({ ...formData, reference: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                />
              </div>
            </div>

            {/* AR/AP Tracking - Only for revenue/expense entries, not for editing */}
            {!editingEntry && (currentEntryType === "دخل" || currentEntryType === "مصروف") && (
              <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                <div className="flex items-center space-x-2 space-x-reverse">
                  <input
                    type="checkbox"
                    id="trackARAP"
                    checked={formData.trackARAP}
                    onChange={(e) =>
                      setFormData({ ...formData, trackARAP: e.target.checked })
                    }
                    className="h-4 w-4"
                  />
                  <Label htmlFor="trackARAP" className="cursor-pointer">
                    تتبع الذمم (حسابات القبض/الدفع)
                  </Label>
                </div>

                {formData.trackARAP && (
                  <div className="space-y-4 pr-6">
                    {/* Immediate Settlement Option */}
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input type="checkbox"
                        id="immediateSettlement"
                        checked={formData.immediateSettlement}
                        onChange={(e) =>
                          setFormData({ ...formData, immediateSettlement: e.target.checked })
                        }
                      />
                      <Label htmlFor="immediateSettlement" className="cursor-pointer">
                        تسوية فورية (نقدي)
                      </Label>
                    </div>

                    {/* Initial Payment Option (only if not immediate settlement) */}
                    {!formData.immediateSettlement && (
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <input type="checkbox"
                            id="hasInitialPayment"
                            checked={hasInitialPayment}
                            onChange={(e) =>
                              setHasInitialPayment(e.target.checked)
                            }
                          />
                          <Label htmlFor="hasInitialPayment" className="cursor-pointer">
                            دفعة أولية
                          </Label>
                        </div>
                        {hasInitialPayment && (
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="المبلغ المدفوع"
                            value={initialPaymentAmount}
                            onChange={(e) => setInitialPaymentAmount(e.target.value)}
                            className="mr-6"
                          />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Additional Options - Only when adding new entry */}
            {!editingEntry && (
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold text-sm">خيارات إضافية</h3>

                {/* Incoming Check Option - Multiple Cheques Support */}
                {(currentEntryType === "دخل" || currentEntryType === "إيراد") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <input type="checkbox"
                          id="hasIncomingCheck"
                          checked={hasIncomingCheck}
                          onChange={(e) => {
                            setHasIncomingCheck(e.target.checked);
                            // If enabling and list is empty, add one cheque
                            if (e.target.checked && incomingChequesList.length === 0) {
                              addIncomingCheque();
                            }
                          }}
                        />
                        <Label htmlFor="hasIncomingCheck" className="cursor-pointer">
                          إضافة شيكات واردة
                        </Label>
                      </div>
                      {hasIncomingCheck && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addIncomingCheque}
                          className="flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          إضافة شيك آخر
                        </Button>
                      )}
                    </div>

                    {hasIncomingCheck && incomingChequesList.length > 0 && (
                      <div className="pr-6 space-y-4">
                        {incomingChequesList.map((cheque, index) => (
                          <div key={cheque.id} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">شيك {index + 1}</h4>
                              {incomingChequesList.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeIncomingCheque(cheque.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {/* Cheque Type Selection */}
                            <div className="space-y-2">
                              <Label>نوع الشيك المحاسبي</Label>
                              <select
                                value={cheque.accountingType || "cashed"}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "accountingType", e.target.value)
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                required
                              >
                                <option value="cashed">شيك صرف - يُصرف فوراً</option>
                                <option value="postponed">شيك مؤجل - يُصرف لاحقاً</option>
                                <option value="endorsed">شيك مظهر - تحويل لطرف ثالث</option>
                              </select>
                            </div>

                            {/* Endorsee field - only for endorsed cheques */}
                            {cheque.accountingType === 'endorsed' && (
                              <div className="space-y-2 p-3 bg-purple-50 rounded-md border border-purple-200">
                                <Label>مظهر إلى (اسم المستفيد)</Label>
                                <Input
                                  type="text"
                                  placeholder="أدخل اسم الجهة المظهر لها الشيك"
                                  value={cheque.endorsedToName || ""}
                                  onChange={(e) =>
                                    updateIncomingCheque(cheque.id, "endorsedToName", e.target.value)
                                  }
                                  required
                                />
                              </div>
                            )}

                            {/* Postponed cheque warning */}
                            {cheque.accountingType === 'postponed' && (
                              <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                                <p className="text-xs text-yellow-700">
                                  الشيك المؤجل: سيظهر في قائمة الشيكات المعلقة
                                </p>
                              </div>
                            )}

                            {/* Cheque details */}
                            <div className="grid grid-cols-2 gap-4">
                              <Input
                                type="text"
                                placeholder="رقم الشيك"
                                value={cheque.chequeNumber}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "chequeNumber", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="مبلغ الشيك"
                                value={cheque.chequeAmount}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "chequeAmount", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="text"
                                placeholder="اسم البنك"
                                value={cheque.bankName}
                                onChange={(e) =>
                                  updateIncomingCheque(cheque.id, "bankName", e.target.value)
                                }
                                required
                              />
                              <div className="space-y-1">
                                <Input
                                  type="date"
                                  value={cheque.dueDate}
                                  onChange={(e) =>
                                    updateIncomingCheque(cheque.id, "dueDate", e.target.value)
                                  }
                                  required
                                />
                                <p className="text-xs text-gray-500">تاريخ الاستحقاق</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Total cheques amount */}
                        {incomingChequesList.length > 1 && (
                          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                            <p className="text-sm font-medium text-blue-700">
                              مجموع الشيكات: {incomingChequesList.reduce((sum, c) => sum + (parseFloat(c.chequeAmount) || 0), 0).toFixed(2)} دينار
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Outgoing Check Option - Multiple Cheques Support */}
                {currentEntryType === "مصروف" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <input type="checkbox"
                          id="hasOutgoingCheck"
                          checked={hasOutgoingCheck}
                          onChange={(e) => {
                            setHasOutgoingCheck(e.target.checked);
                            // If enabling and list is empty, add one cheque
                            if (e.target.checked && outgoingChequesList.length === 0) {
                              addOutgoingCheque();
                            }
                          }}
                        />
                        <Label htmlFor="hasOutgoingCheck" className="cursor-pointer">
                          إضافة شيكات صادرة
                        </Label>
                      </div>
                      {hasOutgoingCheck && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addOutgoingCheque}
                          className="flex items-center gap-1"
                        >
                          <Plus className="h-4 w-4" />
                          إضافة شيك آخر
                        </Button>
                      )}
                    </div>

                    {hasOutgoingCheck && outgoingChequesList.length > 0 && (
                      <div className="pr-6 space-y-4">
                        {outgoingChequesList.map((cheque, index) => (
                          <div key={cheque.id} className="p-4 border rounded-lg bg-gray-50 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-medium text-sm">شيك {index + 1}</h4>
                              {outgoingChequesList.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOutgoingCheque(cheque.id)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            {/* Cheque Type Selection */}
                            <div className="space-y-2">
                              <Label>نوع الشيك المحاسبي</Label>
                              <select
                                value={cheque.accountingType || "cashed"}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "accountingType", e.target.value)
                                }
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                required
                              >
                                <option value="cashed">شيك صرف - يُصرف فوراً</option>
                                <option value="postponed">شيك مؤجل - يُصرف لاحقاً</option>
                                <option value="endorsed">شيك مظهر - شيك وارد نمرره للمورد</option>
                              </select>
                            </div>

                            {/* Endorsed from field - only for endorsed cheques */}
                            {cheque.accountingType === 'endorsed' && (
                              <div className="space-y-2 p-3 bg-purple-50 rounded-md border border-purple-200">
                                <Label>مظهر من (مصدر الشيك الأصلي)</Label>
                                <Input
                                  type="text"
                                  placeholder="أدخل اسم العميل/الجهة التي استلمنا منها الشيك"
                                  value={cheque.endorsedFromName || ""}
                                  onChange={(e) =>
                                    updateOutgoingCheque(cheque.id, "endorsedFromName", e.target.value)
                                  }
                                  required
                                />
                              </div>
                            )}

                            {/* Postponed cheque warning */}
                            {cheque.accountingType === 'postponed' && (
                              <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                                <p className="text-xs text-yellow-700">
                                  الشيك المؤجل: سيظهر في قائمة الشيكات الصادرة المعلقة
                                </p>
                              </div>
                            )}

                            {/* Cheque details */}
                            <div className="grid grid-cols-2 gap-4">
                              <Input
                                type="text"
                                placeholder="رقم الشيك"
                                value={cheque.chequeNumber}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "chequeNumber", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="مبلغ الشيك"
                                value={cheque.chequeAmount}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "chequeAmount", e.target.value)
                                }
                                required
                              />
                              <Input
                                type="text"
                                placeholder="اسم البنك"
                                value={cheque.bankName}
                                onChange={(e) =>
                                  updateOutgoingCheque(cheque.id, "bankName", e.target.value)
                                }
                                required
                              />
                              <div className="space-y-1">
                                <Input
                                  type="date"
                                  value={cheque.dueDate}
                                  onChange={(e) =>
                                    updateOutgoingCheque(cheque.id, "dueDate", e.target.value)
                                  }
                                  required
                                />
                                <p className="text-xs text-gray-500">تاريخ الاستحقاق</p>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Total cheques amount */}
                        {outgoingChequesList.length > 1 && (
                          <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                            <p className="text-sm font-medium text-blue-700">
                              مجموع الشيكات: {outgoingChequesList.reduce((sum, c) => sum + (parseFloat(c.chequeAmount) || 0), 0).toFixed(2)} دينار
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Inventory Update Option */}
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <input type="checkbox"
                      id="hasInventoryUpdate"
                      checked={hasInventoryUpdate}
                      onChange={(e) =>
                        setHasInventoryUpdate(e.target.checked)
                      }
                    />
                    <Label htmlFor="hasInventoryUpdate" className="cursor-pointer">
                      تحديث المخزون
                    </Label>
                  </div>

                  {hasInventoryUpdate && (
                    <div className="pr-6 space-y-2">
                      <Input
                        type="text"
                        placeholder="اسم الصنف"
                        value={inventoryFormData.itemName}
                        onChange={(e) =>
                          setInventoryFormData({ ...inventoryFormData, itemName: e.target.value })
                        }
                        required={hasInventoryUpdate}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="الكمية"
                          value={inventoryFormData.quantity}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, quantity: e.target.value })
                          }
                          required={hasInventoryUpdate}
                        />
                        <Input
                          type="text"
                          placeholder="الوحدة (كغ، متر، قطعة)"
                          value={inventoryFormData.unit}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, unit: e.target.value })
                          }
                          required={hasInventoryUpdate}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="السماكة (مم)"
                          value={inventoryFormData.thickness}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, thickness: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="العرض (متر)"
                          value={inventoryFormData.width}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, width: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="الطول (متر)"
                          value={inventoryFormData.length}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, length: e.target.value })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="تكلفة الشحن (اختياري)"
                          value={inventoryFormData.shippingCost}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, shippingCost: e.target.value })
                          }
                        />
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="تكاليف أخرى (اختياري)"
                          value={inventoryFormData.otherCosts}
                          onChange={(e) =>
                            setInventoryFormData({ ...inventoryFormData, otherCosts: e.target.value })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Fixed Asset Option */}
                {currentEntryType === "مصروف" && formData.category === "أصول ثابتة" && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input type="checkbox"
                        id="hasFixedAsset"
                        checked={hasFixedAsset}
                        onChange={(e) =>
                          setHasFixedAsset(e.target.checked)
                        }
                      />
                      <Label htmlFor="hasFixedAsset" className="cursor-pointer">
                        إضافة كأصل ثابت
                      </Label>
                    </div>

                    {hasFixedAsset && (
                      <div className="pr-6 space-y-2">
                        <Input
                          type="text"
                          placeholder="اسم الأصل"
                          value={fixedAssetFormData.assetName}
                          onChange={(e) =>
                            setFixedAssetFormData({ ...fixedAssetFormData, assetName: e.target.value })
                          }
                          required={hasFixedAsset}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-2">
                            <Label htmlFor="usefulLifeYears">العمر الإنتاجي (سنوات)</Label>
                            <Input
                              id="usefulLifeYears"
                              type="number"
                              step="0.1"
                              placeholder="مثال: 5"
                              value={fixedAssetFormData.usefulLifeYears}
                              onChange={(e) =>
                                setFixedAssetFormData({ ...fixedAssetFormData, usefulLifeYears: e.target.value })
                              }
                              required={hasFixedAsset}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="salvageValue">القيمة المتبقية (دينار)</Label>
                            <Input
                              id="salvageValue"
                              type="number"
                              step="0.01"
                              placeholder="مثال: 500"
                              value={fixedAssetFormData.salvageValue}
                              onChange={(e) =>
                                setFixedAssetFormData({ ...fixedAssetFormData, salvageValue: e.target.value })
                              }
                            />
                          </div>
                        </div>
                        {fixedAssetFormData.usefulLifeYears && fixedAssetFormData.salvageValue && (
                          <p className="text-xs text-gray-600 pr-2">
                            الإهلاك الشهري المقدر:{" "}
                            {(
                              (parseFloat(formData.amount || "0") - parseFloat(fixedAssetFormData.salvageValue)) /
                              (parseFloat(fixedAssetFormData.usefulLifeYears) * 12)
                            ).toFixed(2)}{" "}
                            دينار/شهر
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/*
                  خيار إنشاء فاتورة - للقبض مع عميل محدد فقط
                  Create Invoice Option - for income with client only
                */}
                {currentEntryType === "دخل" && formData.associatedParty && setCreateInvoice && (
                  <div className="space-y-2 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input
                        type="checkbox"
                        id="createInvoice"
                        checked={createInvoice || false}
                        onChange={(e) => setCreateInvoice(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="createInvoice" className="cursor-pointer font-medium">
                        إنشاء فاتورة لهذه الدفعة
                      </Label>
                    </div>
                    {createInvoice && (
                      <p className="text-xs text-blue-700 pr-6">
                        سيتم فتح نموذج إنشاء فاتورة جديدة للعميل &quot;{formData.associatedParty}&quot; بعد حفظ هذه الحركة.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : editingEntry ? "تحديث" : "إضافة"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
