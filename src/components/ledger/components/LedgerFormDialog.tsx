/**
 * LedgerFormDialog - Main form dialog for adding/editing ledger entries
 * Extracted from ledger-page.tsx for better maintainability
 */

import { LedgerEntry, CATEGORIES } from "../utils/ledger-constants";
import { getCategoryType } from "../utils/ledger-helpers";
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

interface Client {
  id: string;
  name: string;
}

interface Partner {
  id: string;
  name: string;
}

interface LedgerFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  editingEntry: LedgerEntry | null;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  clients: Client[];
  partners: Partner[];
  // Form state
  formData: any;
  setFormData: (data: any) => void;
  hasIncomingCheck: boolean;
  setHasIncomingCheck: (value: boolean) => void;
  hasInventoryUpdate: boolean;
  setHasInventoryUpdate: (value: boolean) => void;
  hasFixedAsset: boolean;
  setHasFixedAsset: (value: boolean) => void;
  hasInitialPayment: boolean;
  setHasInitialPayment: (value: boolean) => void;
  initialPaymentAmount: string;
  setInitialPaymentAmount: (value: string) => void;
  checkFormData: any;
  setCheckFormData: (data: any) => void;
  inventoryFormData: any;
  setInventoryFormData: (data: any) => void;
  fixedAssetFormData: any;
  setFixedAssetFormData: (data: any) => void;
}

export function LedgerFormDialog({
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
  inventoryFormData,
  setInventoryFormData,
  fixedAssetFormData,
  setFixedAssetFormData,
}: LedgerFormDialogProps) {
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

                {/* Incoming Check Option */}
                {(currentEntryType === "دخل" || currentEntryType === "إيراد") && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <input type="checkbox"
                        id="hasIncomingCheck"
                        checked={hasIncomingCheck}
                        onChange={(e) =>
                          setHasIncomingCheck(e.target.checked)
                        }
                      />
                      <Label htmlFor="hasIncomingCheck" className="cursor-pointer">
                        إضافة شيك وارد
                      </Label>
                    </div>

                    {hasIncomingCheck && (
                      <div className="pr-6 space-y-4">
                        {/* Cheque Type Selection - Critical for proper accounting */}
                        <div className="space-y-2">
                          <Label htmlFor="chequeAccountingType">نوع الشيك المحاسبي</Label>
                          <select
                            id="chequeAccountingType"
                            value={checkFormData.accountingType || "cashed"}
                            onChange={(e) =>
                              setCheckFormData({
                                ...checkFormData,
                                accountingType: e.target.value as 'cashed' | 'postponed' | 'endorsed',
                                endorsedToName: e.target.value === 'endorsed' ? checkFormData.endorsedToName : "",
                              })
                            }
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            required
                          >
                            <option value="cashed">شيك صرف - يُصرف فوراً</option>
                            <option value="postponed">شيك مؤجل - يُصرف لاحقاً</option>
                            <option value="endorsed">شيك مظهر - تحويل لطرف ثالث</option>
                          </select>
                          <p className="text-xs text-gray-500">
                            {checkFormData.accountingType === 'cashed' &&
                              "سيتم تسجيل الشيك كمحصل وتحديث رصيد العميل فوراً"}
                            {checkFormData.accountingType === 'postponed' &&
                              "سيتم تسجيل الشيك كمعلق ولن يؤثر على رصيد العميل حتى تاريخ التحصيل"}
                            {checkFormData.accountingType === 'endorsed' &&
                              "سيتم تظهير الشيك لطرف ثالث ولن يؤثر على رصيد العميل الأصلي"}
                          </p>
                        </div>

                        {/* Endorsee field - only for endorsed cheques */}
                        {checkFormData.accountingType === 'endorsed' && (
                          <div className="space-y-2 p-3 bg-purple-50 rounded-md border border-purple-200">
                            <Label htmlFor="endorsedToName">مظهر إلى (اسم المستفيد)</Label>
                            <Input
                              id="endorsedToName"
                              type="text"
                              placeholder="أدخل اسم الجهة المظهر لها الشيك"
                              value={checkFormData.endorsedToName || ""}
                              onChange={(e) =>
                                setCheckFormData({ ...checkFormData, endorsedToName: e.target.value })
                              }
                              required
                            />
                          </div>
                        )}

                        {/* Postponed cheque warning */}
                        {checkFormData.accountingType === 'postponed' && (
                          <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                            <p className="text-xs text-yellow-700">
                              ⏳ الشيك المؤجل: تأكد من أن تاريخ الاستحقاق في المستقبل.
                              سيظهر الشيك في قائمة الشيكات المعلقة ويمكنك تأكيد التحصيل لاحقاً.
                            </p>
                          </div>
                        )}

                        {/* Cheque details */}
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            type="text"
                            placeholder="رقم الشيك"
                            value={checkFormData.chequeNumber}
                            onChange={(e) =>
                              setCheckFormData({ ...checkFormData, chequeNumber: e.target.value })
                            }
                            required={hasIncomingCheck}
                          />
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="مبلغ الشيك"
                            value={checkFormData.chequeAmount}
                            onChange={(e) =>
                              setCheckFormData({ ...checkFormData, chequeAmount: e.target.value })
                            }
                            required={hasIncomingCheck}
                          />
                          <Input
                            type="text"
                            placeholder="اسم البنك"
                            value={checkFormData.bankName}
                            onChange={(e) =>
                              setCheckFormData({ ...checkFormData, bankName: e.target.value })
                            }
                            required={hasIncomingCheck}
                          />
                          <div className="space-y-1">
                            <Input
                              type="date"
                              value={checkFormData.dueDate}
                              onChange={(e) =>
                                setCheckFormData({ ...checkFormData, dueDate: e.target.value })
                              }
                              required={hasIncomingCheck}
                            />
                            <p className="text-xs text-gray-500">تاريخ الاستحقاق</p>
                          </div>
                        </div>
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
