"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch,
  doc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Invoice } from "../types/invoices";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { useToast } from "@/hooks/use-toast";

interface UseInvoicesDataReturn {
  invoices: Invoice[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useInvoicesData(): UseInvoicesDataReturn {
  const { user } = useUser();
  const { toast } = useToast();
  const dataOwnerId = user?.dataOwnerId;
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async (showLoader = true) => {
    if (!dataOwnerId) {
      setLoading(false);
      return;
    }

    if (showLoader) { setLoading(true); }
    try {
      const invoicesRef = collection(firestore, `users/${dataOwnerId}/invoices`);
      const q = query(invoicesRef, orderBy("invoiceDate", "desc"), limit(500));
      const snapshot = await getDocs(q);

      const data: Invoice[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...convertFirestoreDates(d.data()),
      } as Invoice));

      // Fix overdue in a single batch — no loop, no re-trigger
      const overdue = data.filter(
        (inv) => inv.status === "sent" && new Date() > inv.dueDate
      );
      if (overdue.length > 0) {
        const batch = writeBatch(firestore);
        overdue.forEach((inv) => {
          batch.update(doc(invoicesRef, inv.id), { status: "overdue" });
          inv.status = "overdue"; // update local copy immediately
        });
        await batch.commit();
      }

      setInvoices(data);
    } catch {
      toast({ title: "فشل تحميل الفواتير. يرجى المحاولة مرة أخرى", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [dataOwnerId, toast]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  // Refresh without showing the full skeleton (no flash)
  const refresh = useCallback(() => fetchInvoices(false), [fetchInvoices]);

  return { invoices, loading, refresh };
}
