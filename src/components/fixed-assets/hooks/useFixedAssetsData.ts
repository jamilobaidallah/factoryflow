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
import { FixedAsset } from "../types/fixed-assets";
import { convertFirestoreDates, toDateOptional } from "@/lib/firestore-utils";

interface UseFixedAssetsDataReturn {
  assets: FixedAsset[];
  loading: boolean;
}

export function useFixedAssetsData(): UseFixedAssetsDataReturn {
  const { user } = useUser();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const assetsRef = collection(firestore, `users/${user.uid}/fixed_assets`);
    const q = query(assetsRef, orderBy("createdAt", "desc"), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetsData: FixedAsset[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        assetsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
          lastDepreciationDate: toDateOptional(data.lastDepreciationDate),
        } as FixedAsset);
      });
      setAssets(assetsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  return { assets, loading };
}
