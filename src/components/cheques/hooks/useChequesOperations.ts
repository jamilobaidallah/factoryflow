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
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { firestore, storage } from "@/firebase/config";
import { Cheque, ChequeFormData } from "../types/cheques";

interface UseChequesOperationsReturn {
  submitCheque: (
    formData: ChequeFormData,
    editingCheque: Cheque | null,
    chequeImage: File | null
  ) => Promise<boolean>;
  deleteCheque: (chequeId: string, cheques: Cheque[]) => Promise<boolean>;
  endorseCheque: (cheque: Cheque, supplierName: string) => Promise<boolean>;
  clearCheque: (cheque: Cheque) => Promise<boolean>;
  bounceCheque: (cheque: Cheque) => Promise<boolean>;
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
          ? currentTotalPaid + amount
          : Math.max(0, currentTotalPaid - amount);
        const newRemainingBalance = transactionAmount - newTotalPaid;

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
        const pendingStatuses = ["قيد الانتظار", "pending"];
        const clearedStatuses = ["تم الصرف", "cleared", "محصل", "cashed"];
        const wasPending = pendingStatuses.includes(oldStatus);
        const isNowCleared = clearedStatuses.includes(newStatus);

        if (wasPending && isNowCleared) {
          updateData.clearedDate = new Date();

          const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
          const paymentType = formData.type === "وارد" ? "قبض" : "صرف";
          const chequeAmount = parseFloat(formData.amount);

          await addDoc(paymentsRef, {
            clientName: formData.clientName,
            amount: chequeAmount,
            type: paymentType,
            method: "cheque",
            linkedTransactionId: formData.linkedTransactionId || "",
            date: new Date(),
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
        const chequeAmount = parseFloat(formData.amount);

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

  const deleteCheque = async (chequeId: string, cheques: Cheque[]): Promise<boolean> => {
    if (!user) return false;

    try {
      const cheque = cheques.find((c) => c.id === chequeId);

      if (cheque && cheque.linkedTransactionId) {
        await updateARAPTracking(cheque.linkedTransactionId, cheque.amount, false);
      }

      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, chequeId);
      await deleteDoc(chequeRef);

      toast({
        title: "تم الحذف",
        description: cheque?.linkedTransactionId
          ? "تم حذف الشيك وتحديث الرصيد في دفتر الأستاذ"
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
        status: "مجيّر",
        endorsedTo: supplierName,
        endorsedDate: new Date(),
      });

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
      });

      await addDoc(paymentsRef, {
        clientName: supplierName,
        amount: cheque.amount,
        type: "صرف",
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

  const clearCheque = async (cheque: Cheque): Promise<boolean> => {
    if (!user) return false;

    try {
      const chequeRef = doc(firestore, `users/${user.uid}/cheques`, cheque.id);
      await updateDoc(chequeRef, {
        status: "تم الصرف",
        clearedDate: new Date(),
      });

      const paymentsRef = collection(firestore, `users/${user.uid}/payments`);
      const paymentType = cheque.type === "وارد" ? "قبض" : "صرف";

      await addDoc(paymentsRef, {
        clientName: cheque.clientName,
        amount: cheque.amount,
        type: paymentType,
        method: "cheque",
        linkedTransactionId: cheque.linkedTransactionId || "",
        date: new Date(),
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
        status: "مرفوض",
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

  return { submitCheque, deleteCheque, endorseCheque, clearCheque, bounceCheque };
}
