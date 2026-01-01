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
import { Advance } from "../types/advances";
import { logActivity } from "@/services/activityLogService";
import { ADVANCE_STATUS } from "@/lib/constants";
import {
  safeAdd,
  safeSubtract,
  safeMultiply,
  safeDivide,
  parseAmount,
} from "@/lib/currency";
import { toDate } from "@/lib/firestore-utils";

interface UseEmployeesOperationsReturn {
  submitEmployee: (
    formData: EmployeeFormData,
    editingEmployee: Employee | null
  ) => Promise<boolean>;
  deleteEmployee: (employeeId: string, employee?: Employee) => Promise<boolean>;
  processPayroll: (
    selectedMonth: string,
    employees: Employee[],
    payrollData: {[key: string]: {overtime: string, bonus: string, deduction: string, notes: string}},
    advances?: Advance[]
  ) => Promise<boolean>;
  markAsPaid: (payrollEntry: PayrollEntry) => Promise<boolean>;
  deletePayrollEntry: (payrollEntry: PayrollEntry) => Promise<boolean>;
  undoMonthPayroll: (selectedMonth: string, monthPayroll: PayrollEntry[]) => Promise<boolean>;
  reversePayment: (payrollEntry: PayrollEntry) => Promise<boolean>;
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
    payrollData: {[key: string]: {overtime: string, bonus: string, deduction: string, notes: string}},
    advances?: Advance[]
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      // Validate that selected month is not in the future
      const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number);
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed

      if (selectedYear > currentYear || (selectedYear === currentYear && selectedMonthNum > currentMonth)) {
        toast({
          title: "خطأ في الشهر",
          description: "لا يمكن معالجة رواتب شهر مستقبلي",
          variant: "destructive",
        });
        return false;
      }

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

      // Filter employees by hire date - only include those hired during or before the selected month
      const [year, month] = selectedMonth.split('-').map(Number);

      const eligibleEmployees = employees.filter(employee => {
        const hireDate = toDate(employee.hireDate);
        const hireYear = hireDate.getFullYear();
        const hireMonth = hireDate.getMonth() + 1; // getMonth() is 0-indexed

        // Employee is eligible if hired in the selected month or any previous month
        if (hireYear < year) return true;
        if (hireYear === year && hireMonth <= month) return true;
        return false;
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

      // Calculate days in the selected month
      const daysInMonth = new Date(year, month, 0).getDate();

      for (const employee of eligibleEmployees) {
        const empData = payrollData[employee.id] || { overtime: "", bonus: "", deduction: "", notes: "" };
        const overtimeHours = parseAmount(empData.overtime || "0");
        const bonusAmount = parseAmount(empData.bonus || "0");
        const deductionAmount = parseAmount(empData.deduction || "0");

        // Check if employee was hired mid-month (proration needed)
        const hireDate = toDate(employee.hireDate);
        const hireYear = hireDate.getFullYear();
        const hireMonth = hireDate.getMonth() + 1;
        const hireDay = hireDate.getDate();

        let baseSalary = employee.currentSalary;
        let daysWorked = daysInMonth;
        let isProrated = false;

        // If hired in the selected month, prorate the salary
        if (hireYear === year && hireMonth === month && hireDay > 1) {
          daysWorked = daysInMonth - hireDay + 1;
          baseSalary = safeMultiply(
            safeDivide(employee.currentSalary, daysInMonth),
            daysWorked
          );
          isProrated = true;
        }

        const overtimePay = employee.overtimeEligible
          ? calculateOvertimePay(employee.currentSalary, overtimeHours)
          : 0;

        // Total = Base (prorated if applicable) + Overtime + Bonus - Deduction
        const totalSalary = safeSubtract(
          safeAdd(safeAdd(baseSalary, overtimePay), bonusAmount),
          deductionAmount
        );

        // Calculate advance deductions for this employee
        // Find active advances for this employee
        const employeeActiveAdvances = advances?.filter(
          (a) => a.employeeId === employee.id && a.status === ADVANCE_STATUS.ACTIVE
        ) || [];

        // Sum up remaining amounts from active advances
        let advanceDeduction = 0;
        const advanceIds: string[] = [];
        for (const advance of employeeActiveAdvances) {
          advanceDeduction = safeAdd(advanceDeduction, advance.remainingAmount);
          advanceIds.push(advance.id);
        }

        // Net salary = Total - Advance deductions (what employee actually receives)
        const netSalary = safeSubtract(totalSalary, advanceDeduction);

        const payrollDocRef = doc(payrollRef);
        batch.set(payrollDocRef, {
          employeeId: employee.id,
          employeeName: employee.name,
          month: selectedMonth,
          baseSalary: baseSalary,
          fullMonthlySalary: employee.currentSalary,
          daysWorked: daysWorked,
          daysInMonth: daysInMonth,
          isProrated: isProrated,
          overtimeHours: overtimeHours,
          overtimePay: overtimePay,
          bonuses: bonusAmount > 0 ? [{ id: "1", type: "other", description: "مكافأة", amount: bonusAmount }] : [],
          deductions: deductionAmount > 0 ? [{ id: "1", type: "other", description: "خصم", amount: deductionAmount }] : [],
          advanceDeduction: advanceDeduction,
          advanceIds: advanceIds,
          netSalary: netSalary,
          totalSalary: totalSalary,
          isPaid: false,
          notes: isProrated ? `راتب جزئي: ${daysWorked} يوم من ${daysInMonth}${empData.notes ? ' - ' + empData.notes : ''}` : empData.notes || "",
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

      // Calculate actual amount to pay (net salary after advance deductions)
      // Use netSalary if available, otherwise fall back to totalSalary for backward compatibility
      const advanceDeduction = payrollEntry.advanceDeduction || 0;
      const amountToPay = payrollEntry.netSalary !== undefined
        ? payrollEntry.netSalary
        : safeSubtract(payrollEntry.totalSalary, advanceDeduction);

      // Update payroll entry
      const payrollRef = doc(firestore, `users/${user.dataOwnerId}/payroll`, payrollEntry.id);
      batch.update(payrollRef, {
        isPaid: true,
        paidDate: new Date(),
        linkedTransactionId: transactionId,
      });

      // Mark all advances as FULLY_DEDUCTED
      if (payrollEntry.advanceIds && payrollEntry.advanceIds.length > 0) {
        for (const advanceId of payrollEntry.advanceIds) {
          const advanceRef = doc(
            firestore,
            `users/${user.dataOwnerId}/advances`,
            advanceId
          );
          batch.update(advanceRef, {
            remainingAmount: 0,
            status: ADVANCE_STATUS.FULLY_DEDUCTED,
          });
        }
      }

      // Create ledger entry for the NET salary (what is actually being paid out now)
      // Note: The full salary was recorded when advances were given out
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
      const ledgerDocRef = doc(ledgerRef);

      // Build notes with advance deduction info
      let notes = `راتب شهر ${payrollEntry.month}`;
      if (payrollEntry.overtimeHours > 0) {
        notes += ` - ساعات إضافية: ${payrollEntry.overtimeHours}`;
      }
      if (advanceDeduction > 0) {
        notes += ` - خصم سلف: ${advanceDeduction}`;
      }

      batch.set(ledgerDocRef, {
        transactionId: transactionId,
        description: `راتب ${payrollEntry.employeeName} - ${payrollEntry.month}${advanceDeduction > 0 ? ' (بعد خصم السلف)' : ''}`,
        type: "مصروف",
        amount: amountToPay,
        category: "مصاريف تشغيلية",
        subCategory: "رواتب وأجور",
        associatedParty: payrollEntry.employeeName,
        date: new Date(),
        reference: `Payroll-${payrollEntry.month}`,
        notes: notes,
        createdAt: new Date(),
      });

      // Create payment entry for the NET amount
      const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
      const paymentDocRef = doc(paymentsRef);
      batch.set(paymentDocRef, {
        clientName: payrollEntry.employeeName,
        amount: amountToPay,
        type: "صرف",
        linkedTransactionId: transactionId,
        date: new Date(),
        notes: `دفع راتب ${payrollEntry.month}${advanceDeduction > 0 ? ` - خصم سلف: ${advanceDeduction}` : ''}`,
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
          totalSalary: payrollEntry.totalSalary,
          advanceDeduction: advanceDeduction,
          netSalary: amountToPay,
          name: payrollEntry.employeeName,
          month: payrollEntry.month,
          advanceIds: payrollEntry.advanceIds,
        },
      });

      const toastDescription = advanceDeduction > 0
        ? `تم دفع ${amountToPay} دينار لـ ${payrollEntry.employeeName} (بعد خصم سلف ${advanceDeduction})`
        : `تم تسجيل دفع راتب ${payrollEntry.employeeName}`;

      toast({
        title: "تم الدفع",
        description: toastDescription,
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

  const undoMonthPayroll = async (
    selectedMonth: string,
    monthPayroll: PayrollEntry[]
  ): Promise<boolean> => {
    if (!user) return false;

    // Check if any entries are paid
    const paidEntries = monthPayroll.filter((e) => e.isPaid);
    if (paidEntries.length > 0) {
      toast({
        title: "لا يمكن التراجع",
        description: `يوجد ${paidEntries.length} سجل مدفوع. يرجى عكس الدفع أولاً.`,
        variant: "destructive",
      });
      return false;
    }

    const unpaidEntries = monthPayroll.filter((e) => !e.isPaid);
    if (unpaidEntries.length === 0) {
      toast({
        title: "لا توجد سجلات",
        description: "لا توجد سجلات رواتب للتراجع عنها",
        variant: "destructive",
      });
      return false;
    }

    try {
      const batch = writeBatch(firestore);

      // Collect all advance IDs to restore
      const advanceIdsToRestore: string[] = [];

      // Delete all unpaid payroll entries for this month
      for (const entry of unpaidEntries) {
        const payrollRef = doc(
          firestore,
          `users/${user.dataOwnerId}/payroll`,
          entry.id
        );
        batch.delete(payrollRef);

        // Collect advance IDs to restore
        if (entry.advanceIds && entry.advanceIds.length > 0) {
          advanceIdsToRestore.push(...entry.advanceIds);
        }
      }

      // Restore advances to ACTIVE status (they weren't deducted yet since entries are unpaid)
      // Note: Advances are only marked as FULLY_DEDUCTED when payment is made
      // For unpaid entries, advances are still ACTIVE, so no restoration needed

      await batch.commit();

      logActivity(user.dataOwnerId, {
        action: "delete",
        module: "employees",
        targetId: selectedMonth,
        userId: user.uid,
        userEmail: user.email || "",
        description: `تراجع عن معالجة رواتب شهر ${selectedMonth}`,
        metadata: {
          month: selectedMonth,
          deletedCount: unpaidEntries.length,
        },
      });

      toast({
        title: "تم التراجع",
        description: `تم حذف ${unpaidEntries.length} سجل راتب لشهر ${selectedMonth}`,
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

  const reversePayment = async (payrollEntry: PayrollEntry): Promise<boolean> => {
    if (!user) return false;

    if (!payrollEntry.isPaid) {
      toast({
        title: "خطأ",
        description: "هذا السجل غير مدفوع",
        variant: "destructive",
      });
      return false;
    }

    try {
      const batch = writeBatch(firestore);

      // Generate reversal transaction ID
      const now = new Date();
      const reversalTransactionId = `REV-${now.getFullYear()}${String(
        now.getMonth() + 1
      ).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(
        Math.floor(Math.random() * 1000)
      ).padStart(3, "0")}`;

      // Calculate the amount that was paid (net salary)
      const advanceDeduction = payrollEntry.advanceDeduction || 0;
      const paidAmount =
        payrollEntry.netSalary !== undefined
          ? payrollEntry.netSalary
          : safeSubtract(payrollEntry.totalSalary, advanceDeduction);

      // Update payroll entry to unpaid
      const payrollRef = doc(
        firestore,
        `users/${user.dataOwnerId}/payroll`,
        payrollEntry.id
      );
      batch.update(payrollRef, {
        isPaid: false,
        paidDate: null,
        linkedTransactionId: null,
      });

      // Restore advances to ACTIVE status
      if (payrollEntry.advanceIds && payrollEntry.advanceIds.length > 0) {
        // We need to fetch the original advance amounts to restore them
        // For simplicity, we'll query and restore each advance
        const advancesRef = collection(
          firestore,
          `users/${user.dataOwnerId}/advances`
        );

        for (const advanceId of payrollEntry.advanceIds) {
          const advanceRef = doc(advancesRef, advanceId);
          // Note: We need to restore the original remaining amount
          // Since we set it to 0 when paid, we need to query the original amount
          // For now, we'll query the advance to get the original amount
        }
      }

      // Create reversing ledger entry (opposite of the original)
      const ledgerRef = collection(
        firestore,
        `users/${user.dataOwnerId}/ledger`
      );
      const ledgerDocRef = doc(ledgerRef);
      batch.set(ledgerDocRef, {
        transactionId: reversalTransactionId,
        description: `عكس راتب ${payrollEntry.employeeName} - ${payrollEntry.month}`,
        type: "إيراد", // Opposite of مصروف
        amount: paidAmount,
        category: "تعديلات",
        subCategory: "عكس رواتب",
        associatedParty: payrollEntry.employeeName,
        date: new Date(),
        reference: `Reversal-${payrollEntry.linkedTransactionId || payrollEntry.id}`,
        notes: `عكس دفع راتب شهر ${payrollEntry.month}`,
        createdAt: new Date(),
      });

      // Create reversing payment entry
      const paymentsRef = collection(
        firestore,
        `users/${user.dataOwnerId}/payments`
      );
      const paymentDocRef = doc(paymentsRef);
      batch.set(paymentDocRef, {
        clientName: payrollEntry.employeeName,
        amount: paidAmount,
        type: "قبض", // Opposite of صرف
        linkedTransactionId: reversalTransactionId,
        date: new Date(),
        notes: `عكس دفع راتب ${payrollEntry.month}`,
        category: "تعديلات",
        subCategory: "عكس رواتب",
        createdAt: new Date(),
      });

      await batch.commit();

      // Now restore advances in a separate operation (need to query first)
      if (payrollEntry.advanceIds && payrollEntry.advanceIds.length > 0) {
        const advancesRef = collection(
          firestore,
          `users/${user.dataOwnerId}/advances`
        );

        for (const advanceId of payrollEntry.advanceIds) {
          const advanceRef = doc(advancesRef, advanceId);
          // Query the advance to get original amount
          const advanceQuery = query(
            advancesRef,
            where("__name__", "==", advanceId),
            limit(1)
          );
          const advanceSnapshot = await getDocs(advanceQuery);

          if (!advanceSnapshot.empty) {
            const advanceData = advanceSnapshot.docs[0].data();
            // Restore to original amount and ACTIVE status
            await updateDoc(advanceRef, {
              remainingAmount: advanceData.amount, // Restore full amount
              status: ADVANCE_STATUS.ACTIVE,
            });
          }
        }
      }

      logActivity(user.dataOwnerId, {
        action: "update",
        module: "employees",
        targetId: payrollEntry.id,
        userId: user.uid,
        userEmail: user.email || "",
        description: `عكس دفع راتب: ${payrollEntry.employeeName} - ${payrollEntry.month}`,
        metadata: {
          reversedAmount: paidAmount,
          originalTransactionId: payrollEntry.linkedTransactionId,
          reversalTransactionId,
          advanceIds: payrollEntry.advanceIds,
        },
      });

      toast({
        title: "تم عكس الدفع",
        description: `تم عكس دفع راتب ${payrollEntry.employeeName} بقيمة ${paidAmount} دينار`,
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

  return { submitEmployee, deleteEmployee, processPayroll, markAsPaid, deletePayrollEntry, undoMonthPayroll, reversePayment };
}
