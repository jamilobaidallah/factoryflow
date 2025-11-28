"use client";

import { useState, useEffect } from "react";
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

interface UseEmployeesDataReturn {
  employees: Employee[];
  salaryHistory: SalaryHistory[];
  payrollEntries: PayrollEntry[];
  loading: boolean;
}

export function useEmployeesData(): UseEmployeesDataReturn {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([]);
  const [payrollEntries, setPayrollEntries] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Load employees
  useEffect(() => {
    if (!user) return;

    const employeesRef = collection(firestore, `users/${user.uid}/employees`);
    const q = query(employeesRef, orderBy("name", "asc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const employeesData: Employee[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        employeesData.push({
          id: doc.id,
          ...data,
          hireDate: data.hireDate?.toDate ? data.hireDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as Employee);
      });
      setEmployees(employeesData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Load salary history
  useEffect(() => {
    if (!user) return;

    const historyRef = collection(firestore, `users/${user.uid}/salary_history`);
    const q = query(historyRef, orderBy("effectiveDate", "desc"), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const historyData: SalaryHistory[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        historyData.push({
          id: doc.id,
          ...data,
          effectiveDate: data.effectiveDate?.toDate ? data.effectiveDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as SalaryHistory);
      });
      setSalaryHistory(historyData);
    });

    return () => unsubscribe();
  }, [user]);

  // Load payroll entries
  useEffect(() => {
    if (!user) return;

    const payrollRef = collection(firestore, `users/${user.uid}/payroll`);
    const q = query(payrollRef, orderBy("month", "desc"), limit(24));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const payrollData: PayrollEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        payrollData.push({
          id: doc.id,
          ...data,
          paidDate: data.paidDate?.toDate ? data.paidDate.toDate() : undefined,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
        } as PayrollEntry);
      });
      setPayrollEntries(payrollData);
    });

    return () => unsubscribe();
  }, [user]);

  return { employees, salaryHistory, payrollEntries, loading };
}
