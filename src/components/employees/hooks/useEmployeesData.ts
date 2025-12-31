"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Employee, SalaryHistory, PayrollEntry } from "../types/employees";
import { convertFirestoreDates, toDateOptional } from "@/lib/firestore-utils";
import { sumAmounts } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";

interface UseEmployeesDataReturn {
  employees: Employee[];
  salaryHistory: SalaryHistory[];
  payrollEntries: PayrollEntry[];
  loading: boolean;
  getEmployeeUnpaidSalaries: (employeeId: string) => number;
  getTotalUnpaidSalaries: () => number;
}

export function useEmployeesData(): UseEmployeesDataReturn {
  const { user } = useUser();
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load employees
  useEffect(() => {
    if (!user) return;

    const employeesRef = collection(firestore, `users/${user.dataOwnerId}/employees`);
    const q = query(employeesRef, orderBy("name", "asc"), limit(500));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const employeesData: Employee[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          employeesData.push({
            id: doc.id,
            ...convertFirestoreDates(data),
          } as Employee);
        });
        setEmployees(employeesData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading employees:", error);
        toast({
          title: "خطأ في تحميل البيانات",
          description: "فشل تحميل قائمة الموظفين",
          variant: "destructive",
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, toast]);

  // Load salary history
  useEffect(() => {
    if (!user) return;

    const historyRef = collection(firestore, `users/${user.dataOwnerId}/salary_history`);
    const q = query(historyRef, orderBy("effectiveDate", "desc"), limit(1000));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const historyData: SalaryHistory[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          historyData.push({
            id: doc.id,
            ...convertFirestoreDates(data),
          } as SalaryHistory);
        });
        setSalaryHistory(historyData);
      },
      (error) => {
        console.error("Error loading salary history:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Load payroll entries
  useEffect(() => {
    if (!user) return;

    const payrollRef = collection(firestore, `users/${user.dataOwnerId}/payroll`);
    // Increased limit to support ~50 employees × 12 months of history
    const q = query(payrollRef, orderBy("month", "desc"), limit(600));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const payrollData: PayrollEntry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          payrollData.push({
            id: doc.id,
            ...convertFirestoreDates(data),
            paidDate: toDateOptional(data.paidDate),
          } as PayrollEntry);
        });
        setPayrollEntries(payrollData);
      },
      (error) => {
        console.error("Error loading payroll entries:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Calculate unpaid salaries for a specific employee
  const getEmployeeUnpaidSalaries = useCallback(
    (employeeId: string): number => {
      const unpaidEntries = payrollEntries.filter(
        (p) => p.employeeId === employeeId && !p.isPaid
      );
      return sumAmounts(unpaidEntries.map((p) => p.totalSalary));
    },
    [payrollEntries]
  );

  // Calculate total unpaid salaries across all employees
  const getTotalUnpaidSalaries = useCallback((): number => {
    const unpaidEntries = payrollEntries.filter((p) => !p.isPaid);
    return sumAmounts(unpaidEntries.map((p) => p.totalSalary));
  }, [payrollEntries]);

  return useMemo(
    () => ({
      employees,
      salaryHistory,
      payrollEntries,
      loading,
      getEmployeeUnpaidSalaries,
      getTotalUnpaidSalaries,
    }),
    [
      employees,
      salaryHistory,
      payrollEntries,
      loading,
      getEmployeeUnpaidSalaries,
      getTotalUnpaidSalaries,
    ]
  );
}
