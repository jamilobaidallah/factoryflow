"use client";

/**
 * EndorsementAllocationDialog Component
 *
 * Dialog for endorsing a cheque with multi-allocation support.
 * Features:
 * - Select supplier from dropdown
 * - Allocate cheque amount to client's transactions (what client is paying)
 * - Allocate cheque amount to supplier's transactions (what we're paying)
 * - FIFO auto-distribution for both sides
 * - Manual allocation override
 */

import { useState, useEffect, useMemo, useCallback } from "react";
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
import { Zap, AlertCircle, CheckCircle2, Loader2, ChevronDown } from "lucide-react";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { collection, query, where, getDocs } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { formatShortDate } from "@/lib/date-utils";
import { safeSubtract, safeAdd, sumAmounts } from "@/lib/currency";
import { Cheque } from "../types/cheques";

// ============================================================================
// Types
// ============================================================================

interface ClientInfo {
  name: string;
  source: 'ledger' | 'partner' | 'client' | 'both' | 'multiple';
  balance?: number;
  hasBalance?: boolean;
}

interface UnpaidTransaction {
  id: string;
  transactionId: string;
  date: Date;
  description: string;
  category: string;
  amount: number;
  totalPaid: number;
  remainingBalance: number;
  paymentStatus: 'unpaid' | 'partial';
}

interface AllocationEntry {
  transactionId: string;
  ledgerDocId: string;
  transactionDate: Date;
  description: string;
  totalAmount: number;
  remainingBalance: number;
  allocatedAmount: number;
}

interface EndorsementData {
  supplierName: string;
  clientAllocations: AllocationEntry[];
  supplierAllocations: AllocationEntry[];
}

interface EndorsementAllocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: Cheque | null;
  clients: ClientInfo[];
  clientsLoading: boolean;
  onEndorse: (data: EndorsementData) => Promise<boolean>;
}

// ============================================================================
// AllocationTable Component - Reusable table for client/supplier allocations
// ============================================================================

interface AllocationTableProps {
  allocations: AllocationEntry[];
  loading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  emptyIcon: "success" | "warning" | "info";
  idPrefix: string;
  partyName: string;
  onAllocationChange: (index: number, value: string) => void;
}

function AllocationTable({
  allocations,
  loading,
  isEmpty,
  emptyMessage,
  emptyIcon,
  idPrefix,
  partyName,
  onAllocationChange,
}: AllocationTableProps) {
  if (loading) {
    return (
      <div className="p-4 text-center">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
        <p className="text-gray-500 text-sm">جاري التحميل...</p>
      </div>
    );
  }

  if (isEmpty) {
    const IconComponent = emptyIcon === "success" ? CheckCircle2 : AlertCircle;
    const iconColor = emptyIcon === "success" ? "text-green-500" : "text-yellow-500";
    return (
      <div className="p-4 text-center">
        <IconComponent className={`w-6 h-6 ${iconColor} mx-auto mb-2`} />
        <p className="text-gray-500 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[250px] overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">التاريخ</TableHead>
            <TableHead className="text-xs">الوصف</TableHead>
            <TableHead className="text-xs text-left">المتبقي</TableHead>
            <TableHead className="text-xs text-left w-[100px]">التخصيص</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {allocations.map((allocation, index) => (
            <TableRow key={allocation.transactionId}>
              <TableCell className="text-xs py-1">
                {formatShortDate(allocation.transactionDate)}
              </TableCell>
              <TableCell className="text-xs py-1 max-w-[120px] truncate">
                {allocation.description || "-"}
              </TableCell>
              <TableCell className="text-xs py-1 text-left text-orange-600 font-medium">
                {allocation.remainingBalance.toFixed(2)}
              </TableCell>
              <TableCell className="py-1">
                <Input
                  id={`${idPrefix}-allocation-${index}`}
                  aria-label={`تخصيص للمعاملة ${allocation.transactionId} - ${partyName}`}
                  type="number"
                  step="0.01"
                  min="0"
                  max={allocation.remainingBalance}
                  value={allocation.allocatedAmount || ""}
                  onChange={(e) => onAllocationChange(index, e.target.value)}
                  className="h-7 text-xs"
                  placeholder="0"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EndorsementAllocationDialog({
  open,
  onOpenChange,
  cheque,
  clients,
  clientsLoading,
  onEndorse,
}: EndorsementAllocationDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();

  // Supplier selection state
  const [supplierName, setSupplierName] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Transactions state
  const [clientTransactions, setClientTransactions] = useState<UnpaidTransaction[]>([]);
  const [supplierTransactions, setSupplierTransactions] = useState<UnpaidTransaction[]>([]);
  const [clientTransactionsLoading, setClientTransactionsLoading] = useState(false);
  const [supplierTransactionsLoading, setSupplierTransactionsLoading] = useState(false);

  // Allocations state
  const [clientAllocations, setClientAllocations] = useState<AllocationEntry[]>([]);
  const [supplierAllocations, setSupplierAllocations] = useState<AllocationEntry[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSupplierName("");
      setClientTransactions([]);
      setSupplierTransactions([]);
      setClientAllocations([]);
      setSupplierAllocations([]);
      setShowSupplierDropdown(false);
    }
  }, [open]);

  /**
   * Shared helper to fetch unpaid transactions for a party
   * Reduces code duplication between client and supplier fetching
   */
  const fetchUnpaidTransactions = useCallback(async (
    partyName: string,
    setTransactions: (t: UnpaidTransaction[]) => void,
    setAllocations: (a: AllocationEntry[]) => void,
    setLoading: (l: boolean) => void,
    errorMessage: string
  ) => {
    if (!user || !partyName.trim()) {
      setTransactions([]);
      setAllocations([]);
      return;
    }

    setLoading(true);
    try {
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
      const q = query(
        ledgerRef,
        where('associatedParty', '==', partyName),
        where('isARAPEntry', '==', true)
      );

      const snapshot = await getDocs(q);
      const transactions: UnpaidTransaction[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const paymentStatus = data.paymentStatus || 'unpaid';
        if (paymentStatus === 'paid') {
          return;
        }

        const amount = data.amount || 0;
        const totalPaid = data.totalPaid || 0;
        const remainingBalance = data.remainingBalance ?? safeSubtract(amount, totalPaid);

        if (remainingBalance <= 0) {
          return;
        }

        transactions.push({
          id: doc.id,
          transactionId: data.transactionId || '',
          date: data.date?.toDate?.() || new Date(data.date) || new Date(),
          description: data.description || '',
          category: data.category || '',
          amount,
          totalPaid,
          remainingBalance,
          paymentStatus: paymentStatus as 'unpaid' | 'partial',
        });
      });

      // Sort by date (oldest first for FIFO)
      transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
      setTransactions(transactions);

      // Initialize allocations
      const allocations: AllocationEntry[] = transactions.map((txn) => ({
        transactionId: txn.transactionId,
        ledgerDocId: txn.id,
        transactionDate: txn.date,
        description: txn.description,
        totalAmount: txn.amount,
        remainingBalance: txn.remainingBalance,
        allocatedAmount: 0,
      }));
      setAllocations(allocations);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        title: "خطأ",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // Fetch client's unpaid transactions when dialog opens
  const fetchClientTransactions = useCallback(() => {
    if (!cheque?.clientName) {
      return;
    }
    fetchUnpaidTransactions(
      cheque.clientName,
      setClientTransactions,
      setClientAllocations,
      setClientTransactionsLoading,
      "حدث خطأ أثناء جلب معاملات العميل"
    );
  }, [cheque?.clientName, fetchUnpaidTransactions]);

  // Fetch when dialog opens with a cheque
  useEffect(() => {
    if (open && cheque) {
      fetchClientTransactions();
    }
  }, [open, cheque, fetchClientTransactions]);

  // Fetch supplier's unpaid transactions when supplier is selected
  const fetchSupplierTransactions = useCallback((supplierNameParam: string) => {
    fetchUnpaidTransactions(
      supplierNameParam,
      setSupplierTransactions,
      setSupplierAllocations,
      setSupplierTransactionsLoading,
      "حدث خطأ أثناء جلب معاملات المورد"
    );
  }, [fetchUnpaidTransactions]);

  // Filter suppliers (exclude the cheque's client)
  const filteredSuppliers = useMemo(() => {
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

  // Handle supplier selection
  const handleSupplierSelect = (name: string) => {
    setSupplierName(name);
    setShowSupplierDropdown(false);
    fetchSupplierTransactions(name);
  };

  // FIFO distribution function
  const distributeFIFO = (
    amount: number,
    currentAllocations: AllocationEntry[]
  ): AllocationEntry[] => {
    let remainingPayment = amount;
    return currentAllocations.map((allocation) => {
      if (remainingPayment <= 0) {
        return { ...allocation, allocatedAmount: 0 };
      }
      const allocationAmount = Math.min(remainingPayment, allocation.remainingBalance);
      remainingPayment = safeSubtract(remainingPayment, allocationAmount);
      return { ...allocation, allocatedAmount: allocationAmount };
    });
  };

  // Handle FIFO for client
  const handleClientFIFO = () => {
    if (!cheque) {
      return;
    }
    const newAllocations = distributeFIFO(cheque.amount, clientAllocations);
    setClientAllocations(newAllocations);
  };

  // Handle FIFO for supplier
  const handleSupplierFIFO = () => {
    if (!cheque) {
      return;
    }
    const newAllocations = distributeFIFO(cheque.amount, supplierAllocations);
    setSupplierAllocations(newAllocations);
  };

  // Handle manual allocation change for client
  const handleClientAllocationChange = useCallback((index: number, value: string) => {
    const amount = parseFloat(value) || 0;
    setClientAllocations((prev) => {
      const maxAmount = prev[index].remainingBalance;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        allocatedAmount: Math.min(Math.max(0, amount), maxAmount),
      };
      return updated;
    });
  }, []);

  // Handle manual allocation change for supplier
  const handleSupplierAllocationChange = useCallback((index: number, value: string) => {
    const amount = parseFloat(value) || 0;
    setSupplierAllocations((prev) => {
      const maxAmount = prev[index].remainingBalance;
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        allocatedAmount: Math.min(Math.max(0, amount), maxAmount),
      };
      return updated;
    });
  }, []);

  // Calculate totals
  const chequeAmount = cheque?.amount || 0;
  const totalClientAllocated = sumAmounts(clientAllocations.map((a) => a.allocatedAmount));
  const totalSupplierAllocated = sumAmounts(supplierAllocations.map((a) => a.allocatedAmount));
  const clientDifference = safeSubtract(chequeAmount, totalClientAllocated);
  const supplierDifference = safeSubtract(chequeAmount, totalSupplierAllocated);
  const clientTotalOutstanding = sumAmounts(clientTransactions.map((t) => t.remainingBalance));
  const supplierTotalOutstanding = sumAmounts(supplierTransactions.map((t) => t.remainingBalance));

  // Validation
  const canProceed = useMemo(() => {
    if (!supplierName.trim()) {
      return false;
    }
    if (totalClientAllocated === 0 && totalSupplierAllocated === 0) {
      return false;
    }
    return true;
  }, [supplierName, totalClientAllocated, totalSupplierAllocated]);

  // Handle endorsement
  const handleEndorseClick = async () => {
    if (!user || !cheque || !supplierName.trim()) {
      return;
    }

    // Get active allocations
    const activeClientAllocations = clientAllocations.filter((a) => a.allocatedAmount > 0);
    const activeSupplierAllocations = supplierAllocations.filter((a) => a.allocatedAmount > 0);

    if (activeClientAllocations.length === 0 && activeSupplierAllocations.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب تخصيص المبلغ على معاملة واحدة على الأقل",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const success = await onEndorse({
        supplierName: supplierName.trim(),
        clientAllocations: activeClientAllocations,
        supplierAllocations: activeSupplierAllocations,
      });

      if (success) {
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Error endorsing cheque:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء التظهير",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Helper to get difference status styling
  const getDifferenceStyle = (difference: number) => {
    if (difference === 0) {
      return {
        bg: 'bg-green-50',
        text: 'text-green-600',
        textBold: 'text-green-700',
        label: 'متوازن',
      };
    }
    if (difference > 0) {
      return {
        bg: 'bg-yellow-50',
        text: 'text-yellow-600',
        textBold: 'text-yellow-700',
        label: 'غير موزع',
      };
    }
    return {
      bg: 'bg-red-50',
      text: 'text-red-600',
      textBold: 'text-red-700',
      label: 'تجاوز',
    };
  };

  const clientStyle = getDifferenceStyle(clientDifference);
  const supplierStyle = getDifferenceStyle(supplierDifference);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تظهير الشيك - توزيع المبلغ</DialogTitle>
          <DialogDescription>
            {cheque && (
              <div className="flex gap-4 mt-2 text-sm">
                <span><strong>رقم الشيك:</strong> {cheque.chequeNumber}</span>
                <span><strong>المبلغ:</strong> {cheque.amount.toFixed(2)} دينار</span>
                <span><strong>من العميل:</strong> {cheque.clientName}</span>
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Supplier Selection */}
          <div className="space-y-2 relative">
            <Label htmlFor="supplierName">
              المورد المظهر له الشيك <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="supplierName"
                value={supplierName}
                onChange={(e) => {
                  setSupplierName(e.target.value);
                  setShowSupplierDropdown(true);
                }}
                onFocus={() => setShowSupplierDropdown(true)}
                placeholder={clientsLoading ? "جاري التحميل..." : "اختر أو ابحث عن مورد..."}
                autoComplete="off"
              />
              <ChevronDown className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
            {showSupplierDropdown && !clientsLoading && (
              <div className="absolute z-[100] w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredSuppliers.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 text-center">
                    {clients.length === 0 ? "لا يوجد عملاء/موردين" : "لا توجد نتائج"}
                  </div>
                ) : (
                  filteredSuppliers.slice(0, 15).map((client) => (
                    <button
                      key={client.name}
                      type="button"
                      onClick={() => handleSupplierSelect(client.name)}
                      className="w-full px-3 py-2 text-right text-sm hover:bg-gray-100 flex items-center justify-between"
                    >
                      <span>{client.name}</span>
                      <div className="flex items-center gap-1">
                        {client.hasBalance && client.balance !== 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            client.balance && client.balance > 0
                              ? 'bg-green-100 text-green-700'  // They owe us = good
                              : 'bg-red-100 text-red-700'      // We owe them = debt
                          }`}>
                            {client.balance && client.balance > 0 ? 'عليه: ' : 'له: '}
                            {Math.abs(client.balance || 0).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </button>
                  ))
                )}
                {supplierName.trim() && !clients.some(c => c.name === supplierName.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSupplierDropdown(false);
                      fetchSupplierTransactions(supplierName.trim());
                    }}
                    className="w-full px-3 py-2 text-right text-sm border-t hover:bg-blue-50 text-blue-600"
                  >
                    + استخدام &quot;{supplierName}&quot; كاسم جديد
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Two-column layout for allocations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client Side Allocations */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-blue-700">
                  معاملات العميل ({cheque?.clientName})
                </h3>
                {clientTransactions.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClientFIFO}
                    className="gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    FIFO
                  </Button>
                )}
              </div>

              {/* Client Summary */}
              <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                <div className="bg-blue-50 p-2 rounded">
                  <div className="text-blue-600">إجمالي المستحق</div>
                  <div className="font-bold text-blue-700">{clientTotalOutstanding.toFixed(2)}</div>
                </div>
                <div className={`p-2 rounded ${clientStyle.bg}`}>
                  <div className={clientStyle.text}>{clientStyle.label}</div>
                  <div className={`font-bold ${clientStyle.textBold}`}>
                    {Math.abs(clientDifference).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Client Transactions Table */}
              <AllocationTable
                allocations={clientAllocations}
                loading={clientTransactionsLoading}
                isEmpty={clientTransactions.length === 0}
                emptyMessage="لا توجد معاملات مستحقة"
                emptyIcon="success"
                idPrefix="client"
                partyName={cheque?.clientName || "العميل"}
                onAllocationChange={handleClientAllocationChange}
              />
            </div>

            {/* Supplier Side Allocations */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-purple-700">
                  معاملات المورد ({supplierName || "..."})
                </h3>
                {supplierTransactions.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSupplierFIFO}
                    className="gap-1"
                  >
                    <Zap className="w-3 h-3" />
                    FIFO
                  </Button>
                )}
              </div>

              {/* Supplier Summary */}
              <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
                <div className="bg-purple-50 p-2 rounded">
                  <div className="text-purple-600">إجمالي المستحق</div>
                  <div className="font-bold text-purple-700">{supplierTotalOutstanding.toFixed(2)}</div>
                </div>
                <div className={`p-2 rounded ${supplierStyle.bg}`}>
                  <div className={supplierStyle.text}>{supplierStyle.label}</div>
                  <div className={`font-bold ${supplierStyle.textBold}`}>
                    {Math.abs(supplierDifference).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Supplier Transactions Table */}
              {!supplierName.trim() ? (
                <div className="p-4 text-center">
                  <p className="text-gray-400 text-sm">اختر المورد أولاً</p>
                </div>
              ) : (
                <AllocationTable
                  allocations={supplierAllocations}
                  loading={supplierTransactionsLoading}
                  isEmpty={supplierTransactions.length === 0}
                  emptyMessage="لا توجد معاملات مستحقة للمورد"
                  emptyIcon="warning"
                  idPrefix="supplier"
                  partyName={supplierName}
                  onAllocationChange={handleSupplierAllocationChange}
                />
              )}
            </div>
          </div>

          {/* Warnings */}
          {(clientDifference > 0 || supplierDifference > 0) && totalClientAllocated + totalSupplierAllocated > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {clientDifference > 0 && (
                  <div>العميل: {clientDifference.toFixed(2)} دينار غير مخصص من قيمة الشيك</div>
                )}
                {supplierDifference > 0 && (
                  <div>المورد: {supplierDifference.toFixed(2)} دينار زيادة (سلفة للمورد)</div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleEndorseClick}
            disabled={saving || !canProceed}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                جاري التظهير...
              </>
            ) : (
              "تظهير الشيك"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
