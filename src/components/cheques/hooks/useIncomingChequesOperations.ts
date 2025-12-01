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

    const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
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

        await updateDoc(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
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
            `users/${user.uid}/cheques/${Date.now()}_${sanitizedName}`
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
        const chequeRef = doc(firestore, `users/${user.uid}/cheques`, editingCheque.id);
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

          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
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
            const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
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

                batch.update(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
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
      } else {
        // Creating new cheque - simple add (no ARAP update needed for new incoming cheques)
        const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
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
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeId);
      await deleteDoc(chequeRef);
      toast({
        title: "تم الحذف",
        description: "تم حذف الشيك بنجاح",
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
   * Ensures all 5 operations (incoming update, outgoing create, link update, 2 payments) succeed or fail together
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

    try {
      // Use atomic batch for all operations
      const batch = writeBatch(firestore);
      const now = new Date();

      const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const incomingChequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);

      // Pre-generate outgoing cheque document ref (for linking)
      const outgoingChequeRef = doc(chequesRef);

      // 1. Update incoming cheque status, type, and outgoing reference
      batch.update(incomingChequeRef, {
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.ENDORSED,
        endorsedTo: supplierName,
        endorsedDate: now,
        endorsedToOutgoingId: outgoingChequeRef.id,
      });

      // 2. Create outgoing cheque entry
      batch.set(outgoingChequeRef, {
        chequeNumber: cheque.chequeNumber,
        clientName: supplierName,
        amount: cheque.amount,
        type: CHEQUE_TYPES.OUTGOING,
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.PENDING,
        linkedTransactionId: transactionId.trim() || "",
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
        linkedTransactionId: transactionId.trim() || cheque.linkedTransactionId || "",
        date: now,
        notes: `استلام شيك مجيّر رقم ${cheque.chequeNumber} من العميل: ${cheque.clientName}`,
        createdAt: now,
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: cheque.id,
      });

      // Commit atomically - all 4 operations succeed or all fail
      await batch.commit();

      toast({
        title: "تم التظهير بنجاح",
        description: `تم تظهير الشيك رقم ${cheque.chequeNumber} إلى ${supplierName}`,
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
   * Ensures outgoing cheque deletion + incoming revert + payments deletion succeed or fail together
   */
  const cancelEndorsement = async (cheque: Cheque): Promise<boolean> => {
    if (!user) return false;

    try {
      // Query payment records first (before batch)
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentsSnapshot = await getDocs(
        query(paymentsRef, where("endorsementChequeId", "==", cheque.id))
      );

      // Use atomic batch for all operations
      const batch = writeBatch(firestore);

      // 1. Delete the outgoing cheque entry if it exists
      if (cheque.endorsedToOutgoingId) {
        const outgoingChequeRef = doc(
          firestore,
          `users/${user.uid}/cheques`,
          cheque.endorsedToOutgoingId
        );
        batch.delete(outgoingChequeRef);
      }

      // 2. Revert incoming cheque to pending status
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      batch.update(chequeRef, {
        chequeType: "عادي",
        status: CHEQUE_STATUS_AR.PENDING,
        endorsedTo: null,
        endorsedDate: null,
        endorsedToOutgoingId: null,
      });

      // 3. Delete endorsement payment records
      paymentsSnapshot.docs.forEach((paymentDoc) => {
        batch.delete(paymentDoc.ref);
      });

      // Commit atomically - all operations succeed or all fail
      await batch.commit();

      toast({
        title: "تم إلغاء التظهير",
        description: `تم إلغاء تظهير الشيك رقم ${cheque.chequeNumber} بنجاح`,
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
