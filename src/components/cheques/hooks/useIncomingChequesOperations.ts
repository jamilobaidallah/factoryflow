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
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, StorageError } from "firebase/storage";
import { firestore, storage } from "@/firebase/config";
import { Cheque, ChequeFormData } from "../types/cheques";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";
import { safeAdd, safeSubtract } from "@/lib/currency";
import {
  validateTransition,
  validateDeletion,
  InvalidChequeTransitionError,
  type ChequeStatusValue,
} from "@/lib/chequeStateMachine";
import { logActivity } from "@/services/activityLogService";

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
    if (!user || !linkedTransactionId) return;

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
    if (!user) return false;

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
    if (!user) return false;

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
   * Cancel endorsement with atomic batch operation
   * Ensures outgoing cheque deletion + incoming revert + payments deletion + ARAP reversal succeed or fail together
   */
  const cancelEndorsement = async (cheque: Cheque): Promise<boolean> => {
    if (!user) return false;

    try {
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);

      // Query payment records first (before batch) - we need the linkedTransactionId from each
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
      });

      // 3. Reverse ARAP for each payment before deleting them
      // Collect unique transaction IDs to avoid double-reversing
      const processedTransactionIds = new Set<string>();

      for (const paymentDoc of paymentsSnapshot.docs) {
        const paymentData = paymentDoc.data();
        const linkedTransactionId = paymentData.linkedTransactionId;
        const paymentAmount = paymentData.amount || 0;

        // Skip if no linked transaction or already processed
        if (!linkedTransactionId || processedTransactionIds.has(linkedTransactionId)) {
          batch.delete(paymentDoc.ref);
          continue;
        }

        processedTransactionIds.add(linkedTransactionId);

        // Query ledger entry for this transaction
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
              remainingBalance: newRemainingBalance,
              paymentStatus: newPaymentStatus,
            });
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
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إلغاء التظهير",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    submitCheque,
    deleteCheque,
    endorseCheque,
    cancelEndorsement,
  };
}
