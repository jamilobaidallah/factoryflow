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

  // Fetch all report data - using getDocs for efficiency (reports are point-in-time snapshots)
  const fetchAllData = useCallback(async () => {
    if (!userId) { return; }
    setLoading(true);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Fetch all data in parallel for better performance
      const [ledgerSnapshot, paymentsSnapshot, inventorySnapshot, assetsSnapshot] = await Promise.all([
        // Fetch ledger entries for date range
        getDocs(query(
          collection(firestore, `users/${userId}/ledger`),
          where("date", ">=", start),
          where("date", "<=", end),
          orderBy("date", "desc"),
          limit(1000)
        )),
        // Fetch payments for date range
        getDocs(query(
          collection(firestore, `users/${userId}/payments`),
          where("date", ">=", start),
          where("date", "<=", end),
          orderBy("date", "desc"),
          limit(1000)
        )),
        // Fetch inventory (limit to 500 items)
        getDocs(query(
          collection(firestore, `users/${userId}/inventory`),
          limit(500)
        )),
        // Fetch fixed assets (limit to 500 items)
        getDocs(query(
          collection(firestore, `users/${userId}/fixed_assets`),
          limit(500)
        )),
      ]);

      // Process ledger entries
      const ledgerData: LedgerEntry[] = [];
      ledgerSnapshot.forEach((doc) => {
        const data = doc.data();
        ledgerData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as LedgerEntry);
      });
      setLedgerEntries(ledgerData);

      // Process payments
      const paymentsData: Payment[] = [];
      paymentsSnapshot.forEach((doc) => {
        const data = doc.data();
        paymentsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as Payment);
      });
      setPayments(paymentsData);

      // Process inventory
      const inventoryData: InventoryItem[] = [];
      inventorySnapshot.forEach((doc) => {
        inventoryData.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(inventoryData);

      // Process fixed assets
      const assetsData: FixedAsset[] = [];
      assetsSnapshot.forEach((doc) => {
        assetsData.push({ id: doc.id, ...doc.data() } as FixedAsset);
      });
      setFixedAssets(assetsData);
    } catch (error) {
      console.error("Error fetching report data:", error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تحميل البيانات",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  return {
    loading,
    ledgerEntries,
    payments,
    inventory,
    fixedAssets,
    refetch: fetchAllData,
  };
}
