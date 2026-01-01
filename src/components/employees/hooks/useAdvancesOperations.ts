"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import {
  collection,
  doc,
  writeBatch,
  updateDoc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Advance, AdvanceFormData } from "../types/advances";
import { Employee } from "../types/employees";
import { logActivity } from "@/services/activityLogService";
import { parseAmount, safeSubtract } from "@/lib/currency";
import { ADVANCE_STATUS } from "@/lib/constants";

interface UseAdvancesOperationsReturn {
  createAdvance: (
    formData: AdvanceFormData,
    employee: Employee
  ) => Promise<boolean>;
  cancelAdvance: (advance: Advance) => Promise<boolean>;
  deductFromAdvance: (
    advanceId: string,
    amount: number,
    payrollId: string,
    month: string
  ) => Promise<boolean>;
}

export function useAdvancesOperations(): UseAdvancesOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const createAdvance = async (
    formData: AdvanceFormData,
    employee: Employee
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const amount = parseAmount(formData.amount);
      if (amount <= 0) {
        toast({
          title: "خطأ في المبلغ",
          description: "المبلغ يجب أن يكون أكبر من صفر",
          variant: "destructive",
        });
        return false;
      }

      // Validate date is not in the future
      const advanceDate = new Date(formData.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999); // End of today
      if (advanceDate > today) {
        toast({
          title: "خطأ في التاريخ",
          description: "لا يمكن تسجيل سلفة بتاريخ مستقبلي",
          variant: "destructive",
        });
        return false;
      }

      const batch = writeBatch(firestore);

      // Generate transaction ID
      const now = new Date();
      const transactionId = `ADV-${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
        Math.floor(Math.random() * 1000)
      ).padStart(3, "0")}`;

      // Create advance record
      const advancesRef = collection(
        firestore,
        `users/${user.dataOwnerId}/advances`
      );
      const advanceDocRef = doc(advancesRef);
      batch.set(advanceDocRef, {
        employeeId: employee.id,
        employeeName: employee.name,
        amount,
        date: new Date(formData.date),
        remainingAmount: amount,
        status: ADVANCE_STATUS.ACTIVE,
        linkedTransactionId: transactionId,
        notes: formData.notes,
        createdAt: new Date(),
      });

      // Create ledger entry (expense - advances are essentially loans to employees)
      const ledgerRef = collection(
        firestore,
        `users/${user.dataOwnerId}/ledger`
      );
      const ledgerDocRef = doc(ledgerRef);
      batch.set(ledgerDocRef, {
        transactionId,
        description: `سلفة ${employee.name}`,
        type: "مصروف",
        amount,
        category: "مصاريف تشغيلية",
        subCategory: "سلف موظفين",
        associatedParty: employee.name,
        date: new Date(formData.date),
        notes: formData.notes || `سلفة للموظف ${employee.name}`,
        createdAt: new Date(),
      });

      // Create payment entry (disbursement)
      const paymentsRef = collection(
        firestore,
        `users/${user.dataOwnerId}/payments`
      );
      const paymentDocRef = doc(paymentsRef);
      batch.set(paymentDocRef, {
        clientName: employee.name,
        amount,
        type: "صرف",
        linkedTransactionId: transactionId,
        date: new Date(formData.date),
        notes: `سلفة ${employee.name}`,
        category: "مصاريف تشغيلية",
        subCategory: "سلف موظفين",
        createdAt: new Date(),
      });

      await batch.commit();

      logActivity(user.dataOwnerId, {
        action: "create",
        module: "employees",
        targetId: advanceDocRef.id,
        userId: user.uid,
        userEmail: user.email || "",
        description: `صرف سلفة: ${employee.name} - ${amount} دينار`,
        metadata: { amount, employeeId: employee.id },
      });

      toast({
        title: "تم صرف السلفة",
        description: `تم صرف سلفة ${amount} دينار لـ ${employee.name}`,
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

  const cancelAdvance = async (advance: Advance): Promise<boolean> => {
    if (!user) return false;

    if (advance.status !== ADVANCE_STATUS.ACTIVE) {
      toast({
        title: "لا يمكن الإلغاء",
        description: "يمكن إلغاء السلف النشطة فقط",
        variant: "destructive",
      });
      return false;
    }

    try {
      const advanceRef = doc(
        firestore,
        `users/${user.dataOwnerId}/advances`,
        advance.id
      );
      await updateDoc(advanceRef, {
        status: ADVANCE_STATUS.CANCELLED,
      });

      logActivity(user.dataOwnerId, {
        action: "update",
        module: "employees",
        targetId: advance.id,
        userId: user.uid,
        userEmail: user.email || "",
        description: `إلغاء سلفة: ${advance.employeeName}`,
        metadata: { amount: advance.amount, employeeId: advance.employeeId },
      });

      toast({
        title: "تم الإلغاء",
        description: `تم إلغاء سلفة ${advance.employeeName}`,
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

  const deductFromAdvance = async (
    advanceId: string,
    amount: number,
    payrollId: string,
    month: string
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const advanceRef = doc(
        firestore,
        `users/${user.dataOwnerId}/advances`,
        advanceId
      );

      // Get current advance to calculate new remaining
      // Note: In a real scenario, we'd fetch the advance first
      // For now, we'll update with the calculated remaining amount
      // This should be called with the correct remaining amount calculation

      await updateDoc(advanceRef, {
        remainingAmount: amount,
        status:
          amount <= 0
            ? ADVANCE_STATUS.FULLY_DEDUCTED
            : ADVANCE_STATUS.ACTIVE,
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

  return { createAdvance, cancelAdvance, deductFromAdvance };
}
