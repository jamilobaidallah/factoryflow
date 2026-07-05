"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, Layers } from "lucide-react";
import { PermissionGate } from "@/components/auth";
import { useConfirmation } from "@/components/ui/confirmation-dialog";
import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import { QUERY_LIMITS } from "@/lib/constants";
import { logActivity } from "@/services/activityLogService";
import {
  createJournalPostingEngine,
  getEntriesByLinkedPaymentId,
} from "@/services/journal";
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
  getAggregateFromServer,
  sum,
  runTransaction,
  serverTimestamp,
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
import { safeAdd, safeSubtract, zeroFloor, parseAmount } from "@/lib/currency";

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
  const [totalReceived, setTotalReceived] = useState<number | null>(null);
  const [totalPaid, setTotalPaid] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isMultiAllocationDialogOpen, setIsMultiAllocationDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(urlSearch || "");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch payment totals via server-side aggregation.
  // Uses subtraction approach to handle noCashMovement field:
  //   total = allByType − whereNoCashMovement=true
  // This correctly treats missing/undefined noCashMovement as "include in total".
  const fetchPaymentStats = useCallback(async () => {
    if (!user) { return; }
    setStatsLoading(true);
    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    try {
      const [receivedAll, receivedExcluded, paidAll, paidExcluded] = await Promise.all([
        getAggregateFromServer(
          query(paymentsRef, where("type", "==", "قبض")),
          { total: sum("amount") }
        ),
        getAggregateFromServer(
          query(paymentsRef, where("type", "==", "قبض"), where("noCashMovement", "==", true)),
          { total: sum("amount") }
        ),
        getAggregateFromServer(
          query(paymentsRef, where("type", "==", "صرف")),
          { total: sum("amount") }
        ),
        getAggregateFromServer(
          query(paymentsRef, where("type", "==", "صرف"), where("noCashMovement", "==", true)),
          { total: sum("amount") }
        ),
      ]);
      setTotalReceived((receivedAll.data().total ?? 0) - (receivedExcluded.data().total ?? 0));
      setTotalPaid((paidAll.data().total ?? 0) - (paidExcluded.data().total ?? 0));
    } catch (err) {
      // On failure (offline / index building): keep null state.
      // PaymentsSummaryCards stays in loading skeleton — no misleading zero shown.
      // Stats refresh automatically on next successful mutation.
      //
      // We LOG the error (previously silently swallowed) so a missing
      // composite index or malformed query is diagnosable from the browser
      // console instead of only surfacing as a stuck skeleton card. The
      // most common failure here is a missing aggregation-safe composite
      // index — Firebase returns a URL in the error message that creates
      // it with one click.
      // eslint-disable-next-line no-console
      console.error('[payments] fetchPaymentStats failed:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

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
    if (!user) {return;}

    const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
    getCountFromServer(query(paymentsRef)).then((snapshot) => {
      setTotalCount(snapshot.data().count);
    });
  }, [user]);

  // Fetch payment stats (totalReceived / totalPaid) via server-side aggregation.
  // Replaces the previous 10,000-document onSnapshot subscription.
  useEffect(() => {
    fetchPaymentStats();
  }, [fetchPaymentStats]);

  // Fetch payments with cursor-based pagination
  useEffect(() => {
    if (!user) {return;}

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

  // Filtered payments based on debounced search term — avoids running 7 checks per keystroke
  const filteredPayments = useMemo(() => {
    if (!debouncedSearchTerm.trim()) {return payments;}
    const term = debouncedSearchTerm.toLowerCase().trim();
    return payments.filter((p) =>
      p.id.toLowerCase().includes(term) ||
      p.clientName?.toLowerCase().includes(term) ||
      p.linkedTransactionId?.toLowerCase().includes(term) ||
      p.notes?.toLowerCase().includes(term) ||
      p.category?.toLowerCase().includes(term) ||
      p.subCategory?.toLowerCase().includes(term) ||
      p.allocationTransactionIds?.some(txnId => txnId.toLowerCase().includes(term))
    );
  }, [payments, debouncedSearchTerm]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {return;}

    setLoading(true);
    try {
      if (editingPayment) {
        const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, editingPayment.id);
        const newAmount = parseAmount(formData.amount);
        const oldAmount = editingPayment.amount || 0;
        const oldLinkedId = editingPayment.linkedTransactionId;
        const newLinkedId = formData.linkedTransactionId;
        const ledgerColRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);

        // --- Pre-transaction: gather doc IDs (queries can't run inside runTransaction) ---

        // Find old ledger doc ID (if linking to a different transaction)
        let oldLedgerDocId: string | null = null;
        if (oldLinkedId && oldLinkedId !== newLinkedId) {
          const snap = await getDocs(query(ledgerColRef, where("transactionId", "==", oldLinkedId)));
          if (!snap.empty && snap.docs[0].data().isARAPEntry) {
            oldLedgerDocId = snap.docs[0].id;
          }
        }

        // Find new ledger doc ID
        let newLedgerDocId: string | null = null;
        if (newLinkedId) {
          const snap = await getDocs(query(ledgerColRef, where("transactionId", "==", newLinkedId)));
          if (!snap.empty && snap.docs[0].data().isARAPEntry) {
            newLedgerDocId = snap.docs[0].id;
          }
        }

        // Find journal entries to reverse (by linkedPaymentId)
        const engine = createJournalPostingEngine(user.dataOwnerId);
        const oldJournals = await getEntriesByLinkedPaymentId(user.dataOwnerId, editingPayment.id);
        const journalIdsToReverse = oldJournals
          .filter((j) => j.status !== "reversed")
          .map((j) => j.id);

        // Reserve sequence numbers outside the transaction (sequence uses its own sub-transaction)
        // 1 sequence per journal reversal + 1 for the new journal entry
        const seqCount = journalIdsToReverse.length + 1;
        const sequences = await engine.reserveSequences(seqCount);
        const [newJournalSeq, ...reversalSeqs] = sequences;

        // --- Atomic transaction: all reads via tx.get(), all writes via tx ---
        await runTransaction(firestore, async (tx) => {
          // Read payment (verify it still exists and detect concurrent edits)
          const paymentSnap = await tx.get(paymentRef);
          if (!paymentSnap.exists()) throw new Error("المدفوعة غير موجودة");
          const currentPayment = paymentSnap.data();

          // Guard: reject if a previous edit is still mid-processing
          if (currentPayment.journalStatus === "reversal_pending") {
            throw new Error("المدفوعة قيد المعالجة. يرجى تحديث الصفحة والمحاولة مرة أخرى");
          }

          // Read old ledger doc (locked for the transaction)
          const oldLedgerRef = oldLedgerDocId
            ? doc(firestore, `users/${user.dataOwnerId}/ledger`, oldLedgerDocId)
            : null;
          const oldLedgerSnap = oldLedgerRef ? await tx.get(oldLedgerRef) : null;

          // Read new ledger doc (may be same as old if unchanged, or a different one)
          const isSameLedger = newLedgerDocId === oldLedgerDocId && newLedgerDocId !== null;
          const newLedgerRef = newLedgerDocId
            ? doc(firestore, `users/${user.dataOwnerId}/ledger`, newLedgerDocId)
            : null;
          const newLedgerSnap = (newLedgerRef && !isSameLedger)
            ? await tx.get(newLedgerRef)
            : oldLedgerSnap;

          // Reverse old journal entries (uses tx.get() inside reverseToTransaction)
          for (let i = 0; i < journalIdsToReverse.length; i++) {
            await engine.reverseToTransaction(tx, journalIdsToReverse[i], reversalSeqs[i], "تعديل مدفوعة");
          }

          // Create new journal entry inside transaction
          const templateId = formData.type === "قبض" ? "PAYMENT_RECEIPT" : "PAYMENT_DISBURSEMENT";
          engine.postToTransaction(tx, {
            templateId,
            amount: newAmount,
            date: new Date(formData.date),
            description: `${formData.type === "قبض" ? "قبض من" : "صرف إلى"} ${formData.clientName}`,
            source: {
              type: "payment",
              documentId: editingPayment.id,
              transactionId: newLinkedId || undefined,
            },
          }, newJournalSeq);

          // Update AR/AP on old ledger entry (remove old payment amount)
          if (oldLedgerRef && oldLedgerSnap?.exists()) {
            const d = oldLedgerSnap.data();
            const newTotalPaid = zeroFloor(safeSubtract(d.totalPaid || 0, oldAmount));
            tx.update(oldLedgerRef, {
              totalPaid: newTotalPaid,
              remainingBalance: calculateRemainingBalance(d.amount || 0, newTotalPaid, d.totalDiscount || 0, d.writeoffAmount || 0),
              paymentStatus: calculatePaymentStatus(newTotalPaid, d.amount || 0, d.totalDiscount || 0, d.writeoffAmount || 0),
            });
          }

          // Update AR/AP on new ledger entry (add new payment amount)
          if (newLedgerRef && newLedgerSnap?.exists()) {
            const sourceSnap = (isSameLedger && oldLedgerRef && oldLedgerSnap?.exists())
              ? oldLedgerSnap  // Use the original snapshot to avoid double-apply
              : newLedgerSnap;
            const d = sourceSnap.data();
            const amountDifference = safeSubtract(newAmount, oldAmount);
            const adjustmentAmount = oldLinkedId === newLinkedId ? amountDifference : newAmount;
            const updatedTotalPaid = zeroFloor(safeAdd(d.totalPaid || 0, adjustmentAmount));
            tx.update(newLedgerRef, {
              totalPaid: updatedTotalPaid,
              remainingBalance: calculateRemainingBalance(d.amount || 0, updatedTotalPaid, d.totalDiscount || 0, d.writeoffAmount || 0),
              paymentStatus: calculatePaymentStatus(updatedTotalPaid, d.amount || 0, d.totalDiscount || 0, d.writeoffAmount || 0),
            });
          }

          // Update payment document (last write — sets updatedAt for idempotency)
          tx.update(paymentRef, {
            clientName: formData.clientName,
            amount: newAmount,
            type: formData.type,
            linkedTransactionId: newLinkedId || null,
            date: new Date(formData.date),
            notes: formData.notes,
            category: formData.category || null,
            subCategory: formData.subCategory || null,
            updatedAt: serverTimestamp(),
          });
        });

        logActivity(user.dataOwnerId, {
          action: 'update',
          module: 'payments',
          targetId: editingPayment.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `تعديل مدفوعة: ${formData.clientName}`,
          metadata: {
            amount: newAmount,
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
        const paymentAmount = parseAmount(formData.amount);

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
          updatedAt: new Date(),
        });

        // Create journal entry for the payment (double-entry accounting)
        try {
          const engine = createJournalPostingEngine(user.dataOwnerId);
          const templateId = formData.type === "قبض" ? "PAYMENT_RECEIPT" : "PAYMENT_DISBURSEMENT";
          await engine.post({
            templateId,
            amount: paymentAmount,
            date: new Date(formData.date),
            description: `${formData.type === 'قبض' ? 'قبض من' : 'صرف إلى'} ${formData.clientName}`,
            source: {
              type: "payment",
              documentId: docRef.id,
              transactionId: formData.linkedTransactionId || undefined,
            },
          });
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
              const newTotalPaid = safeAdd(currentTotalPaid, paymentAmount);
              const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);

              const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

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

      fetchPaymentStats();
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
    if (!user) {return;}

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
              fetchPaymentStats();
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
                const newTotalPaid = assertNonNegative(safeSubtract(currentTotalPaid, payment.amount), {
                  operation: 'reversePaymentDelete',
                  entityId: ledgerDoc.id,
                  entityType: 'ledger'
                });

                // Reverse discount if payment had one
                const paymentDiscountAmount = payment.discountAmount || 0;
                const newTotalDiscount = assertNonNegative(safeSubtract(currentTotalDiscount, paymentDiscountAmount), {
                  operation: 'reverseDiscountDelete',
                  entityId: ledgerDoc.id,
                  entityType: 'ledger'
                });

                // Reverse writeoff if payment was a writeoff
                const paymentWriteoffAmount = payment.writeoffAmount || 0;
                const newWriteoffAmount = assertNonNegative(safeSubtract(currentWriteoff, paymentWriteoffAmount), {
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

          // Reverse linked journal entries (immutable ledger pattern)
          try {
            const engine = createJournalPostingEngine(user.dataOwnerId);
            const linkedJournals = await getEntriesByLinkedPaymentId(user.dataOwnerId, paymentId);
            for (const journal of linkedJournals) {
              if (journal.status !== "reversed") {
                await engine.reverse(journal.id, "حذف مدفوعة");
              }
            }
          } catch (journalError) {
            console.error("Failed to reverse journal entries for payment:", journalError);
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
          fetchPaymentStats();
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

  const handleExport = async () => {
    if (!user) { return; }
    try {
      const exportSnapshot = await getDocs(
        query(
          collection(firestore, `users/${user.dataOwnerId}/payments`),
          orderBy("date", "desc"),
          limit(QUERY_LIMITS.PAYMENTS)
        )
      );
      const allPaymentsForExport = exportSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...convertFirestoreDates(docSnap.data()),
      } as Payment));
      exportPaymentsToExcelProfessional(allPaymentsForExport);
    } catch {
      toast({ title: "خطأ", description: "فشل تصدير البيانات. يرجى المحاولة مرة أخرى.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Unified Header: Title + Stats + Search + Actions */}
      <PaymentsSummaryCards
        totalReceived={totalReceived ?? 0}
        totalPaid={totalPaid ?? 0}
        loading={statsLoading || totalReceived === null}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        actions={
          <PermissionGate action="create" module="payments">
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={() => setIsMultiAllocationDialogOpen(true)}
                aria-label="إضافة دفعة متعددة"
              >
                <Layers className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">دفعة متعددة</span>
              </Button>
              <Button size="sm" className="gap-1.5 h-9" onClick={openAddDialog} aria-label="إضافة مدفوعة جديدة">
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span className="hidden sm:inline">إضافة مدفوعة</span>
              </Button>
            </>
          </PermissionGate>
        }
      />

      <div className="space-y-4">
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
                      if (currentPage < totalPages) {setCurrentPage(currentPage + 1);}
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
                      if (currentPage > 1) {setCurrentPage(currentPage - 1);}
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
        onSuccess={fetchPaymentStats}
      />
    </div>
  );
}
