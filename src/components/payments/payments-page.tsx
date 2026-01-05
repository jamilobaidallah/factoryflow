"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Layers, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { logActivity } from "@/services/activityLogService";
import { createJournalEntryForPayment, deleteJournalEntriesByPayment } from "@/services/journalService";
import { exportPaymentsToExcelProfessional } from "@/lib/export-payments-excel";
import { MultiAllocationDialog } from "./MultiAllocationDialog";
import { usePaymentAllocations } from "./hooks/usePaymentAllocations";
import { useAllClients } from "@/hooks/useAllClients";
import { isMultiAllocationPayment, calculateRemainingBalance, calculatePaymentStatus } from "@/lib/arap-utils";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  limit,
  startAfter,
  getCountFromServer,
  DocumentSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { firestore } from "@/firebase/config";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { assertNonNegative, isDataIntegrityError } from "@/lib/errors";

// Import extracted components
import {
  PaymentsSummaryCards,
  PaymentsTable,
  PaymentsFormDialog,
  type Payment,
  type PaymentFormData,
} from "./components";

const initialFormData: PaymentFormData = {
  clientName: "",
  amount: "",
  type: "قبض",
  linkedTransactionId: "",
  date: new Date().toISOString().split("T")[0],
  notes: "",
  category: "",
  subCategory: "",
};

export default function PaymentsPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search");
  const { confirm, dialog: confirmationDialog } = useConfirmation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [allPaymentsForStats, setAllPaymentsForStats] = useState<Payment[]>([]); // All payments for accurate stats
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiAllocationDialogOpen, setIsMultiAllocationDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(urlSearch || "");

  // Multi-allocation hook for delete reversal
  const { reversePaymentAllocations } = usePaymentAllocations();

  // Fetch all clients/partners for the dropdown
  const { clients, loading: clientsLoading } = useAllClients();

  // Update search term when URL param changes
  useEffect(() => {
    if (urlSearch) {
      setSearchTerm(urlSearch);
    }
  }, [urlSearch]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const totalPages = Math.ceil(totalCount / pageSize);
  const [pageCursors, setPageCursors] = useState<Map<number, DocumentSnapshot>>(new Map());

  const [formData, setFormData] = useState<PaymentFormData>(initialFormData);

  // Fetch total count
  useEffect(() => {
    if (!user) return;

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    getCountFromServer(query(paymentsRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Subscribe to ALL payments for stats calculation (not paginated)
  // This ensures PaymentsSummaryCards shows accurate totals across all payments
  useEffect(() => {
    if (!user) return;

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    const q = query(paymentsRef, orderBy("date", "desc"), limit(10000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allPaymentsData: Payment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        allPaymentsData.push({
          id: docSnap.id,
          ...convertFirestoreDates(data),
        } as Payment);
      });
      setAllPaymentsForStats(allPaymentsData);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch payments with cursor-based pagination
  useEffect(() => {
    if (!user) return;

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);

    const queryConstraints: QueryConstraint[] = [
      orderBy("date", "desc"),
      limit(pageSize)
    ];

    if (currentPage > 1) {
      const cursor = pageCursors.get(currentPage - 1);
      if (cursor) {
        queryConstraints.push(startAfter(cursor));
      }
    }

    const q = query(paymentsRef, ...queryConstraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData: Payment[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        paymentsData.push({
          id: docSnap.id,
          ...convertFirestoreDates(data),
        } as Payment);
      });

      if (snapshot.docs && snapshot.docs.length > 0) {
        const lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setPageCursors(prev => {
          const newMap = new Map(prev);
          newMap.set(currentPage, lastDoc);
          return newMap;
        });
      }

      setPayments(paymentsData);
      setDataLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pageSize, currentPage]);

  // Filtered payments based on search term
  const filteredPayments = useMemo(() => {
    if (!searchTerm.trim()) return payments;
    const term = searchTerm.toLowerCase().trim();
    return payments.filter((p) =>
      p.id.toLowerCase().includes(term) ||
      p.clientName?.toLowerCase().includes(term) ||
      p.linkedTransactionId?.toLowerCase().includes(term) ||
      p.notes?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term) ||
      p.subCategory?.toLowerCase().includes(term) ||
      p.allocationTransactionIds?.some(txnId => txnId.toLowerCase().includes(term))
    );
  }, [payments, searchTerm]);

  // Memoized totals - calculated from ALL payments, not just current page
  const { totalReceived, totalPaid } = useMemo(() => ({
    totalReceived: allPaymentsForStats
      .filter((p) => p.type === "قبض" && !p.noCashMovement)
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    totalPaid: allPaymentsForStats
      .filter((p) => p.type === "صرف" && !p.noCashMovement)
      .reduce((sum, p) => sum + (p.amount || 0), 0),
  }), [allPaymentsForStats]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      if (editingPayment) {
        const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, editingPayment.id);
        await updateDoc(paymentRef, {
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: formData.type,
          linkedTransactionId: formData.linkedTransactionId,
          date: new Date(formData.date),
          notes: formData.notes,
          category: formData.category || null,
          subCategory: formData.subCategory || null,
        });

        logActivity(user.dataOwnerId, {
          action: 'update',
          module: 'payments',
          targetId: editingPayment.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `تعديل مدفوعة: ${formData.clientName}`,
          metadata: {
            amount: parseFloat(formData.amount),
            type: formData.type,
            clientName: formData.clientName,
          },
        });

        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث بيانات المدفوعة",
        });
      } else {
        const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
        const paymentAmount = parseFloat(formData.amount);

        const docRef = await addDoc(paymentsRef, {
          clientName: formData.clientName,
          amount: paymentAmount,
          type: formData.type,
          linkedTransactionId: formData.linkedTransactionId,
          date: new Date(formData.date),
          notes: formData.notes,
          category: formData.category || null,
          subCategory: formData.subCategory || null,
          createdAt: new Date(),
        });

        // Create journal entry for the payment (double-entry accounting)
        try {
          await createJournalEntryForPayment(
            user.dataOwnerId,
            docRef.id,
            `${formData.type === 'قبض' ? 'قبض من' : 'صرف إلى'} ${formData.clientName}`,
            paymentAmount,
            formData.type as 'قبض' | 'صرف',
            new Date(formData.date),
            formData.linkedTransactionId || undefined
          );
        } catch (journalError) {
          console.error("Failed to create journal entry for payment:", journalError);
          // Continue - payment is created, journal entry failure is logged but not blocking
        }

        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'payments',
          targetId: docRef.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إنشاء مدفوعة: ${formData.clientName} - ${paymentAmount} دينار`,
          metadata: {
            amount: paymentAmount,
            type: formData.type,
            clientName: formData.clientName,
          },
        });

        // Update AR/AP tracking if linkedTransactionId is provided
        let debugMessage = "";
        if (formData.linkedTransactionId) {
          const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
          const ledgerQuery = query(
            ledgerRef,
            where("transactionId", "==", formData.linkedTransactionId.trim())
          );
          const ledgerSnapshot = await getDocs(ledgerQuery);

          if (!ledgerSnapshot.empty) {
            const ledgerDoc = ledgerSnapshot.docs[0];
            const ledgerData = ledgerDoc.data();

            if (ledgerData.isARAPEntry) {
              const currentTotalPaid = ledgerData.totalPaid || 0;
              const transactionAmount = ledgerData.amount || 0;
              const newTotalPaid = currentTotalPaid + paymentAmount;
              const newRemainingBalance = transactionAmount - newTotalPaid;

              let newStatus: "paid" | "unpaid" | "partial" = "unpaid";
              if (newRemainingBalance <= 0) {
                newStatus = "paid";
              } else if (newTotalPaid > 0) {
                newStatus = "partial";
              }

              await updateDoc(doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id), {
                totalPaid: newTotalPaid,
                remainingBalance: newRemainingBalance,
                paymentStatus: newStatus,
              });

              debugMessage = `تم تحديث: المدفوع ${newTotalPaid.toFixed(2)} - المتبقي ${newRemainingBalance.toFixed(2)}`;
            } else {
              debugMessage = "⚠ الحركة المالية لا تتبع نظام الذمم. فعّل 'تتبع الذمم' في دفتر الأستاذ";
            }
          } else {
            debugMessage = `⚠ لم يتم العثور على حركة مالية برقم: ${formData.linkedTransactionId}`;
          }
        }

        toast({
          title: "تمت الإضافة بنجاح",
          description: debugMessage || "تم إضافة مدفوعة جديدة",
        });
      }

      resetForm();
      setIsDialogOpen(false);
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      clientName: payment.clientName || "",
      amount: (payment.amount || 0).toString(),
      type: payment.type || "قبض",
      linkedTransactionId: payment.linkedTransactionId || "",
      date: payment.date ? new Date(payment.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      notes: payment.notes || "",
      category: payment.category || "",
      subCategory: payment.subCategory || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (paymentId: string) => {
    if (!user) return;

    const payment = payments.find((p) => p.id === paymentId);

    // Block deletion of endorsement payments - must cancel endorsement from cheques page
    if (payment && 'isEndorsement' in payment && payment.isEndorsement) {
      toast({
        title: "لا يمكن حذف دفعة التظهير",
        description: "لإلغاء التظهير، اذهب إلى صفحة الشيكات الواردة واستخدم زر 'إلغاء التظهير'",
        variant: "destructive",
      });
      return;
    }

    const isMultiAlloc = payment && isMultiAllocationPayment(payment);

    confirm(
      "حذف المدفوعة",
      isMultiAlloc
        ? `هل أنت متأكد من حذف هذه المدفوعة الموزعة على ${payment.allocationCount} معاملة؟ سيتم إلغاء جميع التخصيصات.`
        : "هل أنت متأكد من حذف هذه المدفوعة؟ لا يمكن التراجع عن هذا الإجراء.",
      async () => {
        try {
          if (isMultiAlloc) {
            const success = await reversePaymentAllocations(paymentId);
            if (success) {
              logActivity(user.dataOwnerId, {
                action: 'delete',
                module: 'payments',
                targetId: paymentId,
                userId: user.uid,
                userEmail: user.email || '',
                description: `حذف مدفوعة موزعة: ${payment.clientName} - ${payment.amount} دينار`,
                metadata: {
                  amount: payment.amount,
                  type: payment.type,
                  clientName: payment.clientName,
                  allocationCount: payment.allocationCount,
                },
              });

              toast({
                title: "تم الحذف",
                description: `تم حذف المدفوعة وإلغاء ${payment.allocationCount} تخصيص`,
              });
            } else {
              toast({
                title: "خطأ",
                description: "حدث خطأ أثناء حذف المدفوعة",
                variant: "destructive",
              });
            }
            return;
          }

          // Original single-transaction delete logic
          if (payment && payment.linkedTransactionId) {
            const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
            const ledgerQuery = query(
              ledgerRef,
              where("transactionId", "==", payment.linkedTransactionId.trim())
            );
            const ledgerSnapshot = await getDocs(ledgerQuery);

            if (!ledgerSnapshot.empty) {
              const ledgerDoc = ledgerSnapshot.docs[0];
              const ledgerData = ledgerDoc.data();

              if (ledgerData.isARAPEntry) {
                const currentTotalPaid = ledgerData.totalPaid || 0;
                const currentTotalDiscount = ledgerData.totalDiscount || 0;
                const currentWriteoff = ledgerData.writeoffAmount || 0;
                const transactionAmount = ledgerData.amount || 0;

                // Reverse the payment amount
                const newTotalPaid = assertNonNegative(currentTotalPaid - payment.amount, {
                  operation: 'reversePaymentDelete',
                  entityId: ledgerDoc.id,
                  entityType: 'ledger'
                });

                // Reverse discount if payment had one
                const paymentDiscountAmount = payment.discountAmount || 0;
                const newTotalDiscount = assertNonNegative(currentTotalDiscount - paymentDiscountAmount, {
                  operation: 'reverseDiscountDelete',
                  entityId: ledgerDoc.id,
                  entityType: 'ledger'
                });

                // Reverse writeoff if payment was a writeoff
                const paymentWriteoffAmount = payment.writeoffAmount || 0;
                const newWriteoffAmount = assertNonNegative(currentWriteoff - paymentWriteoffAmount, {
                  operation: 'reverseWriteoffDelete',
                  entityId: ledgerDoc.id,
                  entityType: 'ledger'
                });

                // Calculate new remaining balance and status using proper formulas
                const newRemainingBalance = calculateRemainingBalance(
                  transactionAmount,
                  newTotalPaid,
                  newTotalDiscount,
                  newWriteoffAmount
                );
                const newStatus = calculatePaymentStatus(
                  newTotalPaid,
                  transactionAmount,
                  newTotalDiscount,
                  newWriteoffAmount
                );

                // Build update object - only include fields that changed
                const updateData: Record<string, unknown> = {
                  totalPaid: newTotalPaid,
                  remainingBalance: newRemainingBalance,
                  paymentStatus: newStatus,
                };

                // Only update discount if it changed
                if (paymentDiscountAmount > 0) {
                  updateData.totalDiscount = newTotalDiscount;
                }

                // Only update writeoff if it changed
                if (paymentWriteoffAmount > 0) {
                  updateData.writeoffAmount = newWriteoffAmount;
                }

                await updateDoc(doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id), updateData);
              }
            }
          }

          // Delete linked journal entries (prevents orphaned accounting records)
          try {
            await deleteJournalEntriesByPayment(user.dataOwnerId, paymentId);
          } catch (journalError) {
            console.error("Failed to delete journal entries for payment:", journalError);
            // Continue - we still want to delete the payment
          }

          const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, paymentId);
          await deleteDoc(paymentRef);

          logActivity(user.dataOwnerId, {
            action: 'delete',
            module: 'payments',
            targetId: paymentId,
            userId: user.uid,
            userEmail: user.email || '',
            description: `حذف مدفوعة: ${payment?.clientName || ''} - ${payment?.amount || 0} دينار`,
            metadata: {
              amount: payment?.amount,
              type: payment?.type,
              clientName: payment?.clientName,
            },
          });

          toast({
            title: "تم الحذف",
            description: payment?.linkedTransactionId
              ? "تم حذف المدفوعة وتحديث الرصيد في دفتر الأستاذ"
              : "تم حذف المدفوعة بنجاح",
          });
        } catch (error) {
          if (isDataIntegrityError(error)) {
            toast({
              title: "خطأ في سلامة البيانات",
              description: "المبلغ المدفوع سيصبح سالباً. قد يكون هناك تكرار في عملية الحذف.",
              variant: "destructive",
            });
          } else {
            const appError = handleError(error);
            toast({
              title: getErrorTitle(appError),
              description: appError.message,
              variant: "destructive",
            });
          }
        }
      },
      "destructive"
    );
  };

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingPayment(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleExport = () => {
    // Export all payments, not just current page
    exportPaymentsToExcelProfessional(allPaymentsForStats);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">المدفوعات</h1>
          <p className="text-gray-600 mt-2">تتبع عمليات القبض والصرف</p>
        </div>
        <PermissionGate action="create" module="payments">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setIsMultiAllocationDialogOpen(true)}
              aria-label="إضافة دفعة متعددة"
            >
              <Layers className="w-4 h-4" aria-hidden="true" />
              دفعة متعددة
            </Button>
            <Button className="gap-2" onClick={openAddDialog} aria-label="إضافة مدفوعة جديدة">
              <Plus className="w-4 h-4" aria-hidden="true" />
              إضافة مدفوعة
            </Button>
          </div>
        </PermissionGate>
      </div>

      <PaymentsSummaryCards
        totalReceived={totalReceived}
        totalPaid={totalPaid}
        loading={dataLoading}
      />

      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="بحث في المدفوعات..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10 pl-10"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchTerm("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <PaymentsTable
          payments={filteredPayments}
          loading={dataLoading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onExport={handleExport}
        />

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              عرض {filteredPayments.length} من {searchTerm ? `${payments.length} (تمت التصفية)` : totalCount} مدفوعة
            </div>
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                    }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>

                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          setCurrentPage(pageNum);
                        }}
                        isActive={currentPage === pageNum}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (currentPage > 1) setCurrentPage(currentPage - 1);
                    }}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      <PaymentsFormDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        editingPayment={editingPayment}
        formData={formData}
        setFormData={setFormData}
        loading={loading}
        onSubmit={handleSubmit}
        clients={clients}
        clientsLoading={clientsLoading}
      />

      {confirmationDialog}

      <MultiAllocationDialog
        open={isMultiAllocationDialogOpen}
        onOpenChange={setIsMultiAllocationDialogOpen}
      />
    </div>
  );
}
