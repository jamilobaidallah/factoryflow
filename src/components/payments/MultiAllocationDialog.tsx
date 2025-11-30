"use client";

/**
 * MultiAllocationDialog Component
 *
 * Dialog for creating a payment that distributes across multiple transactions.
 * Features:
 * - Client selector with autocomplete
 * - FIFO auto-distribution
 * - Manual allocation override
 * - Real-time total comparison
 */

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { useClientTransactions } from "./hooks/useClientTransactions";
import { usePaymentAllocations } from "./hooks/usePaymentAllocations";
import { AllocationEntry, initialMultiAllocationFormData } from "./types";

interface PartyWithDebt {
  name: string;
  totalOutstanding: number;
}

interface MultiAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MultiAllocationDialog({
  open,
  onOpenChange,
  onSuccess,
}: MultiAllocationDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState(initialMultiAllocationFormData);
  const [allocations, setAllocations] = useState<AllocationEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Parties with outstanding debt (fetched from ledger)
  const [partiesWithDebt, setPartiesWithDebt] = useState<PartyWithDebt[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [partiesLoading, setPartiesLoading] = useState(true);

  // Fetch client's unpaid transactions
  const {
    transactions,
    loading: transactionsLoading,
    totalOutstanding,
    refetch: refetchTransactions,
  } = useClientTransactions(formData.clientName);

  // Payment allocations hook
  const {
    distributeFIFO,
    savePaymentWithAllocations,
    loading: allocationLoading,
    error: allocationError,
  } = usePaymentAllocations();

  // Fetch parties that have outstanding AR/AP debt from ledger
  useEffect(() => {
    if (!user) return;

    setPartiesLoading(true);
    const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
    // Query for AR/AP entries that are not fully paid
    const q = query(
      ledgerRef,
      where("isARAPEntry", "==", true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Group by associatedParty and sum outstanding amounts
      const partyMap = new Map<string, number>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const partyName = data.associatedParty;
        const paymentStatus = data.paymentStatus || "unpaid";

        // Skip if no party name or fully paid
        if (!partyName || paymentStatus === "paid") return;

        const amount = data.amount || 0;
        const totalPaid = data.totalPaid || 0;
        const remaining = data.remainingBalance ?? (amount - totalPaid);

        // Only include if there's outstanding balance
        if (remaining > 0) {
          const current = partyMap.get(partyName) || 0;
          partyMap.set(partyName, current + remaining);
        }
      });

      // Convert to array and sort by name
      const parties: PartyWithDebt[] = Array.from(partyMap.entries())
        .map(([name, totalOutstanding]) => ({ name, totalOutstanding }))
        .sort((a, b) => a.name.localeCompare(b.name, "ar"));

      setPartiesWithDebt(parties);
      setPartiesLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Initialize allocations when transactions load
  useEffect(() => {
    if (transactions.length > 0) {
      const newAllocations: AllocationEntry[] = transactions.map((txn) => ({
        transactionId: txn.transactionId,
        ledgerDocId: txn.id,
        transactionDate: txn.date,
        description: txn.description,
        totalAmount: txn.amount,
        remainingBalance: txn.remainingBalance,
        allocatedAmount: 0,
      }));
      setAllocations(newAllocations);
    } else {
      setAllocations([]);
    }
  }, [transactions]);

  // Filter parties for dropdown
  const filteredParties = useMemo(() => {
    if (!formData.clientName) return partiesWithDebt;
    return partiesWithDebt.filter((p) =>
      p.name.toLowerCase().includes(formData.clientName.toLowerCase())
    );
  }, [partiesWithDebt, formData.clientName]);

  // Calculate totals
  const paymentAmount = parseFloat(formData.amount) || 0;
  const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
  const difference = paymentAmount - totalAllocated;
  const isBalanced = Math.abs(difference) < 0.01;

  // Handle FIFO distribution
  const handleFIFODistribution = () => {
    if (paymentAmount <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ الدفعة أولاً",
        variant: "destructive",
      });
      return;
    }

    if (transactions.length === 0) {
      toast({
        title: "لا توجد معاملات",
        description: "لا توجد معاملات مستحقة لهذا العميل",
        variant: "destructive",
      });
      return;
    }

    const result = distributeFIFO(paymentAmount, transactions);
    setAllocations(result.allocations);
    setFormData((prev) => ({ ...prev, allocationMethod: "fifo" }));

    if (result.remainingPayment > 0) {
      toast({
        title: "تنبيه",
        description: `المبلغ أكبر من إجمالي المستحقات. المتبقي: ${result.remainingPayment.toFixed(2)} دينار`,
      });
    }
  };

  // Handle manual allocation change
  const handleAllocationChange = (index: number, value: string) => {
    const amount = parseFloat(value) || 0;
    const maxAmount = allocations[index].remainingBalance;

    setAllocations((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        allocatedAmount: Math.min(Math.max(0, amount), maxAmount),
      };
      return updated;
    });
    setFormData((prev) => ({ ...prev, allocationMethod: "manual" }));
  };

  // Handle client selection
  const handleClientSelect = (clientName: string) => {
    setFormData((prev) => ({ ...prev, clientName }));
    setShowClientDropdown(false);
  };

  // Reset form
  const resetForm = () => {
    setFormData(initialMultiAllocationFormData);
    setAllocations([]);
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.clientName) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار العميل",
        variant: "destructive",
      });
      return;
    }

    if (paymentAmount <= 0) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال مبلغ صحيح",
        variant: "destructive",
      });
      return;
    }

    const activeAllocations = allocations.filter((a) => a.allocatedAmount > 0);
    if (activeAllocations.length === 0) {
      toast({
        title: "خطأ",
        description: "يرجى تخصيص المبلغ على معاملة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    const paymentId = await savePaymentWithAllocations(
      {
        clientName: formData.clientName,
        amount: paymentAmount,
        date: new Date(formData.date),
        notes: formData.notes,
        type: formData.type,
      },
      allocations,
      formData.allocationMethod
    );

    setSaving(false);

    if (paymentId) {
      toast({
        title: "تمت الإضافة بنجاح",
        description: `تم توزيع الدفعة على ${activeAllocations.length} معاملة`,
      });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } else if (allocationError) {
      toast({
        title: "خطأ",
        description: allocationError,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>إضافة دفعة متعددة</DialogTitle>
          <DialogDescription>
            توزيع دفعة واحدة على عدة معاملات مستحقة
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Client and Payment Info Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Client Selector */}
            <div className="space-y-2 relative">
              <Label htmlFor="clientName">الطرف المعني (من الدفتر)</Label>
              <Input
                id="clientName"
                value={formData.clientName}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, clientName: e.target.value }));
                  setShowClientDropdown(true);
                }}
                onFocus={() => setShowClientDropdown(true)}
                placeholder={partiesLoading ? "جاري التحميل..." : "اختر أو ابحث..."}
                autoComplete="off"
                disabled={partiesLoading}
              />
              {showClientDropdown && !partiesLoading && (
                <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredParties.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-500 text-center">
                      {partiesWithDebt.length === 0
                        ? "لا توجد ذمم مستحقة في الدفتر"
                        : "لا توجد نتائج"}
                    </div>
                  ) : (
                    filteredParties.slice(0, 15).map((party) => (
                      <button
                        key={party.name}
                        type="button"
                        className="w-full px-3 py-2 text-right hover:bg-gray-100 text-sm flex justify-between items-center"
                        onClick={() => handleClientSelect(party.name)}
                      >
                        <span>{party.name}</span>
                        <span className="text-xs text-orange-600 font-medium">
                          {party.totalOutstanding.toFixed(0)} دينار
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Payment Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">مبلغ الدفعة (دينار)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, amount: e.target.value }))
                }
                placeholder="0.00"
              />
            </div>

            {/* Payment Date */}
            <div className="space-y-2">
              <Label htmlFor="date">التاريخ</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, date: e.target.value }))
                }
              />
            </div>

            {/* Payment Type */}
            <div className="space-y-2">
              <Label htmlFor="type">النوع</Label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, type: e.target.value }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="قبض">قبض</option>
                <option value="صرف">صرف</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, notes: e.target.value }))
              }
              placeholder="ملاحظات اختيارية..."
            />
          </div>

          {/* Summary Cards */}
          {formData.clientName && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-sm text-blue-600 mb-1">إجمالي المستحق</div>
                <div className="text-xl font-bold text-blue-700">
                  {totalOutstanding.toFixed(2)} دينار
                </div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-sm text-green-600 mb-1">مبلغ الدفعة</div>
                <div className="text-xl font-bold text-green-700">
                  {paymentAmount.toFixed(2)} دينار
                </div>
              </div>
              <div
                className={`p-4 rounded-lg ${
                  isBalanced
                    ? "bg-green-50"
                    : difference > 0
                    ? "bg-yellow-50"
                    : "bg-red-50"
                }`}
              >
                <div
                  className={`text-sm mb-1 ${
                    isBalanced
                      ? "text-green-600"
                      : difference > 0
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {isBalanced ? "متوازن" : difference > 0 ? "غير موزع" : "تجاوز"}
                </div>
                <div
                  className={`text-xl font-bold ${
                    isBalanced
                      ? "text-green-700"
                      : difference > 0
                      ? "text-yellow-700"
                      : "text-red-700"
                  }`}
                >
                  {Math.abs(difference).toFixed(2)} دينار
                </div>
              </div>
            </div>
          )}

          {/* FIFO Button */}
          {formData.clientName && transactions.length > 0 && (
            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                onClick={handleFIFODistribution}
                className="gap-2"
              >
                <Zap className="w-4 h-4" />
                توزيع تلقائي (FIFO)
              </Button>
              <span className="text-sm text-gray-500">
                {transactions.length} معاملة مستحقة
              </span>
            </div>
          )}

          {/* Transactions Table */}
          {formData.clientName && (
            <div className="border rounded-lg overflow-hidden">
              {transactionsLoading ? (
                <div className="p-8 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <p className="text-gray-500">جاري تحميل المعاملات...</p>
                </div>
              ) : transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-500">لا توجد معاملات مستحقة لهذا العميل</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">التاريخ</TableHead>
                      <TableHead>الوصف</TableHead>
                      <TableHead className="text-left w-[100px]">المبلغ</TableHead>
                      <TableHead className="text-left w-[100px]">المتبقي</TableHead>
                      <TableHead className="text-left w-[150px]">التخصيص</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allocations.map((allocation, index) => (
                      <TableRow key={allocation.transactionId}>
                        <TableCell className="text-sm">
                          {new Date(allocation.transactionDate).toLocaleDateString(
                            "ar-EG"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {allocation.description || "-"}
                        </TableCell>
                        <TableCell className="text-left text-sm">
                          {allocation.totalAmount.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-left text-sm font-medium text-orange-600">
                          {allocation.remainingBalance.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={allocation.remainingBalance}
                            value={allocation.allocatedAmount || ""}
                            onChange={(e) =>
                              handleAllocationChange(index, e.target.value)
                            }
                            className="h-8 text-sm"
                            placeholder="0.00"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* Warning for unbalanced allocation */}
          {!isBalanced && totalAllocated > 0 && (
            <Alert variant={difference > 0 ? "default" : "destructive"}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {difference > 0
                  ? `يوجد ${difference.toFixed(2)} دينار غير موزع من مبلغ الدفعة`
                  : `التخصيص يتجاوز مبلغ الدفعة بـ ${Math.abs(difference).toFixed(2)} دينار`}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              onOpenChange(false);
            }}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || allocationLoading || totalAllocated === 0}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              "حفظ الدفعة"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
