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
import { OvertimeEntry } from "../types/overtime";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { sumAmounts } from "@/lib/currency";
import { QUERY_LIMITS } from "@/lib/constants";

interface EmployeeOvertimeSummary {
  employeeId: string;
  employeeName: string;
  totalHours: number;
  entries: OvertimeEntry[];
}

interface UseOvertimeDataReturn {
  overtimeEntries: OvertimeEntry[];
  loading: boolean;
  getEntriesForMonth: (month: string) => OvertimeEntry[];
  getEmployeeOvertimeHours: (employeeId: string, month: string) => number;
  getEmployeeOvertimeEntries: (employeeId: string, month: string) => OvertimeEntry[];
  getMonthSummaryByEmployee: (month: string) => EmployeeOvertimeSummary[];
  isMonthProcessed: (month: string) => boolean;
}

export function useOvertimeData(): UseOvertimeDataReturn {
  const { user } = useUser();
  const [overtimeEntries, setOvertimeEntries] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const overtimeRef = collection(
      firestore,
      `users/${user.dataOwnerId}/overtime_entries`
    );
    const q = query(
      overtimeRef,
      orderBy("date", "desc"),
      limit(QUERY_LIMITS.OVERTIME_ENTRIES)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const entriesData: OvertimeEntry[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          entriesData.push({
            id: doc.id,
            ...convertFirestoreDates(data),
          } as OvertimeEntry);
        });
        setOvertimeEntries(entriesData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading overtime entries:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Get all entries for a specific month
  const getEntriesForMonth = useCallback(
    (month: string): OvertimeEntry[] => {
      return overtimeEntries.filter((entry) => entry.month === month);
    },
    [overtimeEntries]
  );

  // Get total overtime hours for an employee in a specific month
  const getEmployeeOvertimeHours = useCallback(
    (employeeId: string, month: string): number => {
      const employeeEntries = overtimeEntries.filter(
        (entry) => entry.employeeId === employeeId && entry.month === month
      );
      return sumAmounts(employeeEntries.map((e) => e.hours));
    },
    [overtimeEntries]
  );

  // Get all overtime entries for an employee in a specific month
  const getEmployeeOvertimeEntries = useCallback(
    (employeeId: string, month: string): OvertimeEntry[] => {
      return overtimeEntries.filter(
        (entry) => entry.employeeId === employeeId && entry.month === month
      );
    },
    [overtimeEntries]
  );

  // Get summary grouped by employee for a month
  const getMonthSummaryByEmployee = useCallback(
    (month: string): EmployeeOvertimeSummary[] => {
      const monthEntries = getEntriesForMonth(month);

      // Group by employee
      const byEmployee = new Map<string, OvertimeEntry[]>();
      monthEntries.forEach((entry) => {
        const existing = byEmployee.get(entry.employeeId) || [];
        byEmployee.set(entry.employeeId, [...existing, entry]);
      });

      // Convert to summary array
      return Array.from(byEmployee.entries()).map(([employeeId, entries]) => ({
        employeeId,
        employeeName: entries[0]?.employeeName || "",
        totalHours: sumAmounts(entries.map((e) => e.hours)),
        entries: entries.sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
      }));
    },
    [getEntriesForMonth]
  );

  // Check if any entry in a month is linked to processed payroll
  const isMonthProcessed = useCallback(
    (month: string): boolean => {
      const monthEntries = getEntriesForMonth(month);
      return monthEntries.some((entry) => entry.linkedPayrollId);
    },
    [getEntriesForMonth]
  );

  return useMemo(
    () => ({
      overtimeEntries,
      loading,
      getEntriesForMonth,
      getEmployeeOvertimeHours,
      getEmployeeOvertimeEntries,
      getMonthSummaryByEmployee,
      isMonthProcessed,
    }),
    [
      overtimeEntries,
      loading,
      getEntriesForMonth,
      getEmployeeOvertimeHours,
      getEmployeeOvertimeEntries,
      getMonthSummaryByEmployee,
      isMonthProcessed,
    ]
  );
}
