"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/firebase/provider";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
  doc,
} from "firebase/firestore";
import { firestore } from "@/firebase/config";
import { Invoice } from "../types/invoices";

interface UseInvoicesDataReturn {
  invoices: Invoice[];
  loading: boolean;
}

export function useInvoicesData(): UseInvoicesDataReturn {
  const { user } = useUser();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const invoicesRef = collection(firestore, `users/${user.uid}/invoices`);
    // Limit to 1000 most recent invoices
    const q = query(invoicesRef, orderBy("invoiceDate", "desc"), limit(1000));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData: Invoice[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        invoicesData.push({
          id: doc.id,
          ...data,
          invoiceDate: data.invoiceDate?.toDate ? data.invoiceDate.toDate() : new Date(),
          dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(),
        } as Invoice);
      });
      setInvoices(invoicesData);
      setLoading(false);

      // Auto-update overdue status
      invoicesData.forEach(async (invoice) => {
        if (invoice.status === "sent" && new Date() > invoice.dueDate) {
          const invoiceRef = doc(firestore, `users/${user.uid}/invoices`, invoice.id);
          await updateDoc(invoiceRef, { status: "overdue" });
        }
      });
    });

    return () => unsubscribe();
  }, [user]);

  return { invoices, loading };
}
