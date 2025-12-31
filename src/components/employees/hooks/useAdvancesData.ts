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
import { Advance } from "../types/advances";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { sumAmounts } from "@/lib/currency";
import { QUERY_LIMITS, ADVANCE_STATUS } from "@/lib/constants";

interface UseAdvancesDataReturn {
  advances: Advance[];
  loading: boolean;
  getEmployeeAdvances: (employeeId: string) => Advance[];
  getEmployeeActiveAdvances: (employeeId: string) => Advance[];
  getEmployeeOutstandingBalance: (employeeId: string) => number;
  getTotalOutstandingAdvances: () => number;
}

export function useAdvancesData(): UseAdvancesDataReturn {
  const { user } = useUser();
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const advancesRef = collection(
      firestore,
      `users/${user.dataOwnerId}/advances`
    );
    const q = query(
      advancesRef,
      orderBy("date", "desc"),
      limit(QUERY_LIMITS.ADVANCES)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const advancesData: Advance[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          advancesData.push({
            id: doc.id,
            ...convertFirestoreDates(data),
          } as Advance);
        });
        setAdvances(advancesData);
        setLoading(false);
      },
      (error) => {
        console.error("Error loading advances:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const getEmployeeAdvances = useCallback(
    (employeeId: string) => {
      return advances.filter((a) => a.employeeId === employeeId);
    },
    [advances]
  );

  const getEmployeeActiveAdvances = useCallback(
    (employeeId: string) => {
      return advances.filter(
        (a) => a.employeeId === employeeId && a.status === ADVANCE_STATUS.ACTIVE
      );
    },
    [advances]
  );

  const getEmployeeOutstandingBalance = useCallback(
    (employeeId: string) => {
      const activeAdvances = getEmployeeActiveAdvances(employeeId);
      return sumAmounts(activeAdvances.map((a) => a.remainingAmount));
    },
    [getEmployeeActiveAdvances]
  );

  const getTotalOutstandingAdvances = useCallback(() => {
    const activeAdvances = advances.filter(
      (a) => a.status === ADVANCE_STATUS.ACTIVE
    );
    return sumAmounts(activeAdvances.map((a) => a.remainingAmount));
  }, [advances]);

  return useMemo(
    () => ({
      advances,
      loading,
      getEmployeeAdvances,
      getEmployeeActiveAdvances,
      getEmployeeOutstandingBalance,
      getTotalOutstandingAdvances,
    }),
    [
      advances,
      loading,
      getEmployeeAdvances,
      getEmployeeActiveAdvances,
      getEmployeeOutstandingBalance,
      getTotalOutstandingAdvances,
    ]
  );
}
