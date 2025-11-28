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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firestore, storage } from "@/firebase/config";
import { Cheque, ChequeFormData } from "../types/cheques";
import { CHEQUE_TYPES, CHEQUE_STATUS_AR, PAYMENT_TYPES } from "@/lib/constants";

interface UseOutgoingChequesOperationsReturn {
  submitCheque: (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null
  ) => Promise<boolean>;
  deleteCheque: (chequeId: string) => Promise<boolean>;
  linkTransaction: (cheque: Cheque, transactionId: string) => Promise<boolean>;
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
          ? currentTotalPaid + amount
          : Math.max(0, currentTotalPaid - amount);
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

  const submitCheque = async (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Upload image if provided
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
          // إضافة تاريخ الصرف عند تغيير الحالة إلى تم الصرف
          updateData.clearedDate = new Date();

          // Create a Payment record (disbursement for outgoing cheque)
          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const chequeAmount = parseFloat(formData.amount);

          const paymentRef = await addDoc(paymentsRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: PAYMENT_TYPES.DISBURSEMENT, // Disbursement - we paid the supplier
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            linkedChequeId: editingCheque.id,
            date: new Date(),
            notes: `صرف شيك رقم ${formData.chequeNumber}`,
            createdAt: new Date(),
          });

          // Store the payment ID in the cheque for later reference
          updateData.linkedPaymentId = paymentRef.id;

          // تحديث تتبع الذمم الدائنة (AP) إذا كان هناك قيد مرتبط
          // Update Accounts Payable tracking if linked to a ledger entry
          if (formData.linkedTransactionId) {
            await updateARAPTracking(formData.linkedTransactionId, chequeAmount, true);
          }
        } else if (wasCleared && isNowBouncedOrReverted) {
          // مهم: حذف سجل الدفع عند إرجاع الشيك (مرتجع أو إلغاء الصرف)
          // Important: Delete payment record when cheque is bounced or reverted
          const chequeAmount = parseFloat(formData.amount);

          // Delete the associated payment record
          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const paymentQuery = query(
            paymentsRef,
            where("linkedChequeId", "==", editingCheque.id)
          );
          const paymentSnapshot = await getDocs(paymentQuery);

          // If we don't find by linkedChequeId, try finding by linkedTransactionId and amount
          if (paymentSnapshot.empty && formData.linkedTransactionId) {
            const altPaymentQuery = query(
              paymentsRef,
              where("linkedTransactionId", "==", formData.linkedTransactionId.trim()),
              where("method", "==", "cheque"),
              where("amount", "==", chequeAmount)
            );
            const altPaymentSnapshot = await getDocs(altPaymentQuery);
            for (const paymentDoc of altPaymentSnapshot.docs) {
              await deleteDoc(doc(firestore, `users/${user.uid}/payments`, paymentDoc.id));
            }
          } else {
            for (const paymentDoc of paymentSnapshot.docs) {
              await deleteDoc(doc(firestore, `users/${user.uid}/payments`, paymentDoc.id));
            }
          }

          // إزالة تاريخ الصرف ومرجع الدفع من الشيك
          updateData.clearedDate = null;
          updateData.linkedPaymentId = null;

          // إرجاع تتبع الذمم الدائنة - استرداد المبلغ المدفوع
          // Revert Accounts Payable tracking - restore the paid amount
          if (formData.linkedTransactionId) {
            await updateARAPTracking(formData.linkedTransactionId, chequeAmount, false);
          }
        }

        await updateDoc(chequeRef, updateData);

        let toastDescription = "تم تحديث بيانات الشيك الصادر";
        if (wasPending && isNowCleared) {
          toastDescription = `تم صرف الشيك رقم ${formData.chequeNumber} وإنشاء سند صرف`;
        } else if (wasCleared && isNowBouncedOrReverted) {
          if (newStatus === CHEQUE_STATUS_AR.RETURNED || newStatus === "bounced") {
            toastDescription = `تم تسجيل الشيك رقم ${formData.chequeNumber} كمرتجع وإلغاء سند الصرف`;
          } else {
            toastDescription = `تم إرجاع الشيك رقم ${formData.chequeNumber} إلى قيد الانتظار وإلغاء سند الصرف`;
          }
        }

        toast({
          title: "تم التحديث بنجاح",
          description: toastDescription,
        });
      } else {
        const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
        await addDoc(chequesRef, {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: CHEQUE_TYPES.OUTGOING, // Always outgoing
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
      }

      return true;
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ البيانات",
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

  const linkTransaction = async (cheque: Cheque, transactionId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        linkedTransactionId: transactionId.trim(),
      });

      toast({
        title: "تم الربط بنجاح",
        description: transactionId.trim()
          ? `تم ربط الشيك بالمعاملة ${transactionId}`
          : "تم إلغاء ربط الشيك بالمعاملة",
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
