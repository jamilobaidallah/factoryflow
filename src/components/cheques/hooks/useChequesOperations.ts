"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
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
  runTransaction,
  writeBatch,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firestore, storage } from "@/firebase/config";
import { Cheque, ChequeFormData } from "../types/cheques";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";
import { calculatePaymentStatus } from "@/lib/arap-utils";
import { parseAmount, safeAdd, safeSubtract, zeroFloor } from "@/lib/currency";
import {
  validateTransition,
  validateDeletion,
  InvalidChequeTransitionError,
  type ChequeStatusValue,
} from "@/lib/chequeStateMachine";
import { logActivity } from "@/services/activityLogService";

interface UseChequesOperationsReturn {
  submitCheque: (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null,
    paymentDate?: Date
  ) => Promise<boolean>;
  deleteCheque: (chequeId: string, cheques: Cheque[]) => Promise<boolean>;
  endorseCheque: (cheque: Cheque, supplierName: string) => Promise<boolean>;
  clearCheque: (cheque: Cheque, paymentDate?: Date) => Promise<boolean>;
  bounceCheque: (cheque: Cheque) => Promise<boolean>;
  /** Reverse multi-allocation payment when cheque cashing is undone */
  reverseChequeCashing: (cheque: Cheque) => Promise<boolean>;
}

export function useChequesOperations(): UseChequesOperationsReturn {
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
        const newTotalPaid = isAddition
          ? safeAdd(currentTotalPaid, amount)
          : zeroFloor(safeSubtract(currentTotalPaid, amount));
        const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);

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
      }
    }
  };

  /**
   * Submit cheque with atomic batch operation
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
        const imageRef = ref(
          storage,
          `users/${user.dataOwnerId}/cheques/${Date.now()}_${chequeImage.name}`
        );
        await uploadBytes(imageRef, chequeImage);
        chequeImageUrl = await getDownloadURL(imageRef);
      }

      if (editingCheque) {
        const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, editingCheque.id);
        const updateData: Record<string, unknown> = {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseAmount(formData.amount),
          type: formData.type,
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
          const paymentType = formData.type === CHEQUE_TYPES.INCOMING ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
          const chequeAmount = parseAmount(formData.amount);

          // Add payment to batch
          const paymentDocRef = doc(paymentsRef);
          batch.set(paymentDocRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: paymentType,
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
            ? `تم تحصيل الشيك رقم ${formData.chequeNumber} وإنشاء سند قبض/صرف`
            : "تم تحديث بيانات الشيك",
        });

        // Log activity for update
        logActivity(user.dataOwnerId, {
          action: wasPending && isNowCleared ? 'update' : 'update',
          module: 'cheques',
          targetId: editingCheque.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: wasPending && isNowCleared
            ? `تحصيل شيك: ${formData.chequeNumber} - ${parseAmount(formData.amount)} دينار`
            : `تعديل شيك: ${formData.chequeNumber}`,
          metadata: {
            amount: parseAmount(formData.amount),
            chequeNumber: formData.chequeNumber,
            status: formData.status,
            type: formData.type,
            clientName: formData.clientName,
          },
        });
      } else {
        // Creating new cheque
        const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
        const chequeAmount = parseAmount(formData.amount);

        if (formData.linkedTransactionId) {
          // New cheque with linked transaction - use batch for atomicity
          const batch = writeBatch(firestore);

          // Add cheque to batch
          const chequeDocRef = doc(chequesRef);
          batch.set(chequeDocRef, {
            chequeNumber: formData.chequeNumber,
            clientName: formData.clientName,
            amount: chequeAmount,
            type: formData.type,
            status: formData.status,
            linkedTransactionId: formData.linkedTransactionId,
            issueDate: new Date(formData.issueDate),
            dueDate: new Date(formData.dueDate),
            bankName: formData.bankName,
            notes: formData.notes,
            createdAt: new Date(),
            ...(chequeImageUrl && { chequeImageUrl }),
          });

          // Inline ARAP update in batch
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

          // Commit atomically
          await batch.commit();
        } else {
          // No linked transaction - simple add
          await addDoc(chequesRef, {
            chequeNumber: formData.chequeNumber,
            clientName: formData.clientName,
            amount: chequeAmount,
            type: formData.type,
            status: formData.status,
            linkedTransactionId: formData.linkedTransactionId,
            issueDate: new Date(formData.issueDate),
            dueDate: new Date(formData.dueDate),
            bankName: formData.bankName,
            notes: formData.notes,
            createdAt: new Date(),
            ...(chequeImageUrl && { chequeImageUrl }),
          });
        }

        toast({
          title: "تمت الإضافة بنجاح",
          description: formData.linkedTransactionId
            ? "تم إضافة الشيك وتحديث الرصيد المتبقي في دفتر الأستاذ"
            : "تم إضافة شيك جديد",
        });

        // Log activity for create
        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'cheques',
          targetId: formData.chequeNumber,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إنشاء شيك: ${formData.chequeNumber} - ${chequeAmount} دينار`,
          metadata: {
            amount: chequeAmount,
            chequeNumber: formData.chequeNumber,
            status: formData.status,
            type: formData.type,
            clientName: formData.clientName,
          },
        });
      }

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Delete a cheque with atomic transaction
   * Steps:
   * 1. Find and retrieve the cheque document
   * 2. Find and retrieve associated payment records
   * 3. Find and retrieve the linked ledger entry (if exists)
   * 4. In a single transaction:
   *    - Delete the cheque
   *    - Delete all associated payment records
   *    - Reverse the AR/AP balance in the ledger
   */
  const deleteCheque = async (chequeId: string, cheques: Cheque[]): Promise<boolean> => {
    if (!user) return false;

    try {
      const cheque = cheques.find((c) => c.id === chequeId);
      if (!cheque) {
        toast({
          title: "خطأ",
          description: "الشيك غير موجود",
          variant: "destructive",
        });
        return false;
      }

      // Validate deletion: only PENDING cheques can be deleted
      try {
        validateDeletion(cheque.status as ChequeStatusValue);
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

      // Step 1: Find all associated payment records linked to this cheque
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentsQuery = query(
        paymentsRef,
        where("linkedTransactionId", "==", cheque.linkedTransactionId || ""),
        where("notes", ">=", `${cheque.chequeNumber}`),
        where("notes", "<=", `${cheque.chequeNumber}\uf8ff`)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      // Filter payments that actually reference this cheque number in notes
      const relatedPayments = paymentsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.notes && data.notes.includes(cheque.chequeNumber);
      });

      // Step 2: Find the linked ledger entry (if exists)
      let ledgerDocRef = null;
      let ledgerData = null;

      if (cheque.linkedTransactionId) {
        const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
        const ledgerQuery = query(
          ledgerRef,
          where("transactionId", "==", cheque.linkedTransactionId.trim())
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);

        if (!ledgerSnapshot.empty) {
          const ledgerDoc = ledgerSnapshot.docs[0];
          ledgerDocRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDoc.id);
          ledgerData = ledgerDoc.data();
        }
      }

      // Step 3: Execute atomic transaction
      await runTransaction(firestore, async (transaction) => {
        const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, chequeId);

        // Delete the cheque
        transaction.delete(chequeRef);

        // Delete all associated payment records
        relatedPayments.forEach((paymentDoc) => {
          const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, paymentDoc.id);
          transaction.delete(paymentRef);
        });

        // Reverse AR/AP tracking in ledger entry
        if (ledgerDocRef && ledgerData && ledgerData.isARAPEntry) {
          const currentTotalPaid = ledgerData.totalPaid || 0;
          const transactionAmount = ledgerData.amount || 0;
          const newTotalPaid = zeroFloor(safeSubtract(currentTotalPaid, cheque.amount));
          const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);

          let newStatus: "paid" | "unpaid" | "partial" = "unpaid";
          if (newRemainingBalance <= 0) {
            newStatus = "paid";
          } else if (newTotalPaid > 0) {
            newStatus = "partial";
          }

          transaction.update(ledgerDocRef, {
            totalPaid: newTotalPaid,
            remainingBalance: newRemainingBalance,
            paymentStatus: newStatus,
          });
        }
      });

      // Success toast
      const deletedItemsCount = relatedPayments.length;
      toast({
        title: "تم الحذف بنجاح",
        description: cheque.linkedTransactionId
          ? `تم حذف الشيك و ${deletedItemsCount} سند مرتبط وتحديث الرصيد في دفتر الأستاذ`
          : "تم حذف الشيك بنجاح",
      });

      // Log activity for delete
      logActivity(user.dataOwnerId, {
        action: 'delete',
        module: 'cheques',
        targetId: chequeId,
        userId: user.uid,
        userEmail: user.email || '',
        description: `حذف شيك: ${cheque.chequeNumber} - ${cheque.amount} دينار`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          status: cheque.status,
          type: cheque.type,
          clientName: cheque.clientName,
        },
      });

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Endorse cheque with atomic batch operation
   * Ensures cheque update + 2 payment records succeed or fail together
   */
  const endorseCheque = async (cheque: Cheque, supplierName: string): Promise<boolean> => {
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

      // Update cheque status
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);
      batch.update(chequeRef, {
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.ENDORSED,
        endorsedTo: supplierName,
        endorsedDate: now,
      });

      // Add receipt payment
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
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
      });

      // Add disbursement payment
      const disbursementDocRef = doc(paymentsRef);
      batch.set(disbursementDocRef, {
        clientName: supplierName,
        amount: cheque.amount,
        type: PAYMENT_TYPES.DISBURSEMENT,
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: now,
        notes: `استلام شيك مجيّر رقم ${cheque.chequeNumber} من العميل: ${cheque.clientName}`,
        createdAt: now,
        isEndorsement: true,
        noCashMovement: true,
      });

      // Commit atomically - all 3 operations succeed or all fail
      await batch.commit();

      toast({
        title: "تم التظهير بنجاح",
        description: `تم تظهير الشيك رقم ${cheque.chequeNumber} إلى ${supplierName}`,
      });

      // Log activity for endorsement
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `تظهير شيك: ${cheque.chequeNumber} → ${supplierName}`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          status: CHEQUE_STATUS_AR.ENDORSED,
          endorsedTo: supplierName,
          type: cheque.type,
        },
      });

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Clear/cash cheque with atomic batch operation
   * Ensures cheque update + payment + ARAP update succeed or fail together
   */
  const clearCheque = async (cheque: Cheque, paymentDate?: Date): Promise<boolean> => {
    if (!user) return false;

    // Validate state transition: only PENDING cheques can be cashed
    try {
      validateTransition(cheque.status as ChequeStatusValue, CHEQUE_STATUS_AR.CASHED);
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
      const effectivePaymentDate = paymentDate || new Date();

      // Update cheque status
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);
      batch.update(chequeRef, {
        status: CHEQUE_STATUS_AR.CASHED,
        clearedDate: effectivePaymentDate,
      });

      // Add payment record
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentType = cheque.type === CHEQUE_TYPES.INCOMING ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
      const paymentDocRef = doc(paymentsRef);
      batch.set(paymentDocRef, {
        clientName: cheque.clientName,
        amount: cheque.amount,
        type: paymentType,
        method: "cheque",
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: effectivePaymentDate,
        notes: `تحصيل شيك مؤجل رقم ${cheque.chequeNumber}`,
        createdAt: new Date(),
      });

      // Inline ARAP update in batch (if linked)
      if (cheque.linkedTransactionId) {
        const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
        const ledgerQuery = query(
          ledgerRef,
          where("transactionId", "==", cheque.linkedTransactionId.trim())
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);

        if (!ledgerSnapshot.empty) {
          const ledgerDoc = ledgerSnapshot.docs[0];
          const ledgerData = ledgerDoc.data();

          if (ledgerData.isARAPEntry) {
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const transactionAmount = ledgerData.amount || 0;
            const newTotalPaid = safeAdd(currentTotalPaid, cheque.amount);
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

      // Commit atomically - all operations succeed or all fail
      await batch.commit();

      toast({
        title: "تم التحصيل بنجاح",
        description: `تم تحصيل الشيك رقم ${cheque.chequeNumber} وتحديث الرصيد`,
      });

      // Log activity for cashing
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `تحصيل شيك: ${cheque.chequeNumber} - ${cheque.amount} دينار`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          status: CHEQUE_STATUS_AR.CASHED,
          type: cheque.type,
          clientName: cheque.clientName,
        },
      });

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const bounceCheque = async (cheque: Cheque): Promise<boolean> => {
    if (!user) return false;

    // Validate state transition: only PENDING or CASHED cheques can be bounced
    try {
      validateTransition(cheque.status as ChequeStatusValue, CHEQUE_STATUS_AR.BOUNCED);
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
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        status: CHEQUE_STATUS_AR.BOUNCED,
        bouncedDate: new Date(),
      });

      toast({
        title: "تم تسجيل الشيك كمرتجع",
        description: `تم تسجيل الشيك رقم ${cheque.chequeNumber} كمرتجع. رصيد العميل لم يتغير.`,
      });

      // Log activity for bounce
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `ارتجاع شيك: ${cheque.chequeNumber} - ${cheque.amount} دينار`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          status: CHEQUE_STATUS_AR.BOUNCED,
          type: cheque.type,
          clientName: cheque.clientName,
        },
      });

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  /**
   * Reverse a cheque cashing operation by undoing the multi-allocation payment
   * This is called when a cheque's status changes from "cashed" back to another status
   */
  const reverseChequeCashing = async (cheque: Cheque): Promise<boolean> => {
    if (!user) return false;

    // Check if cheque has a linked payment from multi-allocation
    if (!cheque.linkedPaymentId) {
      // No multi-allocation payment to reverse
      return true;
    }

    try {
      const paymentId = cheque.linkedPaymentId;
      const batch = writeBatch(firestore);

      // Step 1: Fetch all allocations for this payment
      const allocationsRef = collection(
        firestore,
        `users/${user.dataOwnerId}/payments/${paymentId}/allocations`
      );
      const allocationsSnapshot = await getDocs(allocationsRef);

      // Step 2: Reverse each allocation on the ledger
      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data();
        const ledgerDocId = allocation.ledgerDocId;

        if (ledgerDocId) {
          // Get current ledger entry state
          const ledgerRef = doc(firestore, `users/${user.dataOwnerId}/ledger`, ledgerDocId);
          const ledgerSnapshot = await getDoc(ledgerRef);

          if (ledgerSnapshot.exists()) {
            const ledgerData = ledgerSnapshot.data();
            const transactionAmount = ledgerData.amount || 0;
            const currentTotalPaid = ledgerData.totalPaid || 0;
            const allocatedAmount = allocation.allocatedAmount || 0;

            // Subtract the allocated amount (reverse the payment)
            const newTotalPaid = zeroFloor(safeSubtract(currentTotalPaid, allocatedAmount));
            const newRemainingBalance = safeSubtract(transactionAmount, newTotalPaid);
            const newStatus = calculatePaymentStatus(newTotalPaid, transactionAmount);

            batch.update(ledgerRef, {
              totalPaid: newTotalPaid,
              remainingBalance: newRemainingBalance,
              paymentStatus: newStatus,
            });
          }
        }

        // Delete the allocation document
        batch.delete(allocationDoc.ref);
      }

      // Step 3: Delete the payment document
      const paymentRef = doc(firestore, `users/${user.dataOwnerId}/payments`, paymentId);
      batch.delete(paymentRef);

      // Step 4: Update the cheque to clear linked payment data
      const chequeRef = doc(firestore, `users/${user.dataOwnerId}/cheques`, cheque.id);
      batch.update(chequeRef, {
        linkedPaymentId: null,
        clearedDate: null,
        status: CHEQUE_STATUS_AR.PENDING,
      });

      // Commit all changes atomically
      await batch.commit();

      toast({
        title: "تم إلغاء التحصيل",
        description: `تم إلغاء تحصيل الشيك رقم ${cheque.chequeNumber} وعكس جميع التوزيعات`,
      });

      // Log activity for reversal
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'cheques',
        targetId: cheque.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `إلغاء تحصيل شيك: ${cheque.chequeNumber}`,
        metadata: {
          amount: cheque.amount,
          chequeNumber: cheque.chequeNumber,
          previousStatus: cheque.status,
          newStatus: CHEQUE_STATUS_AR.PENDING,
          type: cheque.type,
        },
      });

      return true;
    } catch (error) {
      const appError = handleError(error);
      toast({
        title: getErrorTitle(appError),
        description: appError.message,
        variant: "destructive",
      });
      return false;
    }
  };

  return { submitCheque, deleteCheque, endorseCheque, clearCheque, bounceCheque, reverseChequeCashing };
}
