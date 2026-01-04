/**
 * AdvanceAllocationDialog - Dialog to apply customer/supplier advances to invoices
 * Shows when creating an invoice for a party that has available advances
 */

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Wallet, CheckCircle2 } from "lucide-react";
import { formatNumber } from "@/lib/date-utils";
import type { AvailableAdvance } from "../hooks/useAvailableAdvances";

export interface AdvanceAllocationResult {
  advanceId: string;
  advanceTransactionId: string;
  amount: number;
  originalAdvanceAmount: number;
  remainingAfterAllocation: number;
}

interface AdvanceAllocationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (allocations: AdvanceAllocationResult[]) => void;
  onSkip: () => void;
  advances: AvailableAdvance[];
  invoiceAmount: number;
  partyName: string;
  isCustomer: boolean; // true for customer advances, false for supplier
}

export function AdvanceAllocationDialog({
  isOpen,
  onClose,
  onConfirm,
  onSkip,
  advances,
  invoiceAmount,
  partyName,
  isCustomer,
}: AdvanceAllocationDialogProps) {
  // Track which advances are selected and their allocation amounts
  const [selectedAdvances, setSelectedAdvances] = useState<Map<string, number>>(
    new Map()
  );

  // Calculate totals
  const totalAvailable = useMemo(
    () => advances.reduce((sum, adv) => sum + adv.remainingBalance, 0),
    [advances]
  );

  const totalAllocated = useMemo(
    () => Array.from(selectedAdvances.values()).reduce((sum, amt) => sum + amt, 0),
    [selectedAdvances]
  );

  const remainingInvoice = invoiceAmount - totalAllocated;

  // Auto-select advances up to invoice amount (FIFO)
  const handleAutoAllocate = () => {
    const newSelected = new Map<string, number>();
    let remaining = invoiceAmount;

    for (const advance of advances) {
      if (remaining <= 0) break;

      const allocateAmount = Math.min(advance.remainingBalance, remaining);
      newSelected.set(advance.id, allocateAmount);
      remaining -= allocateAmount;
    }

    setSelectedAdvances(newSelected);
  };

  // Toggle advance selection
  const handleToggleAdvance = (advanceId: string, advanceRemaining: number) => {
    const newSelected = new Map(selectedAdvances);

    if (newSelected.has(advanceId)) {
      newSelected.delete(advanceId);
    } else {
      // Auto-allocate the minimum of: advance remaining, invoice remaining
      const currentTotal = Array.from(newSelected.values()).reduce((s, a) => s + a, 0);
      const invoiceRemaining = invoiceAmount - currentTotal;
      const allocateAmount = Math.min(advanceRemaining, invoiceRemaining);
      if (allocateAmount > 0) {
        newSelected.set(advanceId, allocateAmount);
      }
    }

    setSelectedAdvances(newSelected);
  };

  // Update allocation amount for a specific advance
  const handleAmountChange = (advanceId: string, amount: number, maxAmount: number) => {
    const newSelected = new Map(selectedAdvances);
    const validAmount = Math.max(0, Math.min(amount, maxAmount));

    if (validAmount > 0) {
      newSelected.set(advanceId, validAmount);
    } else {
      newSelected.delete(advanceId);
    }

    setSelectedAdvances(newSelected);
  };

  // Build allocation results and confirm
  const handleConfirm = () => {
    const allocations: AdvanceAllocationResult[] = [];

    selectedAdvances.forEach((amount, advanceId) => {
      const advance = advances.find((a) => a.id === advanceId);
      if (advance && amount > 0) {
        allocations.push({
          advanceId: advance.id,
          advanceTransactionId: advance.transactionId,
          amount,
          originalAdvanceAmount: advance.amount,
          remainingAfterAllocation: advance.remainingBalance - amount,
        });
      }
    });

    onConfirm(allocations);
  };

  // Reset on close
  const handleClose = () => {
    setSelectedAdvances(new Map());
    onClose();
  };

  const advanceLabel = isCustomer ? "سلفة عميل" : "سلفة مورد";
  const partyLabel = isCustomer ? "العميل" : "المورد";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[550px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-primary-600" />
            تطبيق {advanceLabel} على الفاتورة
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Summary Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-800">
                  {partyLabel} "{partyName}" لديه {advanceLabel} متاحة
                </p>
                <p className="text-blue-700 mt-1">
                  إجمالي السلف المتاحة:{" "}
                  <span className="font-bold">{formatNumber(totalAvailable)} دينار</span>
                </p>
                <p className="text-blue-700">
                  مبلغ الفاتورة:{" "}
                  <span className="font-bold">{formatNumber(invoiceAmount)} دينار</span>
                </p>
              </div>
            </div>
          </div>

          {/* Auto-allocate button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAutoAllocate}
            className="w-full"
          >
            <CheckCircle2 className="h-4 w-4 ml-2" />
            تطبيق تلقائي (FIFO)
          </Button>

          {/* Advances List */}
          <div className="space-y-3 max-h-[250px] overflow-y-auto">
            {advances.map((advance) => {
              const isSelected = selectedAdvances.has(advance.id);
              const allocatedAmount = selectedAdvances.get(advance.id) || 0;
              const advanceDate = advance.date instanceof Date
                ? advance.date.toLocaleDateString("ar-EG")
                : new Date(advance.date).toLocaleDateString("ar-EG");

              return (
                <div
                  key={advance.id}
                  className={`border rounded-lg p-3 transition-colors ${
                    isSelected ? "border-primary-500 bg-primary-50" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() =>
                        handleToggleAdvance(advance.id, advance.remainingBalance)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm">{advance.description}</p>
                          <p className="text-xs text-slate-500">{advanceDate}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-emerald-600">
                            {formatNumber(advance.remainingBalance)} دينار
                          </p>
                          <p className="text-xs text-slate-400">متاح</p>
                        </div>
                      </div>

                      {/* Amount input when selected */}
                      {isSelected && (
                        <div className="mt-2 flex items-center gap-2">
                          <Label className="text-xs text-slate-600">المبلغ المخصوم:</Label>
                          <Input
                            type="number"
                            value={allocatedAmount}
                            onChange={(e) =>
                              handleAmountChange(
                                advance.id,
                                parseFloat(e.target.value) || 0,
                                advance.remainingBalance
                              )
                            }
                            className="w-32 h-8 text-sm"
                            min={0}
                            max={advance.remainingBalance}
                            step={0.01}
                          />
                          <span className="text-xs text-slate-500">دينار</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Allocation Summary */}
          {totalAllocated > 0 && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="flex justify-between items-center text-sm">
                <span className="text-emerald-700">سيتم خصم من السلف:</span>
                <span className="font-bold text-emerald-800">
                  {formatNumber(totalAllocated)} دينار
                </span>
              </div>
              {remainingInvoice > 0 && (
                <div className="flex justify-between items-center text-sm mt-1">
                  <span className="text-slate-600">المتبقي من الفاتورة:</span>
                  <span className="font-medium text-slate-800">
                    {formatNumber(remainingInvoice)} دينار
                  </span>
                </div>
              )}
              {remainingInvoice <= 0 && (
                <p className="text-xs text-emerald-600 mt-2">
                  ✓ الفاتورة ستكون مدفوعة بالكامل من السلف
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onSkip}>
            تخطي
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={totalAllocated === 0}
          >
            تطبيق السلف ({formatNumber(totalAllocated)} دينار)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
