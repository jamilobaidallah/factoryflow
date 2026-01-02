"use client";

import { useUser } from "@/firebase/provider";
import { useToast } from "@/hooks/use-toast";
import { handleError, getErrorTitle } from "@/lib/error-handling";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { OvertimeEntry, OvertimeFormData, getMonthFromDate } from "../types/overtime";
import { Employee } from "../types/employees";
import { logActivity } from "@/services/activityLogService";
import { parseAmount } from "@/lib/currency";
import { toDate } from "@/lib/firestore-utils";

interface UseOvertimeOperationsReturn {
  createOvertimeEntry: (
    formData: OvertimeFormData,
    employee: Employee
  ) => Promise<boolean>;
  updateOvertimeEntry: (
    entryId: string,
    formData: OvertimeFormData,
    employee: Employee
  ) => Promise<boolean>;
  deleteOvertimeEntry: (entry: OvertimeEntry) => Promise<boolean>;
}

export function useOvertimeOperations(): UseOvertimeOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const createOvertimeEntry = async (
    formData: OvertimeFormData,
    employee: Employee
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const hours = parseAmount(formData.hours);
      if (hours <= 0) {
        toast({
          title: "خطأ في الساعات",
          description: "عدد الساعات يجب أن يكون أكبر من صفر",
          variant: "destructive",
        });
        return false;
      }

      // Validate date is not in the future
      const entryDate = new Date(formData.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (entryDate > today) {
        toast({
          title: "خطأ في التاريخ",
          description: "لا يمكن تسجيل وقت إضافي بتاريخ مستقبلي",
          variant: "destructive",
        });
        return false;
      }

      // Validate employee is overtime-eligible
      if (!employee.overtimeEligible) {
        toast({
          title: "الموظف غير مؤهل",
          description: "هذا الموظف غير مؤهل للوقت الإضافي",
          variant: "destructive",
        });
        return false;
      }

      // Validate entry date is not before hire date
      const hireDate = toDate(employee.hireDate);
      if (entryDate < hireDate) {
        toast({
          title: "خطأ في التاريخ",
          description: "تاريخ الوقت الإضافي قبل تاريخ التعيين",
          variant: "destructive",
        });
        return false;
      }

      const overtimeRef = collection(
        firestore,
        `users/${user.dataOwnerId}/overtime_entries`
      );

      const month = getMonthFromDate(formData.date);

      await addDoc(overtimeRef, {
        employeeId: employee.id,
        employeeName: employee.name,
        date: new Date(formData.date),
        hours,
        notes: formData.notes || "",
        month,
        createdAt: new Date(),
        createdBy: user.uid,
      });

      logActivity(user.dataOwnerId, {
        action: "create",
        module: "employees",
        targetId: employee.id,
        userId: user.uid,
        userEmail: user.email || "",
        description: `تسجيل وقت إضافي: ${employee.name} - ${hours} ساعات`,
        metadata: { hours, date: formData.date, month },
      });

      toast({
        title: "تم التسجيل",
        description: `تم تسجيل ${hours} ساعات وقت إضافي لـ ${employee.name}`,
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

  const updateOvertimeEntry = async (
    entryId: string,
    formData: OvertimeFormData,
    employee: Employee
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const hours = parseAmount(formData.hours);
      if (hours <= 0) {
        toast({
          title: "خطأ في الساعات",
          description: "عدد الساعات يجب أن يكون أكبر من صفر",
          variant: "destructive",
        });
        return false;
      }

      // Validate date is not in the future
      const entryDate = new Date(formData.date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (entryDate > today) {
        toast({
          title: "خطأ في التاريخ",
          description: "لا يمكن تسجيل وقت إضافي بتاريخ مستقبلي",
          variant: "destructive",
        });
        return false;
      }

      // Validate entry date is not before hire date
      const hireDate = toDate(employee.hireDate);
      if (entryDate < hireDate) {
        toast({
          title: "خطأ في التاريخ",
          description: "تاريخ الوقت الإضافي قبل تاريخ التعيين",
          variant: "destructive",
        });
        return false;
      }

      const entryRef = doc(
        firestore,
        `users/${user.dataOwnerId}/overtime_entries`,
        entryId
      );

      const month = getMonthFromDate(formData.date);

      await updateDoc(entryRef, {
        date: new Date(formData.date),
        hours,
        notes: formData.notes || "",
        month,
      });

      logActivity(user.dataOwnerId, {
        action: "update",
        module: "employees",
        targetId: entryId,
        userId: user.uid,
        userEmail: user.email || "",
        description: `تعديل وقت إضافي: ${employee.name} - ${hours} ساعات`,
        metadata: { hours, date: formData.date, month },
      });

      toast({
        title: "تم التحديث",
        description: `تم تحديث سجل الوقت الإضافي`,
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

  const deleteOvertimeEntry = async (entry: OvertimeEntry): Promise<boolean> => {
    if (!user) return false;

    // Check if entry is linked to processed payroll
    if (entry.linkedPayrollId) {
      toast({
        title: "لا يمكن الحذف",
        description: "هذا السجل مرتبط برواتب تمت معالجتها",
        variant: "destructive",
      });
      return false;
    }

    try {
      const entryRef = doc(
        firestore,
        `users/${user.dataOwnerId}/overtime_entries`,
        entry.id
      );

      await deleteDoc(entryRef);

      logActivity(user.dataOwnerId, {
        action: "delete",
        module: "employees",
        targetId: entry.id,
        userId: user.uid,
        userEmail: user.email || "",
        description: `حذف وقت إضافي: ${entry.employeeName} - ${entry.hours} ساعات`,
        metadata: { hours: entry.hours, date: entry.date, month: entry.month },
      });

      toast({
        title: "تم الحذف",
        description: `تم حذف سجل الوقت الإضافي`,
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

  return { createOvertimeEntry, updateOvertimeEntry, deleteOvertimeEntry };
}
