"use client";

import { useState, useEffect, useMemo } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import {
  DepreciationRecord,
  DepreciationRun,
  DEPRECIATION_RECORDS_LIMIT,
  DEPRECIATION_RUNS_LIMIT,
} from "../types/fixed-assets";
import { convertFirestoreDates } from "@/lib/firestore-utils";

interface UseDepreciationHistoryReturn {
  records: DepreciationRecord[];
  runs: DepreciationRun[];
  loading: boolean;
  getRecordsForAsset: (assetId: string) => DepreciationRecord[];
  getProcessedPeriods: () => Set<string>;
}

export function useDepreciationHistory(): UseDepreciationHistoryReturn {
  const { user } = useUser();
  const [records, setRecords] = useState<DepreciationRecord[]>([]);
  const [runs, setRuns] = useState<DepreciationRun[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [loadingRuns, setLoadingRuns] = useState(true);

  // Subscribe to depreciation_records
  useEffect(() => {
    if (!user) {
      setLoadingRecords(false);
      return;
    }

    const recordsRef = collection(
      firestore,
      `users/${user.dataOwnerId}/depreciation_records`
    );
    const q = query(recordsRef, orderBy("createdAt", "desc"), limit(DEPRECIATION_RECORDS_LIMIT));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const recordsData: DepreciationRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        recordsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as DepreciationRecord);
      });
      setRecords(recordsData);
      setLoadingRecords(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Subscribe to depreciation_runs
  useEffect(() => {
    if (!user) {
      setLoadingRuns(false);
      return;
    }

    const runsRef = collection(
      firestore,
      `users/${user.dataOwnerId}/depreciation_runs`
    );
    const q = query(runsRef, orderBy("createdAt", "desc"), limit(DEPRECIATION_RUNS_LIMIT));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const runsData: DepreciationRun[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        runsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as DepreciationRun);
      });
      setRuns(runsData);
      setLoadingRuns(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Build index for O(1) asset lookup
  const recordsByAsset = useMemo(() => {
    const map = new Map<string, DepreciationRecord[]>();
    for (const record of records) {
      const existing = map.get(record.assetId) || [];
      existing.push(record);
      map.set(record.assetId, existing);
    }
    // Sort each asset's records by date (oldest first)
    Array.from(map.entries()).forEach(([assetId, assetRecords]) => {
      assetRecords.sort((a, b) => {
        if (a.year !== b.year) {return a.year - b.year;}
        return a.month - b.month;
      });
      map.set(assetId, assetRecords);
    });
    return map;
  }, [records]);

  // Build set of processed periods for calendar view
  const processedPeriods = useMemo(() => {
    const set = new Set<string>();
    for (const run of runs) {
      set.add(run.period);
    }
    return set;
  }, [runs]);

  const getRecordsForAsset = (assetId: string): DepreciationRecord[] => {
    return recordsByAsset.get(assetId) || [];
  };

  const getProcessedPeriods = (): Set<string> => {
    return processedPeriods;
  };

  return {
    records,
    runs,
    loading: loadingRecords || loadingRuns,
    getRecordsForAsset,
    getProcessedPeriods,
  };
}
