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
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Employee, EmployeeFormData, PayrollEntry } from "../types/employees";
import { logActivity } from "@/services/activityLogService";
import {
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  parseAmount,
} from "@/lib/currency";

interface UseEmployeesOperationsReturn {
  submitEmployee: (
    formData: EmployeeFormData,
    editingEmployee: Employee | null
  ) => Promise<boolean>;
  deleteEmployee: (employeeId: string, employee?: Employee) => Promise<boolean>;
  processPayroll: (
    selectedMonth: string,
    employees: Employee[],
    payrollData: {[key: string]: {overtime: string, bonus: string, deduction: string, notes: string}}
  ) => Promise<boolean>;
  markAsPaid: (payrollEntry: PayrollEntry) => Promise<boolean>;
  deletePayrollEntry: (payrollEntry: PayrollEntry) => Promise<boolean>;
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
        const newSalary = parseAmount(formData.currentSalary);

        // Update employee
        const employeeRef = doc(firestore, `users/${user.dataOwnerId}/employees`, editingEmployee.id);
        await updateDoc(employeeRef, {
          name: formData.name,
          currentSalary: newSalary,
          overtimeEligible: formData.overtimeEligible,
          position: formData.position,
          hireDate: new Date(formData.hireDate),
        });

        // If salary changed, record history and log activity
        if (oldSalary !== newSalary) {
          const incrementPercentage = safeMultiply(
            safeDivide(safeSubtract(newSalary, oldSalary), oldSalary),
            100
          );
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

          // Log salary change activity
          logActivity(user.dataOwnerId, {
            action: 'update',
            module: 'employees',
            targetId: editingEmployee.id,
            userId: user.uid,
            userEmail: user.email || '',
            description: `تعديل راتب: ${formData.name} → ${newSalary} دينار`,
            metadata: {
              salary: newSalary,
              position: formData.position,
              name: formData.name,
              oldSalary,
              incrementPercentage,
            },
          });
        } else {
          // Log regular update activity
          logActivity(user.dataOwnerId, {
            action: 'update',
            module: 'employees',
            targetId: editingEmployee.id,
            userId: user.uid,
            userEmail: user.email || '',
            description: `تعديل بيانات موظف: ${formData.name}`,
            metadata: {
              salary: newSalary,
              position: formData.position,
              name: formData.name,
            },
          });
        }

        toast({
          title: "تم التحديث",
          description: "تم تحديث بيانات الموظف بنجاح",
        });
      } else {
        const employeesRef = collection(firestore, `users/${user.dataOwnerId}/employees`);
        const docRef = await addDoc(employeesRef, {
          name: formData.name,
          currentSalary: parseAmount(formData.currentSalary),
          overtimeEligible: formData.overtimeEligible,
          position: formData.position,
          hireDate: new Date(formData.hireDate),
          createdAt: new Date(),
        });

        // Log activity for create
        logActivity(user.dataOwnerId, {
          action: 'create',
          module: 'employees',
          targetId: docRef.id,
          userId: user.uid,
          userEmail: user.email || '',
          description: `إضافة موظف: ${formData.name}`,
          metadata: {
            salary: parseAmount(formData.currentSalary),
            position: formData.position,
            name: formData.name,
          },
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

  const deleteEmployee = async (employeeId: string, employee?: Employee): Promise<boolean> => {
    if (!user) return false;

    try {
      const batch = writeBatch(firestore);

      // Delete the employee document
      const employeeRef = doc(firestore, `users/${user.dataOwnerId}/employees`, employeeId);
      batch.delete(employeeRef);

      // Delete related payroll entries (unpaid only - paid ones are already in ledger)
      const payrollRef = collection(firestore, `users/${user.dataOwnerId}/payroll`);
      const payrollQuery = query(
        payrollRef,
        where("employeeId", "==", employeeId),
        where("isPaid", "==", false),
        limit(100)
      );
      const payrollSnapshot = await getDocs(payrollQuery);
      payrollSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      // Delete related salary history
      const historyRef = collection(firestore, `users/${user.dataOwnerId}/salary_history`);
      const historyQuery = query(
        historyRef,
        where("employeeId", "==", employeeId),
        limit(100)
      );
      const historySnapshot = await getDocs(historyQuery);
      historySnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });

      await batch.commit();

      // Log activity for delete
      logActivity(user.dataOwnerId, {
        action: 'delete',
        module: 'employees',
        targetId: employeeId,
        userId: user.uid,
        userEmail: user.email || '',
        description: `حذف موظف: ${employee?.name || ''}`,
        metadata: {
          salary: employee?.currentSalary,
          position: employee?.position,
          name: employee?.name,
          deletedPayrollEntries: payrollSnapshot.size,
          deletedHistoryEntries: historySnapshot.size,
        },
      });

      toast({
        title: "تم الحذف",
        description: "تم حذف الموظف وسجلاته بنجاح",
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
    const hourlyRate = safeDivide(currentSalary, 208);
    // Overtime at 1.5x
    return safeMultiply(safeMultiply(overtimeHours, hourlyRate), 1.5);
  };

  const processPayroll = async (
    selectedMonth: string,
    employees: Employee[],
    payrollData: {[key: string]: {overtime: string, bonus: string, deduction: string, notes: string}}
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const payrollRef = collection(firestore, `users/${user.dataOwnerId}/payroll`);

      // Check for existing payroll entries for this month
      const existingQuery = query(
        payrollRef,
        where("month", "==", selectedMonth),
        limit(1)
      );
      const existingSnapshot = await getDocs(existingQuery);

      if (!existingSnapshot.empty) {
        toast({
          title: "تم المعالجة مسبقاً",
          description: `تم معالجة رواتب شهر ${selectedMonth} مسبقاً. لا يمكن المعالجة مرة أخرى.`,
          variant: "destructive",
        });
        return false;
      }

      // Filter employees by hire date - only include those hired on or before the first day of selected month
      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStartDate = new Date(year, month - 1, 1); // First day of selected month

      const eligibleEmployees = employees.filter(employee => {
        const hireDate = employee.hireDate instanceof Date
          ? employee.hireDate
          : new Date(employee.hireDate);
        return hireDate <= monthStartDate;
      });

      const skippedCount = employees.length - eligibleEmployees.length;

      if (eligibleEmployees.length === 0) {
        toast({
          title: "لا يوجد موظفين مؤهلين",
          description: `جميع الموظفين تم تعيينهم بعد شهر ${selectedMonth}`,
          variant: "destructive",
        });
        return false;
      }

      const batch = writeBatch(firestore);

      for (const employee of eligibleEmployees) {
        const empData = payrollData[employee.id] || { overtime: "", bonus: "", deduction: "", notes: "" };
        const overtimeHours = parseAmount(empData.overtime || "0");
        const bonusAmount = parseAmount(empData.bonus || "0");
        const deductionAmount = parseAmount(empData.deduction || "0");
        const overtimePay = employee.overtimeEligible
          ? calculateOvertimePay(employee.currentSalary, overtimeHours)
          : 0;

        // Total = Base + Overtime + Bonus - Deduction
        const totalSalary = safeSubtract(
          safeAdd(safeAdd(employee.currentSalary, overtimePay), bonusAmount),
          deductionAmount
        );

        const payrollDocRef = doc(payrollRef);
        batch.set(payrollDocRef, {
          employeeId: employee.id,
          employeeName: employee.name,
          month: selectedMonth,
          baseSalary: employee.currentSalary,
          overtimeHours: overtimeHours,
          overtimePay: overtimePay,
          bonuses: bonusAmount > 0 ? [{ id: "1", type: "other", description: "مكافأة", amount: bonusAmount }] : [],
          deductions: deductionAmount > 0 ? [{ id: "1", type: "other", description: "خصم", amount: deductionAmount }] : [],
          totalSalary: totalSalary,
          isPaid: false,
          notes: empData.notes || "",
          createdAt: new Date(),
        });
      }

      await batch.commit();

      // Log activity for payroll processing
      logActivity(user.dataOwnerId, {
        action: 'create',
        module: 'employees',
        targetId: selectedMonth,
        userId: user.uid,
        userEmail: user.email || '',
        description: `معالجة رواتب شهر ${selectedMonth}`,
        metadata: {
          month: selectedMonth,
          employeeCount: eligibleEmployees.length,
          skippedCount,
        },
      });

      const skippedMessage = skippedCount > 0
        ? ` (تم تخطي ${skippedCount} موظف لم يتم تعيينهم بعد)`
        : '';

      toast({
        title: "تمت المعالجة",
        description: `تم إنشاء كشف رواتب ${selectedMonth} لـ ${eligibleEmployees.length} موظف${skippedMessage}`,
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
        category: "مصاريف تشغيلية",
        subCategory: "رواتب وأجور",
        createdAt: new Date(),
      });

      await batch.commit();

      // Log activity for payment
      logActivity(user.dataOwnerId, {
        action: 'update',
        module: 'employees',
        targetId: payrollEntry.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `تسجيل دفع راتب: ${payrollEntry.employeeName}`,
        metadata: {
          salary: payrollEntry.totalSalary,
          name: payrollEntry.employeeName,
          month: payrollEntry.month,
        },
      });

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

  const deletePayrollEntry = async (payrollEntry: PayrollEntry): Promise<boolean> => {
    if (!user) return false;

    // Only allow deleting unpaid entries
    if (payrollEntry.isPaid) {
      toast({
        title: "لا يمكن الحذف",
        description: "لا يمكن حذف سجل راتب تم دفعه. يرجى عكس الدفع أولاً.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const payrollRef = doc(firestore, `users/${user.dataOwnerId}/payroll`, payrollEntry.id);
      await deleteDoc(payrollRef);

      // Log activity for delete
      logActivity(user.dataOwnerId, {
        action: 'delete',
        module: 'employees',
        targetId: payrollEntry.id,
        userId: user.uid,
        userEmail: user.email || '',
        description: `حذف سجل راتب: ${payrollEntry.employeeName} - ${payrollEntry.month}`,
        metadata: {
          employeeName: payrollEntry.employeeName,
          month: payrollEntry.month,
          totalSalary: payrollEntry.totalSalary,
        },
      });

      toast({
        title: "تم الحذف",
        description: `تم حذف سجل راتب ${payrollEntry.employeeName}`,
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

  return { submitEmployee, deleteEmployee, processPayroll, markAsPaid, deletePayrollEntry };
}
