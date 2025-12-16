import { useState, useEffect, useMemo, useCallback } from "react";
import { useUser } from "@/firebase/provider";
import { collection, orderBy, limit, getDocs, query as firestoreQuery } from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { formatNumber } from "@/lib/date-utils";

/** Represents a single search result item */
export interface SearchResult {
  id: string;
  type: "ledger" | "client" | "cheque" | "payment" | "partner";
  title: string;
  subtitle: string;
  href: string;
  icon: string;
}

/** Return type for the useGlobalSearch hook */
export interface UseGlobalSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  isLoading: boolean;
  groupedResults: Record<string, SearchResult[]>;
  clearResults: () => void;
}

export const typeLabels: Record<string, string> = {
  ledger: "الحركات المالية",
  client: "العملاء",
  cheque: "الشيكات",
  payment: "المدفوعات",
  partner: "الشركاء",
};

export const typeIcons: Record<string, string> = {
  ledger: "📄",
  client: "👤",
  cheque: "📝",
  payment: "💰",
  partner: "🤝",
};

/**
 * Hook for global search across ledger, clients, partners, cheques, and payments.
 * Implements debounced search (400ms) with grouped results.
 *
 * @returns Search state and controls including query, results, loading state, and grouped results
 */
export function useGlobalSearch(): UseGlobalSearchReturn {
  const { user } = useUser();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const clearResults = useCallback(() => {
    setResults([]);
    setQuery("");
  }, []);

  useEffect(() => {
    if (!query.trim() || query.length < 2 || !user) {
      setResults([]);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const searchResults: SearchResult[] = [];
        const searchTerm = query.trim().toLowerCase();

        // Search Ledger entries (by description and associatedParty)
        const ledgerRef = collection(firestore, `users/${user.dataOwnerId}/ledger`);
        const ledgerSnapshot = await getDocs(
          firestoreQuery(ledgerRef, orderBy("date", "desc"), limit(50))
        );
        ledgerSnapshot.forEach((doc) => {
          const data = doc.data();
          if (
            data.description?.toLowerCase().includes(searchTerm) ||
            data.associatedParty?.toLowerCase().includes(searchTerm)
          ) {
            searchResults.push({
              id: doc.id,
              type: "ledger",
              title: data.description || "بدون وصف",
              subtitle: `${formatNumber(data.amount ?? 0)} د.أ - ${data.category || "غير مصنف"}`,
              href: `/ledger?highlight=${doc.id}`,
              icon: typeIcons.ledger,
            });
          }
        });

        // Search Clients (by name)
        const clientsRef = collection(firestore, `users/${user.dataOwnerId}/clients`);
        const clientsSnapshot = await getDocs(
          firestoreQuery(clientsRef, limit(50))
        );
        clientsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.name?.toLowerCase().includes(searchTerm)) {
            searchResults.push({
              id: doc.id,
              type: "client",
              title: data.name,
              subtitle: data.phone || "لا يوجد رقم هاتف",
              href: `/clients?highlight=${doc.id}`,
              icon: typeIcons.client,
            });
          }
        });

        // Search Partners (by name)
        const partnersRef = collection(firestore, `users/${user.dataOwnerId}/partners`);
        const partnersSnapshot = await getDocs(
          firestoreQuery(partnersRef, limit(50))
        );
        partnersSnapshot.forEach((doc) => {
          const data = doc.data();
          // Normalize Arabic text for comparison (handle diacritics and case)
          const partnerName = (data.name || "").normalize("NFKC").trim();
          const normalizedSearch = searchTerm.normalize("NFKC").trim();
          if (partnerName.includes(normalizedSearch) || partnerName.toLowerCase().includes(normalizedSearch)) {
            searchResults.push({
              id: doc.id,
              type: "partner",
              title: data.name,
              subtitle: `${data.ownershipPercentage || 0}% - ${data.phone || "لا يوجد رقم هاتف"}`,
              href: `/partners?highlight=${doc.id}`,
              icon: typeIcons.partner,
            });
          }
        });

        // Search Cheques (by chequeNumber or partyName/clientName)
        const chequesRef = collection(firestore, `users/${user.dataOwnerId}/cheques`);
        const chequesSnapshot = await getDocs(
          firestoreQuery(chequesRef, limit(50))
        );
        chequesSnapshot.forEach((doc) => {
          const data = doc.data();
          const partyName = data.partyName || data.clientName || "";
          if (
            data.chequeNumber?.toLowerCase().includes(searchTerm) ||
            partyName.toLowerCase().includes(searchTerm)
          ) {
            const chequeType = data.type === "وارد" ? "incoming-cheques" : "outgoing-cheques";
            searchResults.push({
              id: doc.id,
              type: "cheque",
              title: `شيك #${data.chequeNumber || "---"}`,
              subtitle: `${formatNumber(data.amount ?? 0)} د.أ - ${partyName || "غير معروف"}`,
              href: `/${chequeType}?highlight=${doc.id}`,
              icon: typeIcons.cheque,
            });
          }
        });

        // Search Payments (by clientName or notes)
        const paymentsRef = collection(firestore, `users/${user.dataOwnerId}/payments`);
        const paymentsSnapshot = await getDocs(
          firestoreQuery(paymentsRef, orderBy("date", "desc"), limit(50))
        );
        paymentsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (
            data.clientName?.toLowerCase().includes(searchTerm) ||
            data.notes?.toLowerCase().includes(searchTerm)
          ) {
            searchResults.push({
              id: doc.id,
              type: "payment",
              title: data.clientName || "مدفوعات",
              subtitle: `${formatNumber(data.amount ?? 0)} د.أ - ${data.type || ""}`,
              href: `/payments?highlight=${doc.id}`,
              icon: typeIcons.payment,
            });
          }
        });

        // Limit total results to 20
        setResults(searchResults.slice(0, 20));
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 400); // Debounce 400ms - balances responsiveness with query reduction
    // NOTE: For production scale, consider Algolia or ElasticSearch for server-side search

    return () => clearTimeout(searchTimeout);
  }, [query, user]);

  const groupedResults = useMemo(() => {
    return results.reduce((acc, result) => {
      const group = result.type;
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(result);
      return acc;
    }, {} as Record<string, SearchResult[]>);
  }, [results]);

  return { query, setQuery, results, isLoading, groupedResults, clearResults };
}
