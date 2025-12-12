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
  writeBatch,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Employee, EmployeeFormData, PayrollEntry } from "../types/employees";

interface UseEmployeesOperationsReturn {
  submitEmployee: (
    formData: EmployeeFormData,
    editingEmployee: Employee | null
  ) => Promise<boolean>;
  deleteEmployee: (employeeId: string) => Promise<boolean>;
  processPayroll: (
    selectedMonth: string,
    employees: Employee[],
    payrollData: {[key: string]: {overtime: string, notes: string}}
  ) => Promise<boolean>;
  markAsPaid: (payrollEntry: PayrollEntry) => Promise<boolean>;
}

export function useEmployeesOperations(): UseEmployeesOperationsReturn {
  const { user } = useUser();
  const { toast } = useToast();

  const submitEmployee = async (
    formData: EmployeeFormData,
    editingEmployee: Employee | null
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      if (editingEmployee) {
        const oldSalary = editingEmployee.currentSalary;
        const newSalary = parseFloat(formData.currentSalary);

        // Update employee
        const employeeRef = doc(firestore, `users/${user.dataOwnerId}/employees`, editingEmployee.id);
        await updateDoc(employeeRef, {
          name: formData.name,
          currentSalary: newSalary,
          overtimeEligible: formData.overtimeEligible,
          position: formData.position,
          hireDate: new Date(formData.hireDate),
        });

        // If salary changed, record history
        if (oldSalary !== newSalary) {
          const incrementPercentage = ((newSalary - oldSalary) / oldSalary) * 100;
          const historyRef = collection(firestore, `users/${user.dataOwnerId}/salary_history`);
          await addDoc(historyRef, {
            employeeId: editingEmployee.id,
            employeeName: formData.name,
            oldSalary: oldSalary,
            newSalary: newSalary,
            incrementPercentage: incrementPercentage,
            effectiveDate: new Date(),
            notes: incrementPercentage > 0 ? "زيادة راتب" : "تخفيض راتب",
            createdAt: new Date(),
          });
        }

        toast({
          title: "تم التحديث",
          description: "تم تحديث بيانات الموظف بنجاح",
        });
      } else {
        const employeesRef = collection(firestore, `users/${user.dataOwnerId}/employees`);
        await addDoc(employeesRef, {
          name: formData.name,
          currentSalary: parseFloat(formData.currentSalary),
          overtimeEligible: formData.overtimeEligible,
          position: formData.position,
          hireDate: new Date(formData.hireDate),
          createdAt: new Date(),
        });

        toast({
          title: "تمت الإضافة",
          description: "تم إضافة موظف جديد بنجاح",
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

  const deleteEmployee = async (employeeId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const employeeRef = doc(firestore, `users/${user.dataOwnerId}/employees`, employeeId);
      await deleteDoc(employeeRef);
      toast({
        title: "تم الحذف",
        description: "تم حذف الموظف بنجاح",
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

  const calculateOvertimePay = (currentSalary: number, overtimeHours: number): number => {
    // Calculate hourly rate: monthly salary ÷ 208 hours (26 days × 8 hours)
    const hourlyRate = currentSalary / 208;
    // Overtime at 1.5x
    return overtimeHours * hourlyRate * 1.5;
  };

  const processPayroll = async (
    selectedMonth: string,
    employees: Employee[],
    payrollData: {[key: string]: {overtime: string, notes: string}}
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const batch = writeBatch(firestore);
      const payrollRef = collection(firestore, `users/${user.dataOwnerId}/payroll`);

      for (const employee of employees) {
        const overtimeHours = parseFloat(payrollData[employee.id]?.overtime || "0");
        const overtimePay = employee.overtimeEligible
          ? calculateOvertimePay(employee.currentSalary, overtimeHours)
          : 0;
        const totalSalary = employee.currentSalary + overtimePay;

        const payrollDocRef = doc(payrollRef);
        batch.set(payrollDocRef, {
          employeeId: employee.id,
          employeeName: employee.name,
          month: selectedMonth,
          baseSalary: employee.currentSalary,
          overtimeHours: overtimeHours,
          overtimePay: overtimePay,
          totalSalary: totalSalary,
          isPaid: false,
          notes: payrollData[employee.id]?.notes || "",
          createdAt: new Date(),
        });
      }

      await batch.commit();

      toast({
        title: "تمت المعالجة",
        description: `تم إنشاء كشف رواتب ${selectedMonth} بنجاح`,
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

  const markAsPaid = async (payrollEntry: PayrollEntry): Promise<boolean> => {
    if (!user) return false;

    try {
      const batch = writeBatch(firestore);

      // Generate transaction ID
      const now = new Date();
      const transactionId = `SAL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;

      // Update payroll entry
      const payrollRef = doc(firestore, `users/${user.dataOwnerId}/payroll`, payrollEntry.id);
      batch.update(payrollRef, {
        isPaid: true,
        paidDate: new Date(),
        linkedTransactionId: transactionId,
      });

      // Create ledger entry
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
      const ledgerDocRef = doc(ledgerRef);
      batch.set(ledgerDocRef, {
        transactionId: transactionId,
        description: `راتب ${payrollEntry.employeeName} - ${payrollEntry.month}`,
        type: "مصروف",
        amount: payrollEntry.totalSalary,
        category: "مصاريف تشغيلية",
        subCategory: "رواتب وأجور",
        associatedParty: payrollEntry.employeeName,
        date: new Date(),
        reference: `Payroll-${payrollEntry.month}`,
        notes: `راتب شهر ${payrollEntry.month}${payrollEntry.overtimeHours > 0 ? ` - ساعات إضافية: ${payrollEntry.overtimeHours}` : ""}`,
        createdAt: new Date(),
      });

      // Create payment entry
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentDocRef = doc(paymentsRef);
      batch.set(paymentDocRef, {
        clientName: payrollEntry.employeeName,
        amount: payrollEntry.totalSalary,
        type: "صرف",
        linkedTransactionId: transactionId,
        date: new Date(),
        notes: `دفع راتب ${payrollEntry.month}`,
        createdAt: new Date(),
      });

      await batch.commit();

      toast({
        title: "تم الدفع",
        description: `تم تسجيل دفع راتب ${payrollEntry.employeeName}`,
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

  return { submitEmployee, deleteEmployee, processPayroll, markAsPaid };
}
