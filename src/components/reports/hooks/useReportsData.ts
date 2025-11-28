/**
 * useReportsData - Custom hook for fetching all reports data
 * Extracted from reports-page.tsx for better maintainability and reusability
 * Phase 3 of reports-page refactoring
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
}

interface Payment {
  id: string;
  amount: number;
  type: string;
  date: Date;
  linkedTransactionId?: string;
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
  const [loading, setLoading] = useState(false);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);

  const fetchReportData = useCallback(async () => {
    if (!userId) { return; }
    setLoading(true);

    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      // Fetch ledger entries (limit to 1000 to prevent memory issues)
      const ledgerRef = collection(firestore, `users/${userId}/ledger`);
      const ledgerQuery = query(
        ledgerRef,
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "desc"),
        limit(1000)
      );
      const ledgerSnapshot = await getDocs(ledgerQuery);
      const ledgerData: LedgerEntry[] = [];
      ledgerSnapshot.forEach((doc) => {
        const data = doc.data();
        ledgerData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as LedgerEntry);
      });
      setLedgerEntries(ledgerData);

      // Fetch payments (limit to 1000 to prevent memory issues)
      const paymentsRef = collection(firestore, `users/${userId}/payments`);
      const paymentsQuery = query(
        paymentsRef,
        where("date", ">=", start),
        where("date", "<=", end),
        orderBy("date", "desc"),
        limit(1000)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      const paymentsData: Payment[] = [];
      paymentsSnapshot.forEach((doc) => {
        const data = doc.data();
        paymentsData.push({
          id: doc.id,
          ...convertFirestoreDates(data),
        } as Payment);
      });
      setPayments(paymentsData);

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

      toast({
        title: "تم تحميل البيانات",
        description: "تم تحميل بيانات التقارير بنجاح",
      });
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
    fetchReportData();
  }, [fetchReportData]);

  return {
    loading,
    ledgerEntries,
    payments,
    inventory,
    fixedAssets,
    refetch: fetchReportData,
  };
}
