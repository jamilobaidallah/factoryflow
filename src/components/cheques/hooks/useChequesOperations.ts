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

        await updateDoc(doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id), {
          totalPaid: newTotalPaid,
          remainingBalance: newRemainingBalance,
          paymentStatus: newStatus,
        });
      }
    }
  };

  const submitCheque = async (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null,
    paymentDate?: Date
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      let chequeImageUrl: string | undefined = undefined;
      if (chequeImage) {
        const imageRef = ref(
          storage,
          `users/${user.uid}/cheques/${Date.now()}_${chequeImage.name}`
        );
        await uploadBytes(imageRef, chequeImage);
        chequeImageUrl = await getDownloadURL(imageRef);
      }

      if (editingCheque) {
        const chequeRef = doc(firestore, `users/${user.uid}/cheques`, editingCheque.id);
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
          // Use provided payment date or fall back to current date
          const effectivePaymentDate = paymentDate || new Date();

          updateData.clearedDate = effectivePaymentDate;

          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const paymentType = formData.type === CHEQUE_TYPES.INCOMING ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;
          const chequeAmount = parseAmount(formData.amount);

          await addDoc(paymentsRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: paymentType,
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            date: effectivePaymentDate,
            notes: `تحصيل شيك رقم ${formData.chequeNumber}`,
            createdAt: new Date(),
          });

          if (formData.linkedTransactionId) {
            await updateARAPTracking(formData.linkedTransactionId, chequeAmount, true);
          }
        }

        await updateDoc(chequeRef, updateData);
        toast({
          title: "تم التحديث بنجاح",
          description: wasPending && isNowCleared
            ? `تم تحصيل الشيك رقم ${formData.chequeNumber} وإنشاء سند قبض/صرف`
            : "تم تحديث بيانات الشيك",
        });
      } else {
        const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
        const chequeAmount = parseAmount(formData.amount);

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

        if (formData.linkedTransactionId) {
          await updateARAPTracking(formData.linkedTransactionId, chequeAmount, true);
        }

        toast({
          title: "تمت الإضافة بنجاح",
          description: formData.linkedTransactionId
            ? "تم إضافة الشيك وتحديث الرصيد المتبقي في دفتر الأستاذ"
            : "تم إضافة شيك جديد",
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

      // Step 1: Find all associated payment records linked to this cheque
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
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
        const ledgerRef = collection(firestore, `users/${user.uid}/ledger`);
        const ledgerQuery = query(
          ledgerRef,
          where("transactionId", "==", cheque.linkedTransactionId.trim())
        );
        const ledgerSnapshot = await getDocs(ledgerQuery);

        if (!ledgerSnapshot.empty) {
          const ledgerDoc = ledgerSnapshot.docs[0];
          ledgerDocRef = doc(firestore, `users/${user.uid}/ledger`, ledgerDoc.id);
          ledgerData = ledgerDoc.data();
        }
      }

      // Step 3: Execute atomic transaction
      await runTransaction(firestore, async (transaction) => {
        const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeId);

        // Delete the cheque
        transaction.delete(chequeRef);

        // Delete all associated payment records
        relatedPayments.forEach((paymentDoc) => {
          const paymentRef = doc(firestore, `users/${user.uid}/payments`, paymentDoc.id);
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

  const endorseCheque = async (cheque: Cheque, supplierName: string): Promise<boolean> => {
    if (!user || !supplierName.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال اسم المورد",
        variant: "destructive",
      });
      return false;
    }

    try {
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        chequeType: "مجير",
        status: CHEQUE_STATUS_AR.ENDORSED,
        endorsedTo: supplierName,
        endorsedDate: new Date(),
      });

      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      await addDoc(paymentsRef, {
        clientName: cheque.clientName,
        amount: cheque.amount,
        type: PAYMENT_TYPES.RECEIPT,
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: new Date(),
        notes: `تظهير شيك رقم ${cheque.chequeNumber} للمورد: ${supplierName}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
      });

      await addDoc(paymentsRef, {
        clientName: supplierName,
        amount: cheque.amount,
        type: PAYMENT_TYPES.DISBURSEMENT,
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: new Date(),
        notes: `استلام شيك مجيّر رقم ${cheque.chequeNumber} من العميل: ${cheque.clientName}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
      });

      toast({
        title: "تم التظهير بنجاح",
        description: `تم تظهير الشيك رقم ${cheque.chequeNumber} إلى ${supplierName}`,
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

  const clearCheque = async (cheque: Cheque, paymentDate?: Date): Promise<boolean> => {
    if (!user) return false;

    try {
      // Use provided payment date or fall back to current date
      const effectivePaymentDate = paymentDate || new Date();

      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        status: CHEQUE_STATUS_AR.CASHED,
        clearedDate: effectivePaymentDate,
      });

      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentType = cheque.type === CHEQUE_TYPES.INCOMING ? PAYMENT_TYPES.RECEIPT : PAYMENT_TYPES.DISBURSEMENT;

      await addDoc(paymentsRef, {
        clientName: cheque.clientName,
        amount: cheque.amount,
        type: paymentType,
        method: "cheque",
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: effectivePaymentDate,
        notes: `تحصيل شيك مؤجل رقم ${cheque.chequeNumber}`,
        createdAt: new Date(),
      });

      if (cheque.linkedTransactionId) {
        await updateARAPTracking(cheque.linkedTransactionId, cheque.amount, true);
      }

      toast({
        title: "تم التحصيل بنجاح",
        description: `تم تحصيل الشيك رقم ${cheque.chequeNumber} وتحديث الرصيد`,
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

    try {
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        status: CHEQUE_STATUS_AR.BOUNCED,
        bouncedDate: new Date(),
      });

      toast({
        title: "تم تسجيل الشيك كمرتجع",
        description: `تم تسجيل الشيك رقم ${cheque.chequeNumber} كمرتجع. رصيد العميل لم يتغير.`,
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
        `users/${user.uid}/payments/${paymentId}/allocations`
      );
      const allocationsSnapshot = await getDocs(allocationsRef);

      // Step 2: Reverse each allocation on the ledger
      for (const allocationDoc of allocationsSnapshot.docs) {
        const allocation = allocationDoc.data();
        const ledgerDocId = allocation.ledgerDocId;

        if (ledgerDocId) {
          // Get current ledger entry state
          const ledgerRef = doc(firestore, `users/${user.uid}/ledger`, ledgerDocId);
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
      const paymentRef = doc(firestore, `users/${user.uid}/payments`, paymentId);
      batch.delete(paymentRef);

      // Step 4: Update the cheque to clear linked payment data
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
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
