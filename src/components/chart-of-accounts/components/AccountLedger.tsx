"use client";

import { useState, useEffect, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/date-utils";
import { safeAdd, safeSubtract } from "@/lib/currency";
import type { Account, JournalEntry, JournalLine } from "@/types/accounting";
import { firestore } from "@/firebase/config";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { convertFirestoreDates } from "@/lib/firestore-utils";
import { QUERY_LIMITS } from "@/lib/constants";
import { useUser } from "@/firebase/provider";

interface AccountLedgerProps {
  account: Account | null;
}

interface LedgerRow {
  id: string;
  date: Date;
  description: string;
  entryNumber: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export function AccountLedger({ account }: AccountLedgerProps) {
  const { user } = useUser();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!account || !user?.dataOwnerId) {
      setEntries([]);
      return;
    }

    setLoading(true);
    setError(null);
    setWarning(null);

    const journalRef = collection(firestore, `users/${user.dataOwnerId}/journal_entries`);
    const q = query(
      journalRef,
      where("accountCodes", "array-contains", account.code),
      orderBy("date", "asc"),
      limit(QUERY_LIMITS.JOURNAL_ENTRIES)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs
          .map((d) => ({ id: d.id, ...convertFirestoreDates(d.data()) }) as JournalEntry)
          .filter((e) => {
            const status = (e as JournalEntry & { status?: string }).status;
            return !status || status === "posted";
          });
        if (snapshot.size >= QUERY_LIMITS.JOURNAL_ENTRIES) {
          setWarning(`يتم عرض أحدث ${QUERY_LIMITS.JOURNAL_ENTRIES} قيد فقط`);
        }
        setEntries(fetched);
        setLoading(false);
      },
      (err) => {
        console.error("AccountLedger snapshot error:", err);
        setError("فشل تحميل القيود");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [account, user?.dataOwnerId]);

  // Build ledger rows with running balance using per-account LINES only
  const rows = useMemo<LedgerRow[]>(() => {
    if (!account) return [];

    let balance = 0;
    return entries.map((entry) => {
      // Find the lines for this specific account
      const accountLines = entry.lines.filter(
        (line: JournalLine) => line.accountCode === account.code
      );
      const lineDebit = accountLines.reduce((s, l) => safeAdd(s, l.debit), 0);
      const lineCredit = accountLines.reduce((s, l) => safeAdd(s, l.credit), 0);

      // Update running balance respecting normal balance direction
      if (account.normalBalance === 'debit') {
        balance = safeAdd(balance, safeSubtract(lineDebit, lineCredit));
      } else {
        balance = safeAdd(balance, safeSubtract(lineCredit, lineDebit));
      }

      return {
        id: entry.id,
        date: entry.date,
        description: entry.description,
        entryNumber: entry.entryNumber,
        debit: lineDebit,
        credit: lineCredit,
        runningBalance: balance,
      };
    });
  }, [entries, account]);

  if (!account) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <p className="text-sm">اختر حساباً لعرض قيوده</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Account header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-slate-500">{account.code}</span>
          <h3 className="font-semibold text-slate-800">{account.nameAr}</h3>
          {account.isContraAccount && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
              مقابل
            </span>
          )}
        </div>
        {rows.length > 0 && (
          <p className="text-xs text-slate-400 mt-0.5">
            {rows.length} قيد
            {warning && (
              <span className="text-amber-600 mr-2">{warning}</span>
            )}
          </p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin ml-2" />
          <span>جارٍ التحميل…</span>
        </div>
      )}

      {!loading && error && (
        <div className="px-4 py-4 text-sm text-danger-600">{error}</div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <p className="text-sm">لا توجد قيود لهذا الحساب</p>
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm text-right">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2 font-medium text-slate-500 text-xs">التاريخ</th>
                <th className="px-3 py-2 font-medium text-slate-500 text-xs">البيان</th>
                <th className="px-3 py-2 font-medium text-slate-500 text-xs text-left">مدين</th>
                <th className="px-3 py-2 font-medium text-slate-500 text-xs text-left">دائن</th>
                <th className="px-3 py-2 font-medium text-slate-500 text-xs text-left">الرصيد</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-3 py-2 text-slate-700 max-w-[200px] truncate">
                    {row.description}
                  </td>
                  <td className={cn(
                    "px-3 py-2 tabular-nums text-left text-xs",
                    row.debit > 0 ? "text-slate-800 font-medium" : "text-slate-300"
                  )}>
                    {row.debit > 0 ? formatNumber(row.debit, 2) : "—"}
                  </td>
                  <td className={cn(
                    "px-3 py-2 tabular-nums text-left text-xs",
                    row.credit > 0 ? "text-slate-800 font-medium" : "text-slate-300"
                  )}>
                    {row.credit > 0 ? formatNumber(row.credit, 2) : "—"}
                  </td>
                  <td className={cn(
                    "px-3 py-2 tabular-nums font-medium text-left text-xs",
                    row.runningBalance >= 0 ? "text-success-700" : "text-danger-600"
                  )}>
                    {formatNumber(Math.abs(row.runningBalance), 2)}
                    {row.runningBalance < 0 && (
                      <span className="text-xs text-slate-400 mr-1">د</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
