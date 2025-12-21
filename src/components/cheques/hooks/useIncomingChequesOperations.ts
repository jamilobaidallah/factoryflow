"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, StorageError } from "firebase/storage";
import { firestore, storage } from "@/firebase/config";
import { Cheque, ChequeFormData } from "../types/cheques";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";
import { safeAdd, safeSubtract, zeroFloor } from "@/lib/currency";
import {
  validateTransition,
  validateDeletion,
  InvalidChequeTransitionError,
  type ChequeStatusValue,
} from "@/lib/chequeStateMachine";
import { logActivity } from "@/services/activityLogService";

/** Allocation entry for multi-allocation endorsement */
interface EndorsementAllocation {
  transactionId: string;
  ledgerDocId: string;
  transactionDate: Date;
  description: string;
  totalAmount: number;
  remainingBalance: number;
  allocatedAmount: number;
}

/** Data for multi-allocation endorsement */
interface EndorsementAllocationData {
  supplierName: string;
  clientAllocations: EndorsementAllocation[];
  supplierAllocations: EndorsementAllocation[];
}

interface UseIncomingChequesOperationsReturn {
  submitCheque: (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null,
    paymentDate?: Date
  ) => Promise<boolean>;
  deleteCheque: (chequeId: string) => Promise<boolean>;
  endorseCheque: (
    cheque: Cheque,
    supplierName: string,
    transactionId: string
  ) => Promise<boolean>;
  endorseChequeWithAllocations: (
    cheque: Cheque,
    allocationData: EndorsementAllocationData
  ) => Promise<boolean>;
  cancelEndorsement: (cheque: Cheque) => Promise<boolean>;
}

/**
 * Sanitizes a filename by replacing spaces and special characters
 * with underscores to prevent URL encoding issues in Firebase Storage
 */
function sanitizeFileName(filename: string): string {
  // Get file extension
  const lastDot = filename.lastIndexOf('.');
  const name = lastDot > 0 ? filename.substring(0, lastDot) : filename;
  const ext = lastDot > 0 ? filename.substring(lastDot) : '';

  // Replace spaces and special characters with underscores
  const sanitized = name
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .replace(/[^\w\-_.]/g, '_')     // Replace other special chars with underscores
    .replace(/_+/g, '_')            // Collapse multiple underscores
    .replace(/^_|_$/g, '');         // Trim leading/trailing underscores

  return sanitized + ext.toLowerCase();
}

export function useIncomingChequesOperations(): UseIncomingChequesOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const updateARAPTracking = async (
    linkedTransactionId: string,
    amount: number
  ) => {
    if (!user || !linkedTransactionId) {
      return;
    }

    const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
    const ledgerQuery = query(
      ledgerRef,
      where("transactionId", "==", linkedTransactionId.trim())
    );
    const ledgerSnapshot = await getDocs(ledgerQuery);

    if (!ledgerSnapshot.empty) {
      const ledgerDoc = ledgerSnapshot.docs[0];
      const ledgerData = ledgerDoc.data();

      if (ledgerData.isARAPEntry) {
        const currentTotalPaid = ledgerData.totalPaid || 0;
        const transactionAmount = ledgerData.amount || 0;
        const newTotalPaid = currentTotalPaid + amount;
        const newRemainingBalance = transactionAmount - newTotalPaid;

        let newPaymentStatus: "paid" | "unpaid" | "partial" = "unpaid";
        if (newRemainingBalance <= 0) {
          newPaymentStatus = "paid";
        } else if (newTotalPaid > 0) {
          newPaymentStatus = "partial";
        }

        await updateDoc(doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id), {
          totalPaid: newTotalPaid,
          remainingBalance: newRemainingBalance,
          paymentStatus: newPaymentStatus,
        });
      }
    }
  };

  /**
   * Submit incoming cheque with atomic batch operation
   * Ensures cheque + payment + ARAP update succeed or fail together
   */
  const submitCheque = async (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null,
    paymentDate?: Date
  ): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      // Upload image first (external storage - before batch)
      let chequeImageUrl: string | undefined = undefined;
      if (chequeImage) {
        try {
          const sanitizedName = sanitizeFileName(chequeImage.name);
          const imageRef = ref(
            storage,
            `users/${user.dataOwnerId}/cheques/${Date.now()}_${sanitizedName}`
          );
          await uploadBytes(imageRef, chequeImage);
          chequeImageUrl = await getDownloadURL(imageRef);
        } catch (uploadError) {
          // Handle storage-specific errors
          if (uploadError instanceof StorageError) {
            const errorCode = uploadError.code;
            if (errorCode === 'storage/unauthorized' || errorCode === 'storage/unauthenticated') {
              toast({
                title: "خطأ في الصلاحيات",
                description: "ليس لديك صلاحية لرفع الصور. يرجى التأكد من تسجيل الدخول والمحاولة مرة أخرى",
                variant: "destructive",
              });
              return false;
            } else if (errorCode === 'storage/canceled') {
              toast({
                title: "تم الإلغاء",
                description: "تم إلغاء رفع الصورة",
                variant: "destructive",
              });
              return false;
            } else if (errorCode === 'storage/quota-exceeded') {
              toast({
                title: "خطأ في التخزين",
                description: "تم تجاوز الحد المسموح به للتخزين",
                variant: "destructive",
              });
              return false;
            }
          }
          // Re-throw for generic error handling
          throw uploadError;
        }
      }

      if (editingCheque) {
        const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, editingCheque.id);
        const updateData: Record<string, unknown> = {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          status: formData.status,
          linkedTransactionId: formData.linkedTransactionId,
          issueDate: new Date(formData.issueDate),
          dueDate: new Date(formData.dueDate),
          bankName: formData.bankName,
          notes: formData.notes,
        };

        if (chequeImageUrl) {
          updateData.chequeImageUrl = chequeImageUrl;
        }

        // Check if status changed from pending to cleared
        const oldStatus = editingCheque.status;
        const newStatus = formData.status;
        const pendingStatuses = [CHEQUE_STATUS_AR.PENDING, "pending"];
        const clearedStatuses = [CHEQUE_STATUS_AR.CASHED, "cleared", CHEQUE_STATUS_AR.COLLECTED, "cashed"];
        const wasPending = pendingStatuses.includes(oldStatus);
        const isNowCleared = clearedStatuses.includes(newStatus);

        if (wasPending && isNowCleared) {
          // Status change requires atomic batch
          const batch = writeBatch(firestore);
          const effectivePaymentDate = paymentDate || new Date();
          updateData.clearedDate = effectivePaymentDate;

          const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
          const chequeAmount = parseFloat(formData.amount);

          // Add payment to batch
          const paymentDocRef = doc(paymentsRef);
          batch.set(paymentDocRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: PAYMENT_TYPES.RECEIPT,
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            date: effectivePaymentDate,
            notes: `تحصيل شيك رقم ${formData.chequeNumber}`,
            createdAt: new Date(),
          });

          // Update cheque in batch
          batch.update(chequeRef, updateData);

          // Inline ARAP update in batch (if linked)
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
                const newTotalPaid = safeAdd(currentTotalPaid, chequeAmount);
                const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
                const newPaymentStatus: "paid" | "unpaid" | "partial" =
                  newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

                batch.update(doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id), {
                  totalPaid: newTotalPaid,
                  remainingBalance: newRemainingBalance,
                  paymentStatus: newPaymentStatus,
                });
              }
            }
          }

          // Commit atomically
          await batch.commit();
        } else {
          // Simple update - no status change
          await updateDoc(chequeRef, updateData);
        }

        toast({
          title: "تم التحديث بنجاح",
          description: wasPending && isNowCleared
            ? `تم تحصيل الشيك رقم ${formData.chequeNumber} وإنشاء سند قبض`
            : "تم تحديث بيانات الشيك الوارد",
        });

        // Log activity for update
        logActivity(user.dataOwnerId, {
          action: 'update',
          module: 'cheques',
          targetId: editingCheque.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: wasPending && isNowCleared
            ? `تحصيل شيك وارد: ${formData.chequeNumber} - ${parseFloat(formData.amount)} دينار`
            : `تعديل شيك وارد: ${formData.chequeNumber}`,
          metadata: {
            amount: parseFloat(formData.amount),
            chequeNumber: formData.chequeNumber,
            status: formData.status,
            type: CHEQUE_TYPES.INCOMING,
            clientName: formData.clientName,
          },
        });
      } else {
        // Creating new cheque - simple add (no ARAP update needed for new incoming cheques)
        const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
        await addDoc(chequesRef, {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: CHEQUE_TYPES.INCOMING,
          status: formData.status,
          linkedTransactionId: formData.linkedTransactionId,
          issueDate: new Date(formData.issueDate),
          dueDate: new Date(formData.dueDate),
          bankName: formData.bankName,
          notes: formData.notes,
          createdAt: new Date(),
          ...(chequeImageUrl && { chequeImageUrl }),
        });
        toast({
          title: "تمت الإضافة بنجاح",
          description: "تم إضافة شيك وارد جديد",
        });

        // Log activity for create
        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'cheques',
          targetId: formData.chequeNumber,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إنشاء شيك وارد: ${formData.chequeNumber} - ${parseFloat(formData.amount)} دينار`,
          metadata: {
            amount: parseFloat(formData.amount),
            chequeNumber: formData.chequeNumber,
            status: formData.status,
            type: CHEQUE_TYPES.INCOMING,
            clientName: formData.clientName,
          },
        });
      }

      return true;
    } catch (error) {
      // Provide more specific error messages
      let errorDescription = "حدث خطأ أثناء حفظ البيانات";

      if (error instanceof StorageError) {
        errorDescription = "حدث خطأ أثناء رفع صورة الشيك. يرجى المحاولة مرة أخرى";
      } else if (error instanceof Error) {
        // Log the actual error for debugging
        console.error("Cheque save error:", error.message);
      }

      toast({
        title: "خطأ",
        description: errorDescription,
        variant: "destructive",
      });
      return false;
    }
  };

  const deleteCheque = async (chequeId: string): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, chequeId);
      await deleteDoc(chequeRef);
      toast({
        title: "تم الحذف",
        description: "تم حذف الشيك بنجاح",
      });

      // Log activity for delete
      logActivity(user.dataOwnerId, {
        action: 'delete',
        module: 'cheques',
        targetId: chequeId,
        userId: user.uid,
        userEmail: user.email || '',
        description: `حذف شيك وارد`,
        metadata: {
          type: CHEQUE_TYPES.INCOMING,
        },
      });

      return true;
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء الحذف",
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Endorse incoming cheque with atomic batch operation
   * Ensures all operations (incoming update, outgoing create, 2 payments, 2 ARAP updates) succeed or fail together
   */
  const endorseCheque = async (
    cheque: Cheque,
    supplierName: string,
    transactionId: string
  ): Promise<boolean> => {
    if (!user || !supplierName.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم المورد",
        variant: "destructive",
      });
      return false;
    }

    // Require supplier transaction ID for ARAP tracking
    if (!transactionId.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال رقم معاملة المورد لتحديث رصيد الذمم",
        variant: "destructive",
      });
      return false;
    }

    // Validate state transition: only PENDING cheques can be endorsed
    try {
      validateTransition(cheque.status as ChequeStatusValue, CHEQUE_STATUS_AR.ENDORSED);
    } catch (error) {
      if (error instanceof InvalidChequeTransitionError) {
        toast({
          title: "عملية غير مسموحة",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
      throw error;
    }

    try {
      // Use atomic batch for all operations
      const batch = writeBatch(firestore);
      const now = new Date();
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);

      const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const incomingChequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);

      // Pre-generate outgoing cheque document ref (for linking)
      const outgoingChequeRef = doc(chequesRef);

      // Store the supplier's transaction ID for ARAP update
      const supplierTransactionId = transactionId.trim();

      // 1. Update incoming cheque status, type, and outgoing reference
      batch.update(incomingChequeRef, {
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.ENDORSED,
        endorsedTo: supplierName,
        endorsedDate: now,
        endorsedToOutgoingId: outgoingChequeRef.id,
        // Store supplier transaction ID for reversal
        endorsedSupplierTransactionId: supplierTransactionId,
      });

      // 2. Create outgoing cheque entry
      batch.set(outgoingChequeRef, {
        chequeNumber: cheque.chequeNumber,
        clientName: supplierName,
        amount: cheque.amount,
        type: CHEQUE_TYPES.OUTGOING,
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.PENDING,
        linkedTransactionId: supplierTransactionId,
        issueDate: cheque.issueDate,
        dueDate: cheque.dueDate,
        bankName: cheque.bankName,
        notes: `شيك مظهر من العميل: ${cheque.clientName}`,
        createdAt: now,
        endorsedFromId: cheque.id,
        isEndorsedCheque: true,
      });

      // 3. Create payment record for original client (decrease receivable)
      const receiptDocRef = doc(paymentsRef);
      batch.set(receiptDocRef, {
        clientName: cheque.clientName,
        amount: cheque.amount,
        type: PAYMENT_TYPES.RECEIPT,
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: now,
        notes: `تظهير شيك رقم ${cheque.chequeNumber} للمورد: ${supplierName}`,
        createdAt: now,
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: cheque.id,
      });

      // 4. Create payment record for supplier (decrease payable)
      const disbursementDocRef = doc(paymentsRef);
      batch.set(disbursementDocRef, {
        clientName: supplierName,
        amount: cheque.amount,
        type: PAYMENT_TYPES.DISBURSEMENT,
        linkedTransactionId: supplierTransactionId,
        date: now,
        notes: `استلام شيك مجيّر رقم ${cheque.chequeNumber} من العميل: ${cheque.clientName}`,
        createdAt: now,
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: cheque.id,
      });

      // 5. Update ARAP for original client (if linked to a transaction)
      if (cheque.linkedTransactionId) {
        const clientLedgerQuery = query(
          ledgerRef,
          where("transactionId", "==", cheque.linkedTransactionId.trim())
        );
        const clientLedgerSnapshot = await getDocs(clientLedgerQuery);

        if (!clientLedgerSnapshot.empty) {
          const ledgerDoc = clientLedgerSnapshot.docs[0];
          const ledgerData = ledgerDoc.data();

          if (ledgerData.isARAPEntry) {
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const currentDiscount = ledgerData.totalDiscount || 0;
            const writeoffAmount = ledgerData.writeoffAmount || 0;
            const transactionAmount = ledgerData.amount || 0;
            const newTotalPaid = safeAdd(currentTotalPaid, cheque.amount);
            const effectiveSettled = safeAdd(safeAdd(newTotalPaid, currentDiscount), writeoffAmount);
            const newRemainingBalance = safeSubtract(transactionAmount, effectiveSettled);
            const newPaymentStatus: "paid" | "unpaid" | "partial" =
              newRemainingBalance <= 0 ? "paid" : effectiveSettled > 0 ? "partial" : "unpaid";

            batch.update(doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id), {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newPaymentStatus,
            });
          }
        }
      }

      // 6. Update ARAP for supplier (if transaction ID provided)
      if (supplierTransactionId) {
        const supplierLedgerQuery = query(
          ledgerRef,
          where("transactionId", "==", supplierTransactionId)
        );
        const supplierLedgerSnapshot = await getDocs(supplierLedgerQuery);

        if (!supplierLedgerSnapshot.empty) {
          const ledgerDoc = supplierLedgerSnapshot.docs[0];
          const ledgerData = ledgerDoc.data();

          if (ledgerData.isARAPEntry) {
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const currentDiscount = ledgerData.totalDiscount || 0;
            const writeoffAmount = ledgerData.writeoffAmount || 0;
            const transactionAmount = ledgerData.amount || 0;
            const newTotalPaid = safeAdd(currentTotalPaid, cheque.amount);
            const effectiveSettled = safeAdd(safeAdd(newTotalPaid, currentDiscount), writeoffAmount);
            const newRemainingBalance = safeSubtract(transactionAmount, effectiveSettled);
            const newPaymentStatus: "paid" | "unpaid" | "partial" =
              newRemainingBalance <= 0 ? "paid" : effectiveSettled > 0 ? "partial" : "unpaid";

            batch.update(doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id), {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newPaymentStatus,
            });
          }
        }
      }

      // Commit atomically - all operations succeed or all fail
      await batch.commit();

      toast({
        title: "تم التظهير بنجاح",
        description: `تم تظهير الشيك رقم ${cheque.chequeNumber} إلى ${supplierName} وتحديث أرصدة الذمم`,
      });

      // Log activity for endorsement
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `تظهير شيك وارد: ${cheque.chequeNumber} → ${supplierName}`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          status: CHEQUE_STATUS_AR.ENDORSED,
          endorsedTo: supplierName,
          type: CHEQUE_TYPES.INCOMING,
          clientTransactionId: cheque.linkedTransactionId || null,
          supplierTransactionId: supplierTransactionId || null,
        },
      });

      return true;
    } catch (error) {
      console.error("Error endorsing cheque:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تظهير الشيك",
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Endorse incoming cheque with multi-allocation support
   * Creates two multi-allocation payments (client receipt + supplier disbursement)
   * and updates ARAP for all allocated transactions atomically
   */
  const endorseChequeWithAllocations = async (
    cheque: Cheque,
    allocationData: EndorsementAllocationData
  ): Promise<boolean> => {
    if (!user || !allocationData.supplierName.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم المورد",
        variant: "destructive",
      });
      return false;
    }

    const { supplierName, clientAllocations, supplierAllocations } = allocationData;

    // Validate at least one allocation exists
    if (clientAllocations.length === 0 && supplierAllocations.length === 0) {
      toast({
        title: "خطأ",
        description: "يجب تخصيص المبلغ على معاملة واحدة على الأقل",
        variant: "destructive",
      });
      return false;
    }

    // Validate state transition: only PENDING cheques can be endorsed
    try {
      validateTransition(cheque.status as ChequeStatusValue, CHEQUE_STATUS_AR.ENDORSED);
    } catch (error) {
      if (error instanceof InvalidChequeTransitionError) {
        toast({
          title: "عملية غير مسموحة",
          description: error.message,
          variant: "destructive",
        });
        return false;
      }
      throw error;
    }

    try {
      const batch = writeBatch(firestore);
      const now = new Date();
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
      const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const incomingChequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);

      // Pre-generate document refs
      const outgoingChequeRef = doc(chequesRef);
      const receiptDocRef = doc(paymentsRef);
      const disbursementDocRef = doc(paymentsRef);

      // Calculate totals
      const clientTotalAllocated = clientAllocations.reduce((sum, a) => safeAdd(sum, a.allocatedAmount), 0);
      const supplierTotalAllocated = supplierAllocations.reduce((sum, a) => safeAdd(sum, a.allocatedAmount), 0);

      // Get primary transaction IDs for linking
      const primaryClientTransactionId = clientAllocations[0]?.transactionId || cheque.linkedTransactionId || "";
      const primarySupplierTransactionId = supplierAllocations[0]?.transactionId || "";

      // Store allocated transaction IDs for later reversal
      const clientTransactionIds = clientAllocations.map(a => a.transactionId);
      const supplierTransactionIds = supplierAllocations.map(a => a.transactionId);

      // 1. Update incoming cheque status
      batch.update(incomingChequeRef, {
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.ENDORSED,
        endorsedTo: supplierName,
        endorsedDate: now,
        endorsedToOutgoingId: outgoingChequeRef.id,
        endorsedSupplierTransactionId: primarySupplierTransactionId,
        // Store all allocated transaction IDs for reversal
        endorsedClientTransactionIds: clientTransactionIds,
        endorsedSupplierTransactionIds: supplierTransactionIds,
        isMultiAllocationEndorsement: true,
      });

      // 2. Create outgoing cheque entry
      batch.set(outgoingChequeRef, {
        chequeNumber: cheque.chequeNumber,
        clientName: supplierName,
        amount: cheque.amount,
        type: CHEQUE_TYPES.OUTGOING,
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.PENDING,
        linkedTransactionId: primarySupplierTransactionId,
        issueDate: cheque.issueDate,
        dueDate: cheque.dueDate,
        bankName: cheque.bankName,
        notes: `شيك مظهر من العميل: ${cheque.clientName}`,
        createdAt: now,
        endorsedFromId: cheque.id,
        isEndorsedCheque: true,
      });

      // 3. Create receipt payment for client (with allocations)
      batch.set(receiptDocRef, {
        clientName: cheque.clientName,
        amount: cheque.amount,
        type: PAYMENT_TYPES.RECEIPT,
        linkedTransactionId: primaryClientTransactionId,
        date: now,
        notes: `تظهير شيك رقم ${cheque.chequeNumber} للمورد: ${supplierName}`,
        createdAt: now,
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: cheque.id,
        isMultiAllocation: clientAllocations.length > 1,
        paidTransactionIds: clientTransactionIds,
      });

      // 4. Create disbursement payment for supplier (with allocations)
      batch.set(disbursementDocRef, {
        clientName: supplierName,
        amount: cheque.amount,
        type: PAYMENT_TYPES.DISBURSEMENT,
        linkedTransactionId: primarySupplierTransactionId,
        date: now,
        notes: `استلام شيك مجيّر رقم ${cheque.chequeNumber} من العميل: ${cheque.clientName}`,
        createdAt: now,
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: cheque.id,
        isMultiAllocation: supplierAllocations.length > 1,
        paidTransactionIds: supplierTransactionIds,
      });

      // 5. Create allocation subcollections for client payment
      for (const allocation of clientAllocations) {
        const allocationRef = doc(collection(firestore, `users/${user.dataOwnerId}/payments/${receiptDocRef.id}/allocations`));
        batch.set(allocationRef, {
          transactionId: allocation.transactionId,
          ledgerDocId: allocation.ledgerDocId,
          allocatedAmount: allocation.allocatedAmount,
          transactionDate: allocation.transactionDate,
          description: allocation.description,
          createdAt: now,
        });
      }

      // 6. Create allocation subcollections for supplier payment
      for (const allocation of supplierAllocations) {
        const allocationRef = doc(collection(firestore, `users/${user.dataOwnerId}/payments/${disbursementDocRef.id}/allocations`));
        batch.set(allocationRef, {
          transactionId: allocation.transactionId,
          ledgerDocId: allocation.ledgerDocId,
          allocatedAmount: allocation.allocatedAmount,
          transactionDate: allocation.transactionDate,
          description: allocation.description,
          createdAt: now,
        });
      }

      // 7. Update ARAP for all client allocations
      for (const allocation of clientAllocations) {
        const ledgerDocRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, allocation.ledgerDocId);

        // We need to read current values - but we already have them in the allocation
        // Calculate new values
        const currentTotalPaid = safeSubtract(allocation.totalAmount, allocation.remainingBalance);
        const newTotalPaid = safeAdd(currentTotalPaid, allocation.allocatedAmount);
        const newRemainingBalance = safeSubtract(allocation.totalAmount, newTotalPaid);
        const newPaymentStatus: "paid" | "unpaid" | "partial" =
          newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

        batch.update(ledgerDocRef, {
          totalPaid: newTotalPaid,
          remainingBalance: zeroFloor(newRemainingBalance),
          paymentStatus: newPaymentStatus,
        });
      }

      // 8. Update ARAP for all supplier allocations
      for (const allocation of supplierAllocations) {
        const ledgerDocRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, allocation.ledgerDocId);

        const currentTotalPaid = safeSubtract(allocation.totalAmount, allocation.remainingBalance);
        const newTotalPaid = safeAdd(currentTotalPaid, allocation.allocatedAmount);
        const newRemainingBalance = safeSubtract(allocation.totalAmount, newTotalPaid);
        const newPaymentStatus: "paid" | "unpaid" | "partial" =
          newRemainingBalance <= 0 ? "paid" : newTotalPaid > 0 ? "partial" : "unpaid";

        batch.update(ledgerDocRef, {
          totalPaid: newTotalPaid,
          remainingBalance: zeroFloor(newRemainingBalance),
          paymentStatus: newPaymentStatus,
        });
      }

      // 9. Create client advance entry if there's unallocated amount on client side
      // This happens when cheque value > client's total debt (client has credit with us)
      // ACCOUNTING: Client advance = We owe the client (liability) → Shows in PAYABLES
      const clientUnallocated = safeSubtract(cheque.amount, clientTotalAllocated);
      let clientAdvanceDocId: string | null = null;

      if (clientUnallocated > 0) {
        const clientAdvanceTransactionId = `ADV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-C`;
        const clientAdvanceLedgerRef = doc(ledgerRef);
        clientAdvanceDocId = clientAdvanceLedgerRef.id;

        // Create the advance entry in ledger
        // Type "مصروف" = shows in payables (we owe them)
        // paymentStatus "unpaid" = visible in ARAP aging
        batch.set(clientAdvanceLedgerRef, {
          transactionId: clientAdvanceTransactionId,
          type: "مصروف",  // Liability - we owe the client
          date: now,
          description: `سلفة عميل - شيك مظهر رقم ${cheque.chequeNumber}`,
          category: "سلفة عميل",
          amount: clientUnallocated,
          totalPaid: 0,  // Not yet consumed against future sales
          remainingBalance: clientUnallocated,  // Full amount still available as credit
          paymentStatus: "unpaid",  // Visible in ARAP
          associatedParty: cheque.clientName,
          isARAPEntry: true,
          isClientAdvance: true,
          linkedEndorsementChequeId: cheque.id,
          createdAt: now,
          notes: `رصيد دائن للعميل ${cheque.clientName} عبر تظهير شيك رقم ${cheque.chequeNumber} للمورد ${supplierName}`,
        });

        // Add allocation entry for the client advance
        const clientAdvanceAllocationRef = doc(collection(firestore, `users/${user.dataOwnerId}/payments/${receiptDocRef.id}/allocations`));
        batch.set(clientAdvanceAllocationRef, {
          transactionId: clientAdvanceTransactionId,
          ledgerDocId: clientAdvanceDocId,
          allocatedAmount: clientUnallocated,
          transactionDate: now,
          description: `سلفة عميل - شيك مظهر رقم ${cheque.chequeNumber}`,
          isAdvance: true,
          createdAt: now,
        });

        clientTransactionIds.push(clientAdvanceTransactionId);
      }

      // 10. Create supplier advance entry if there's unallocated amount
      // ACCOUNTING: Supplier advance = Supplier owes us goods/services (asset) → Shows in RECEIVABLES
      const supplierUnallocated = safeSubtract(cheque.amount, supplierTotalAllocated);
      let supplierAdvanceDocId: string | null = null;

      if (supplierUnallocated > 0) {
        // Generate a transaction ID for the advance
        const advanceTransactionId = `ADV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-S`;
        const advanceLedgerRef = doc(ledgerRef);
        supplierAdvanceDocId = advanceLedgerRef.id;

        // Create the advance entry in ledger
        // Type "دخل" = shows in receivables (they owe us)
        // paymentStatus "unpaid" = visible in ARAP aging (supplier hasn't "paid" with goods yet)
        batch.set(advanceLedgerRef, {
          transactionId: advanceTransactionId,
          type: "دخل",  // Asset - supplier owes us goods/services
          date: now,
          description: `سلفة مورد - شيك مظهر رقم ${cheque.chequeNumber}`,
          category: "سلفة مورد",
          amount: supplierUnallocated,
          totalPaid: 0,  // Supplier hasn't delivered goods yet
          remainingBalance: supplierUnallocated,  // Full amount still owed
          paymentStatus: "unpaid",  // Visible in ARAP
          associatedParty: supplierName,
          isARAPEntry: true,
          isSupplierAdvance: true,
          linkedEndorsementChequeId: cheque.id,
          createdAt: now,
          notes: `دفعة مقدمة للمورد ${supplierName} عبر تظهير شيك رقم ${cheque.chequeNumber} من العميل ${cheque.clientName}`,
        });

        // Add allocation entry for the advance to the supplier payment
        const advanceAllocationRef = doc(collection(firestore, `users/${user.dataOwnerId}/payments/${disbursementDocRef.id}/allocations`));
        batch.set(advanceAllocationRef, {
          transactionId: advanceTransactionId,
          ledgerDocId: supplierAdvanceDocId,
          allocatedAmount: supplierUnallocated,
          transactionDate: now,
          description: `سلفة مورد - شيك مظهر رقم ${cheque.chequeNumber}`,
          isAdvance: true,
          createdAt: now,
        });

        // Update the paidTransactionIds array to include the advance
        supplierTransactionIds.push(advanceTransactionId);
      }

      // Update cheque with advance doc IDs if created
      const advanceUpdates: Record<string, string | null> = {};
      if (clientAdvanceDocId) {
        advanceUpdates.endorsedClientAdvanceDocId = clientAdvanceDocId;
      }
      if (supplierAdvanceDocId) {
        advanceUpdates.endorsedSupplierAdvanceDocId = supplierAdvanceDocId;
      }
      if (Object.keys(advanceUpdates).length > 0) {
        batch.update(incomingChequeRef, advanceUpdates);
      }

      // Commit atomically
      await batch.commit();

      // Show appropriate toast message
      const advanceMessages: string[] = [];
      if (clientUnallocated > 0) {
        advanceMessages.push(`سلفة عميل: ${clientUnallocated.toFixed(2)}`);
      }
      if (supplierUnallocated > 0) {
        advanceMessages.push(`سلفة مورد: ${supplierUnallocated.toFixed(2)}`);
      }

      if (advanceMessages.length > 0) {
        toast({
          title: "تم التظهير بنجاح",
          description: `تم تظهير الشيك رقم ${cheque.chequeNumber} إلى ${supplierName}. ${advanceMessages.join(' | ')} دينار`,
        });
      } else {
        toast({
          title: "تم التظهير بنجاح",
          description: `تم تظهير الشيك رقم ${cheque.chequeNumber} إلى ${supplierName} مع توزيع المبالغ`,
        });
      }

      // Log activity
      const advanceInfo = [];
      if (clientUnallocated > 0) {
        advanceInfo.push(`سلفة عميل ${clientUnallocated.toFixed(2)}`);
      }
      if (supplierUnallocated > 0) {
        advanceInfo.push(`سلفة مورد ${supplierUnallocated.toFixed(2)}`);
      }

      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: advanceInfo.length > 0
          ? `تظهير شيك وارد: ${cheque.chequeNumber} → ${supplierName} (${advanceInfo.join(' + ')})`
          : `تظهير شيك وارد: ${cheque.chequeNumber} → ${supplierName} (توزيع متعدد)`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          status: CHEQUE_STATUS_AR.ENDORSED,
          endorsedTo: supplierName,
          type: CHEQUE_TYPES.INCOMING,
          clientAllocationsCount: clientAllocations.length,
          supplierAllocationsCount: supplierAllocations.length,
          clientTotalAllocated,
          supplierTotalAllocated,
          clientAdvanceAmount: clientUnallocated > 0 ? clientUnallocated : null,
          clientAdvanceDocId: clientAdvanceDocId,
          supplierAdvanceAmount: supplierUnallocated > 0 ? supplierUnallocated : null,
          supplierAdvanceDocId: supplierAdvanceDocId,
        },
      });

      return true;
    } catch (error) {
      console.error("Error endorsing cheque with allocations:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تظهير الشيك",
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Cancel endorsement with atomic batch operation
   * Supports both single-allocation and multi-allocation endorsements
   * Ensures outgoing cheque deletion + incoming revert + payments deletion + ARAP reversal succeed or fail together
   */
  const cancelEndorsement = async (cheque: Cheque): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);

      // Query payment records first (before batch)
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentsSnapshot = await getDocs(
        query(paymentsRef, where("endorsementChequeId", "==", cheque.id))
      );

      // Use atomic batch for all operations
      const batch = writeBatch(firestore);

      // 1. Delete the outgoing cheque entry if it exists
      if (cheque.endorsedToOutgoingId) {
        const outgoingChequeRef = doc(
          firestore,
          `users/${user.dataOwnerId}/cheques`,
          cheque.endorsedToOutgoingId
        );
        batch.delete(outgoingChequeRef);
      }

      // 2. Revert incoming cheque to pending status
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);
      batch.update(chequeRef, {
        chequeType: "عادي",
        status: CHEQUE_STATUS_AR.PENDING,
        endorsedTo: null,
        endorsedDate: null,
        endorsedToOutgoingId: null,
        endorsedSupplierTransactionId: null,
        // Clear multi-allocation fields
        endorsedClientTransactionIds: null,
        endorsedSupplierTransactionIds: null,
        isMultiAllocationEndorsement: null,
        // Clear advance fields
        endorsedClientAdvanceDocId: null,
        endorsedSupplierAdvanceDocId: null,
      });

      // 3. Process each payment and reverse its ARAP entries
      for (const paymentDoc of paymentsSnapshot.docs) {
        const paymentData = paymentDoc.data();
        const isMultiAllocation = paymentData.isMultiAllocation === true;

        if (isMultiAllocation) {
          // For multi-allocation payments, read from allocations subcollection
          const allocationsRef = collection(
            firestore,
            `users/${user.dataOwnerId}/payments/${paymentDoc.id}/allocations`
          );
          const allocationsSnapshot = await getDocs(allocationsRef);

          for (const allocationDoc of allocationsSnapshot.docs) {
            const allocationData = allocationDoc.data();
            const ledgerDocId = allocationData.ledgerDocId;
            const allocatedAmount = allocationData.allocatedAmount || 0;
            const isAdvance = allocationData.isAdvance === true;

            if (ledgerDocId && allocatedAmount > 0) {
              const ledgerDocRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDocId);

              if (isAdvance) {
                // For advance entries, check if they've been partially consumed
                // Both supplier and client advances start with totalPaid=0
                // If totalPaid > 0, the advance has been used against later invoices
                const advanceDoc = await getDoc(ledgerDocRef);
                if (advanceDoc.exists()) {
                  const advanceData = advanceDoc.data();
                  const isSupplierAdvance = advanceData.isSupplierAdvance === true;
                  const isClientAdvance = advanceData.isClientAdvance === true;
                  const advanceTotalPaid = advanceData.totalPaid || 0;

                  // Both advance types start with totalPaid=0; if > 0, they've been consumed
                  if (isSupplierAdvance && advanceTotalPaid > 0) {
                    throw new Error(
                      `لا يمكن إلغاء التظهير: تم استخدام جزء من سلفة المورد (${advanceTotalPaid.toFixed(2)} دينار) في معاملات لاحقة`
                    );
                  }
                  if (isClientAdvance && advanceTotalPaid > 0) {
                    throw new Error(
                      `لا يمكن إلغاء التظهير: تم استخدام جزء من رصيد العميل الدائن (${advanceTotalPaid.toFixed(2)} دينار) في معاملات لاحقة`
                    );
                  }
                }
                // DELETE the advance entry (it was created specifically for this endorsement)
                batch.delete(ledgerDocRef);
              } else {
                // For regular allocations, reverse the ARAP update
                const ledgerQuery = query(ledgerRef, where("__name__", "==", ledgerDocId));
                const ledgerSnapshot = await getDocs(ledgerQuery);

                if (!ledgerSnapshot.empty) {
                  const ledgerData = ledgerSnapshot.docs[0].data();

                  if (ledgerData.isARAPEntry) {
                    const currentTotalPaid = ledgerData.totalPaid || 0;
                    const currentDiscount = ledgerData.totalDiscount || 0;
                    const writeoffAmount = ledgerData.writeoffAmount || 0;
                    const transactionAmount = ledgerData.amount || 0;

                    // Reverse the allocation (subtract)
                    const newTotalPaid = Math.max(0, safeSubtract(currentTotalPaid, allocatedAmount));
                    const effectiveSettled = safeAdd(safeAdd(newTotalPaid, currentDiscount), writeoffAmount);
                    const newRemainingBalance = safeSubtract(transactionAmount, effectiveSettled);
                    const newPaymentStatus: "paid" | "unpaid" | "partial" =
                      newRemainingBalance <= 0 ? "paid" : effectiveSettled > 0 ? "partial" : "unpaid";

                    batch.update(ledgerDocRef, {
                      totalPaid: newTotalPaid,
                      remainingBalance: zeroFloor(newRemainingBalance),
                      paymentStatus: newPaymentStatus,
                    });
                  }
                }
              }
            }

            // Delete allocation document
            batch.delete(allocationDoc.ref);
          }
        } else {
          // For single-allocation payments, use linkedTransactionId
          const linkedTransactionId = paymentData.linkedTransactionId;
          const paymentAmount = paymentData.amount || 0;

          if (linkedTransactionId) {
            const ledgerQuery = query(
              ledgerRef,
              where("transactionId", "==", linkedTransactionId)
            );
            const ledgerSnapshot = await getDocs(ledgerQuery);

            if (!ledgerSnapshot.empty) {
              const ledgerDoc = ledgerSnapshot.docs[0];
              const ledgerData = ledgerDoc.data();

              if (ledgerData.isARAPEntry) {
                const currentTotalPaid = ledgerData.totalPaid || 0;
                const currentDiscount = ledgerData.totalDiscount || 0;
                const writeoffAmount = ledgerData.writeoffAmount || 0;
                const transactionAmount = ledgerData.amount || 0;

                // Reverse the payment (subtract)
                const newTotalPaid = Math.max(0, safeSubtract(currentTotalPaid, paymentAmount));
                const effectiveSettled = safeAdd(safeAdd(newTotalPaid, currentDiscount), writeoffAmount);
                const newRemainingBalance = safeSubtract(transactionAmount, effectiveSettled);
                const newPaymentStatus: "paid" | "unpaid" | "partial" =
                  newRemainingBalance <= 0 ? "paid" : effectiveSettled > 0 ? "partial" : "unpaid";

                batch.update(doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id), {
                  totalPaid: newTotalPaid,
                  remainingBalance: zeroFloor(newRemainingBalance),
                  paymentStatus: newPaymentStatus,
                });
              }
            }
          }
        }

        // Delete the payment record
        batch.delete(paymentDoc.ref);
      }

      // Commit atomically - all operations succeed or all fail
      await batch.commit();

      toast({
        title: "تم إلغاء التظهير",
        description: `تم إلغاء تظهير الشيك رقم ${cheque.chequeNumber} واسترجاع أرصدة الذمم`,
      });

      // Log activity for cancellation
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `إلغاء تظهير شيك: ${cheque.chequeNumber}`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          previousStatus: CHEQUE_STATUS_AR.ENDORSED,
          newStatus: CHEQUE_STATUS_AR.PENDING,
          type: CHEQUE_TYPES.INCOMING,
        },
      });

      return true;
    } catch (error) {
      console.error("Error canceling endorsement:", error);

      // Check if this is our custom error for consumed advances
      const errorMessage = error instanceof Error ? error.message : "";
      const isConsumedAdvanceError = errorMessage.includes("لا يمكن إلغاء التظهير");

      toast({
        title: isConsumedAdvanceError ? "لا يمكن إلغاء التظهير" : "خطأ",
        description: isConsumedAdvanceError ? errorMessage : "حدث خطأ أثناء إلغاء التظهير",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    submitCheque,
    deleteCheque,
    endorseCheque,
    endorseChequeWithAllocations,
    cancelEndorsement,
  };
}

// Export types for use in other components
export type { EndorsementAllocation, EndorsementAllocationData };
