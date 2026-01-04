/**
 * useAvailableAdvances - Hook to query available customer/supplier advances
 * Used to check if a party has advances that can be applied to new invoices
 */

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { useUser } from "@/firebase/provider";
import type { LedgerEntry } from "../utils/ledger-constants";

// Advance categories
const CUSTOMER_ADVANCE_CATEGORY = "سلفة عميل";
const SUPPLIER_ADVANCE_CATEGORY = "سلفة مورد";

export interface AvailableAdvance {
  id: string;
  transactionId: string;
  amount: number;              // Original advance amount
  remainingBalance: number;    // Available to allocate
  date: Date;
  description: string;
  category: string;
}

interface UseAvailableAdvancesReturn {
  advances: AvailableAdvance[];
  totalAvailable: number;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch available advances for a specific party
 * @param partyName - Name of the customer/supplier
 * @param advanceType - "customer" for سلفة عميل, "supplier" for سلفة مورد
 */
export function useAvailableAdvances(
  partyName: string | null,
  advanceType: "customer" | "supplier"
): UseAvailableAdvancesReturn {
  const { user } = useUser();
  const [advances, setAdvances] = useState<AvailableAdvance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = advanceType === "customer"
    ? CUSTOMER_ADVANCE_CATEGORY
    : SUPPLIER_ADVANCE_CATEGORY;

  const fetchAdvances = useCallback(async () => {
    console.log(`[useAvailableAdvances] fetchAdvances called: partyName="${partyName}", advanceType="${advanceType}"`);

    if (!user?.dataOwnerId || !partyName) {
      console.log(`[useAvailableAdvances] Skipping: no user (${!!user?.dataOwnerId}) or no partyName (${!!partyName})`);
      setAdvances([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);

      // Query for advances of this party with remaining balance
      // Note: This query requires a composite index on (category, associatedParty, date)
      const advancesQuery = query(
        ledgerRef,
        where("category", "==", category),
        where("associatedParty", "==", partyName),
        orderBy("date", "asc") // FIFO - oldest advances first
      );

      console.log(`[useAvailableAdvances] Querying for category="${category}", party="${partyName}"`);
      const snapshot = await getDocs(advancesQuery);
      console.log(`[useAvailableAdvances] Found ${snapshot.docs.length} advance entries`);

      const availableAdvances: AvailableAdvance[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as LedgerEntry;

        // Calculate remaining balance for advances
        // SEMANTIC CHANGE: Advances now use standard AR/AP tracking (totalPaid)
        // For backwards compatibility, we also check totalUsedFromAdvance (old field)
        //
        // Priority: remainingBalance (if maintained) > calculated from totalPaid > calculated from totalUsedFromAdvance
        // This ensures we work with both old and new advance entries
        const totalUsed = data.totalPaid ?? data.totalUsedFromAdvance ?? 0;
        const remaining = data.remainingBalance ?? (data.amount - totalUsed);

        console.log(`[useAvailableAdvances] Entry ${doc.id}: amount=${data.amount}, totalPaid=${data.totalPaid ?? 'N/A'}, totalUsedFromAdvance=${data.totalUsedFromAdvance ?? 'N/A'}, remaining=${remaining}`);

        // Only include advances with remaining balance > 0
        if (remaining > 0) {
          availableAdvances.push({
            id: doc.id,
            transactionId: data.transactionId,
            amount: data.amount,
            remainingBalance: remaining,
            date: data.date instanceof Date ? data.date : new Date(data.date),
            description: data.description,
            category: data.category,
          });
        }
      });

      console.log(`[useAvailableAdvances] ${availableAdvances.length} advances with remaining balance > 0`);
      setAdvances(availableAdvances);
    } catch (err) {
      console.error("[useAvailableAdvances] Error fetching advances:", err);
      // Check if it's an index error
      if (err instanceof Error && err.message.includes("index")) {
        console.error("[useAvailableAdvances] Missing Firestore composite index! Create index on: category, associatedParty, date");
      }
      setError("حدث خطأ أثناء جلب السلف المتاحة");
      setAdvances([]);
    } finally {
      setLoading(false);
    }
  }, [user?.dataOwnerId, partyName, category]);

  // Fetch when party name or category changes
  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  // Calculate total available
  const totalAvailable = advances.reduce((sum, adv) => sum + adv.remainingBalance, 0);

  return {
    advances,
    totalAvailable,
    loading,
    error,
    refetch: fetchAdvances,
  };
}

/**
 * Helper function to check if a category is an advance category
 */
export function isAdvanceCategory(category: string): boolean {
  return category === CUSTOMER_ADVANCE_CATEGORY || category === SUPPLIER_ADVANCE_CATEGORY;
}

/**
 * Helper function to get the opposite advance type for a transaction
 * - When creating income (دخل) for a customer → check for سلفة عميل
 * - When creating expense (مصروف) for a supplier → check for سلفة مورد
 */
export function getAdvanceTypeForEntry(entryType: string): "customer" | "supplier" | null {
  if (entryType === "دخل") {
    return "customer"; // Customer advance can pay customer invoices
  }
  if (entryType === "مصروف") {
    return "supplier"; // Supplier advance can offset supplier purchases
  }
  return null;
}
