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
import { assertNonNegative, isDataIntegrityError } from "@/lib/errors";
import {
  validateTransition,
  validateDeletion,
  InvalidChequeTransitionError,
  type ChequeStatusValue,
} from "@/lib/chequeStateMachine";
import { logActivity } from "@/services/activityLogService";
import { createJournalEntryForPayment } from "@/services/journalService";

interface UseOutgoingChequesOperationsReturn {
  submitCheque: (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null,
    paymentDate?: Date
  ) => Promise<boolean>;
  deleteCheque: (chequeId: string) => Promise<boolean>;
  linkTransaction: (cheque: Cheque, transactionId: string) => Promise<boolean>;
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

export function useOutgoingChequesOperations(): UseOutgoingChequesOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const updateARAPTracking = async (
    linkedTransactionId: string,
    amount: number,
    isAddition: boolean
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
        const rawNewTotalPaid = isAddition
          ? currentTotalPaid + amount
          : currentTotalPaid - amount;

        // Fail fast on negative totalPaid - this indicates data corruption
        const newTotalPaid = assertNonNegative(rawNewTotalPaid, {
          operation: 'updateARAPTracking',
          entityId: ledgerDoc.id,
          entityType: 'ledger'
        });
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
   * Submit outgoing cheque with atomic batch operation
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

        // Only update image URL if a new image was uploaded
        if (chequeImageUrl) {
          updateData.chequeImageUrl = chequeImageUrl;
        }

        // التحقق من تغيير حالة الشيك - منطق محاسبي مهم
        // Check if status changed - critical accounting logic
        const oldStatus = editingCheque.status;
        const newStatus = formData.status;
        const pendingStatuses = [CHEQUE_STATUS_AR.PENDING, "pending"];
        const clearedStatuses = [CHEQUE_STATUS_AR.CASHED, "cleared", CHEQUE_STATUS_AR.COLLECTED, "cashed"];
        const bouncedOrRevertedStatuses = [CHEQUE_STATUS_AR.RETURNED, "bounced", CHEQUE_STATUS_AR.PENDING, "pending", CHEQUE_STATUS_AR.CANCELLED, "cancelled"];
        const wasPending = pendingStatuses.includes(oldStatus);
        const wasCleared = clearedStatuses.includes(oldStatus);
        const isNowCleared = clearedStatuses.includes(newStatus);
        const isNowBouncedOrReverted = bouncedOrRevertedStatuses.includes(newStatus);

        // مهم: إنشاء سجل الدفع عند تحويل الشيك من معلق إلى تم الصرف
        // Important: Create payment record when cheque changes from pending to cleared
        if (wasPending && isNowCleared) {
          // Validate state transition before proceeding
          try {
            validateTransition(oldStatus as ChequeStatusValue, newStatus as ChequeStatusValue);
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

          // Use atomic batch for status change operations
          const batch = writeBatch(firestore);
          const effectivePaymentDate = paymentDate || new Date();

          // إضافة تاريخ الصرف عند تغيير الحالة إلى تم الصرف
          updateData.clearedDate = effectivePaymentDate;

          // Pre-generate payment document ref
          const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
          const paymentDocRef = doc(paymentsRef);
          const chequeAmount = parseFloat(formData.amount);

          // Store the payment ID in the cheque for later reference
          updateData.linkedPaymentId = paymentDocRef.id;

          // Add payment to batch
          batch.set(paymentDocRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: PAYMENT_TYPES.DISBURSEMENT,
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            linkedChequeId: editingCheque.id,
            date: effectivePaymentDate,
            notes: `صرف شيك رقم ${formData.chequeNumber}`,
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

          // Create journal entry for the cheque payment (double-entry accounting)
          // Disbursement: DR AP, CR Cash
          try {
            await createJournalEntryForPayment(
              user.dataOwnerId,
              paymentDocRef.id,
              `صرف شيك صادر رقم ${formData.chequeNumber}`,
              chequeAmount,
              PAYMENT_TYPES.DISBURSEMENT as 'قبض' | 'صرف',
              effectivePaymentDate,
              formData.linkedTransactionId || undefined
            );
          } catch (journalError) {
            console.error("Failed to create journal entry for cheque cashing:", journalError);
            // Don't fail the whole operation - payment was already recorded
          }

          toast({
            title: "تم التحديث بنجاح",
            description: `تم صرف الشيك رقم ${formData.chequeNumber} وإنشاء سند صرف`,
          });

          // Log activity for cashing
          logActivity(user.dataOwnerId, {
            action: 'update',
            module: 'cheques',
            targetId: editingCheque.id,
            userId: user.uid,
            userEmail: user.email || '',
            description: `صرف شيك صادر: ${formData.chequeNumber} - ${chequeAmount} دينار`,
            metadata: {
              amount: chequeAmount,
              chequeNumber: formData.chequeNumber,
              status: formData.status,
              type: CHEQUE_TYPES.OUTGOING,
              clientName: formData.clientName,
            },
          });
        } else if (wasCleared && isNowBouncedOrReverted) {
          // Validate state transition before proceeding
          try {
            validateTransition(oldStatus as ChequeStatusValue, newStatus as ChequeStatusValue);
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

          // مهم: حذف سجل الدفع عند إرجاع الشيك (مرتجع أو إلغاء الصرف)
          // Important: Delete payment record when cheque is bounced or reverted
          const chequeAmount = parseFloat(formData.amount);

          // Query payments before batch
          const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
          let paymentsToDelete: { id: string }[] = [];

          const paymentQuery = query(
            paymentsRef,
            where("linkedChequeId", "==", editingCheque.id)
          );
          const paymentSnapshot = await getDocs(paymentQuery);

          if (paymentSnapshot.empty && formData.linkedTransactionId) {
            const altPaymentQuery = query(
              paymentsRef,
              where("linkedTransactionId", "==", formData.linkedTransactionId.trim()),
              where("method", "==", "cheque"),
              where("amount", "==", chequeAmount)
            );
            const altPaymentSnapshot = await getDocs(altPaymentQuery);
            paymentsToDelete = altPaymentSnapshot.docs.map(d => ({ id: d.id }));
          } else {
            paymentsToDelete = paymentSnapshot.docs.map(d => ({ id: d.id }));
          }

          // إزالة تاريخ الصرف ومرجع الدفع من الشيك
          updateData.clearedDate = null;
          updateData.linkedPaymentId = null;

          // Use atomic batch for reversal operations
          const batch = writeBatch(firestore);

          // Delete payments in batch
          paymentsToDelete.forEach(payment => {
            batch.delete(doc(firestore, `users/${user.dataOwnerId}/payments`, payment.id));
          });

          // Update cheque in batch
          batch.update(chequeRef, updateData);

          // Inline ARAP reversal in batch (if linked)
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

                // Fail fast on negative totalPaid - this indicates data corruption
                const newTotalPaid = assertNonNegative(safeSubtract(currentTotalPaid, chequeAmount), {
                  operation: 'reverseChequePayment',
                  entityId: ledgerDoc.id,
                  entityType: 'ledger'
                });
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

          let toastDescription: string;
          if (newStatus === CHEQUE_STATUS_AR.RETURNED || newStatus === "bounced") {
            toastDescription = `تم تسجيل الشيك رقم ${formData.chequeNumber} كمرتجع وإلغاء سند الصرف`;
          } else {
            toastDescription = `تم إرجاع الشيك رقم ${formData.chequeNumber} إلى قيد الانتظار وإلغاء سند الصرف`;
          }

          toast({
            title: "تم التحديث بنجاح",
            description: toastDescription,
          });

          // Log activity for reversal/bounce
          logActivity(user.dataOwnerId, {
            action: 'update',
            module: 'cheques',
            targetId: editingCheque.id,
            userId: user.uid,
            userEmail: user.email || '',
            description: newStatus === CHEQUE_STATUS_AR.RETURNED || newStatus === "bounced"
              ? `ارتجاع شيك صادر: ${formData.chequeNumber} - ${chequeAmount} دينار`
              : `إلغاء صرف شيك: ${formData.chequeNumber}`,
            metadata: {
              amount: chequeAmount,
              chequeNumber: formData.chequeNumber,
              previousStatus: oldStatus,
              newStatus: formData.status,
              type: CHEQUE_TYPES.OUTGOING,
              clientName: formData.clientName,
            },
          });
        } else {
          // Simple update - no status change affecting payments
          await updateDoc(chequeRef, updateData);
          toast({
            title: "تم التحديث بنجاح",
            description: "تم تحديث بيانات الشيك الصادر",
          });

          // Log activity for simple update
          logActivity(user.dataOwnerId, {
            action: 'update',
            module: 'cheques',
            targetId: editingCheque.id,
            userId: user.uid,
            userEmail: user.email || '',
            description: `تعديل شيك صادر: ${formData.chequeNumber}`,
            metadata: {
              amount: parseFloat(formData.amount),
              chequeNumber: formData.chequeNumber,
              status: formData.status,
              type: CHEQUE_TYPES.OUTGOING,
              clientName: formData.clientName,
            },
          });
        }
      } else {
        // Creating new cheque - simple add
        const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
        await addDoc(chequesRef, {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: CHEQUE_TYPES.OUTGOING,
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
          description: "تم إضافة شيك صادر جديد",
        });

        // Log activity for create
        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'cheques',
          targetId: formData.chequeNumber,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إنشاء شيك صادر: ${formData.chequeNumber} - ${parseFloat(formData.amount)} دينار`,
          metadata: {
            amount: parseFloat(formData.amount),
            chequeNumber: formData.chequeNumber,
            status: formData.status,
            type: CHEQUE_TYPES.OUTGOING,
            clientName: formData.clientName,
          },
        });
      }

      return true;
    } catch (error) {
      // Provide more specific error messages
      let errorTitle = "خطأ";
      let errorDescription = "حدث خطأ أثناء حفظ البيانات";

      if (isDataIntegrityError(error)) {
        errorTitle = "خطأ في سلامة البيانات";
        errorDescription = "المبلغ المدفوع سيصبح سالباً. قد يكون هناك تكرار في العملية.";
        console.error("Data integrity error:", error);
      } else if (error instanceof StorageError) {
        errorDescription = "حدث خطأ أثناء رفع صورة الشيك. يرجى المحاولة مرة أخرى";
      } else if (error instanceof Error) {
        // Log the actual error for debugging
        console.error("Cheque save error:", error.message);
      }

      toast({
        title: errorTitle,
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
        description: `حذف شيك صادر`,
        metadata: {
          type: CHEQUE_TYPES.OUTGOING,
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

  const linkTransaction = async (cheque: Cheque, transactionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        linkedTransactionId: transactionId.trim(),
      });

      toast({
        title: "تم الربط بنجاح",
        description: transactionId.trim()
          ? `تم ربط الشيك بالمعاملة ${transactionId}`
          : "تم إلغاء ربط الشيك بالمعاملة",
      });

      // Log activity for linking
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: transactionId.trim()
          ? `ربط شيك صادر: ${cheque.chequeNumber} بالمعاملة ${transactionId}`
          : `إلغاء ربط شيك: ${cheque.chequeNumber}`,
        metadata: {
          chequeNumber: cheque.chequeNumber,
          linkedTransactionId: transactionId.trim() || null,
          type: CHEQUE_TYPES.OUTGOING,
        },
      });

      return true;
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء ربط الشيك بالمعاملة",
        variant: "destructive",
      });
      return false;
    }
  };

  return { submitCheque, deleteCheque, linkTransaction };
}
