/**
 * useReportsData - Custom hook for fetching all reports data
 * Uses onSnapshot for real-time updates on ledger entries
 * Extracted from reports-page.tsx for better maintainability and reusability
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { useToast } from "@/hooks/use-toast";
import { convertFirestoreDates } from "@/lib/firestore-utils";

interface LedgerEntry {
  id: string;
  transactionId: string;
  description: string;
  type: string;
  amount: number;
  category: string;
  subCategory: string;
  associatedParty: string;
  date: Date;
  totalPaid?: number;
  remainingBalance?: number;
  paymentStatus?: "paid" | "unpaid" | "partial";
  isARAPEntry?: boolean;
  totalDiscount?: number;
  writeoffAmount?: number;
}

interface Payment {
  id: string;
  amount: number;
  type: string;
  date: Date;
  linkedTransactionId?: string;
  isEndorsement?: boolean;
  noCashMovement?: boolean;
}

interface InventoryItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  category: string;
}

interface FixedAsset {
  id: string;
  assetName: string;
  category: string;
  purchaseCost: number;
  accumulatedDepreciation: number;
  bookValue: number;
  monthlyDepreciation: number;
  status: string;
}

interface UseReportsDataProps {
  userId: string | null;
  startDate: string;
  endDate: string;
}

export function useReportsData({ userId, startDate, endDate }: UseReportsDataProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  // Real-time listener for ledger entries
  // This ensures updates from payment deletions are reflected immediately
  useEffect(() => {
    if (!userId) { return; }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const ledgerRef = collection(firestore, `users/${userId}/ledger`);
    const ledgerQuery = query(
      ledgerRef,
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "desc"),
      limit(1000)
    );

    const unsubscribe = onSnapshot(ledgerQuery, (snapshot) => {
      const ledgerData: LedgerEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        ledgerData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as LedgerEntry);
      });
      setLedgerEntries(ledgerData);
    }, (error) => {
      console.error("Error in ledger snapshot:", error);
    });

    return () => unsubscribe();
  }, [userId, startDate, endDate]);

  // Real-time listener for payments
  useEffect(() => {
    if (!userId) { return; }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const paymentsRef = collection(firestore, `users/${userId}/payments`);
    const paymentsQuery = query(
      paymentsRef,
      where("date", ">=", start),
      where("date", "<=", end),
      orderBy("date", "desc"),
      limit(1000)
    );

    const unsubscribe = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData: Payment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        paymentsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as Payment);
      });
      setPayments(paymentsData);
    }, (error) => {
      console.error("Error in payments snapshot:", error);
    });

    return () => unsubscribe();
  }, [userId, startDate, endDate]);

  // Fetch static data (inventory and fixed assets) - one-time fetch is fine for these
  const fetchStaticData = useCallback(async () => {
    if (!userId) { return; }
    setLoading(true);

    try {
      // Fetch inventory (limit to 500 items)
      const inventoryRef = collection(firestore, `users/${userId}/inventory`);
      const inventoryQuery = query(inventoryRef, limit(500));
      const inventorySnapshot = await getDocs(inventoryQuery);
      const inventoryData: InventoryItem[] = [];
      inventorySnapshot.forEach((doc) => {
        inventoryData.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(inventoryData);

      // Fetch fixed assets (limit to 500 items)
      const assetsRef = collection(firestore, `users/${userId}/fixed_assets`);
      const assetsQuery = query(assetsRef, limit(500));
      const assetsSnapshot = await getDocs(assetsQuery);
      const assetsData: FixedAsset[] = [];
      assetsSnapshot.forEach((doc) => {
        assetsData.push({ id: doc.id, ...doc.data() } as FixedAsset);
      });
      setFixedAssets(assetsData);
    } catch (error) {
      console.error("Error fetching static data:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, toast]);

  useEffect(() => {
    fetchStaticData();
  }, [fetchStaticData]);

  return {
    loading,
    ledgerEntries,
    payments,
    inventory,
    fixedAssets,
    refetch: fetchStaticData,
  };
}
