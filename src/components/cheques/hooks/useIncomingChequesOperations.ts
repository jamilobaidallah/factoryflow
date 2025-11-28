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

interface UseIncomingChequesOperationsReturn {
  submitCheque: (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null
  ) => Promise<boolean>;
  deleteCheque: (chequeId: string) => Promise<boolean>;
  endorseCheque: (
    cheque: Cheque,
    supplierName: string,
    transactionId: string
  ) => Promise<boolean>;
  cancelEndorsement: (cheque: Cheque) => Promise<boolean>;
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

  const submitCheque = async (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null
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
        const pendingStatuses = ["قيد الانتظار", "pending"];
        const clearedStatuses = ["تم الصرف", "cleared", "محصل", "cashed"];
        const wasPending = pendingStatuses.includes(oldStatus);
        const isNowCleared = clearedStatuses.includes(newStatus);

        if (wasPending && isNowCleared) {
          updateData.clearedDate = new Date();

          // Create a Payment record (receipt for incoming cheque)
          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const chequeAmount = parseFloat(formData.amount);

          await addDoc(paymentsRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: "قبض", // Receipt - client paid us
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            date: new Date(),
            notes: `تحصيل شيك رقم ${formData.chequeNumber}`,
            createdAt: new Date(),
          });

          // Update AR/AP tracking if linkedTransactionId exists
          if (formData.linkedTransactionId) {
            await updateARAPTracking(formData.linkedTransactionId, chequeAmount);
          }
        }

        await updateDoc(chequeRef, updateData);
        toast({
          title: "تم التحديث بنجاح",
          description: wasPending && isNowCleared
            ? `تم تحصيل الشيك رقم ${formData.chequeNumber} وإنشاء سند قبض`
            : "تم تحديث بيانات الشيك الوارد",
        });
      } else {
        const chequesRef = collection(firestore, `users/${user.uid}/cheques`);
        await addDoc(chequesRef, {
          chequeNumber: formData.chequeNumber,
          clientName: formData.clientName,
          amount: parseFloat(formData.amount),
          type: "وارد", // Always incoming
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
      const chequesRef = collection(firestore, `users/${user.uid}/cheques`);

      // 1. Update incoming cheque status and type
      const incomingChequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      await updateDoc(incomingChequeRef, {
        chequeType: "مجير",
        status: "مجيّر",
        endorsedTo: supplierName,
        endorsedDate: new Date(),
      });

      // 2. Create outgoing cheque entry
      const outgoingChequeDoc = await addDoc(chequesRef, {
        chequeNumber: cheque.chequeNumber,
        clientName: supplierName,
        amount: cheque.amount,
        type: "صادر",
        chequeType: "مجير",
        status: "قيد الانتظار",
        linkedTransactionId: transactionId.trim() || "",
        issueDate: cheque.issueDate,
        dueDate: cheque.dueDate,
        bankName: cheque.bankName,
        notes: `شيك مظهر من العميل: ${cheque.clientName}`,
        createdAt: new Date(),
        endorsedFromId: cheque.id,
        isEndorsedCheque: true,
      });

      // 3. Update incoming cheque with outgoing reference
      await updateDoc(incomingChequeRef, {
        endorsedToOutgoingId: outgoingChequeDoc.id,
      });

      // 4. Create payment record for original client (decrease receivable)
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      await addDoc(paymentsRef, {
        clientName: cheque.clientName,
        amount: cheque.amount,
        type: "قبض",
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: new Date(),
        notes: `تظهير شيك رقم ${cheque.chequeNumber} للمورد: ${supplierName}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: cheque.id,
      });

      // 5. Create payment record for supplier (decrease payable)
      await addDoc(paymentsRef, {
        clientName: supplierName,
        amount: cheque.amount,
        type: "صرف",
        linkedTransactionId: transactionId.trim() || cheque.linkedTransactionId || "",
        date: new Date(),
        notes: `استلام شيك مجيّر رقم ${cheque.chequeNumber} من العميل: ${cheque.clientName}`,
        createdAt: new Date(),
        isEndorsement: true,
        noCashMovement: true,
        endorsementChequeId: cheque.id,
      });

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

  const cancelEndorsement = async (cheque: Cheque): Promise<boolean> => {
    if (!user) return false;

    try {
      // 1. Delete the outgoing cheque entry if it exists
      if (cheque.endorsedToOutgoingId) {
        const outgoingChequeRef = doc(
          firestore,
          `users/${user.uid}/cheques`,
          cheque.endorsedToOutgoingId
        );
        await deleteDoc(outgoingChequeRef);
      }

      // 2. Revert incoming cheque to pending status
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        chequeType: "عادي",
        status: "قيد الانتظار",
        endorsedTo: null,
        endorsedDate: null,
        endorsedToOutgoingId: null,
      });

      // 3. Delete endorsement payment records
      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentsSnapshot = await getDocs(
        query(paymentsRef, where("endorsementChequeId", "==", cheque.id))
      );

      const deletePromises = paymentsSnapshot.docs.map((doc) =>
        deleteDoc(doc.ref)
      );
      await Promise.all(deletePromises);

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
