"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronLeft, Plus, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/lib/date-utils";
import { safeAdd } from "@/lib/currency";
import { useUser } from "@/firebase/provider";
import { getJournalEntries } from "@/services/journalService";
import type { JournalEntry } from "@/types/accounting";
import { ManualJournalDialog } from "./components/ManualJournalDialog";
import { useActiveAccounts } from "@/components/chart-of-accounts/hooks/useActiveAccounts";
import { usePermissions } from "@/hooks/usePermissions";

export function JournalEntriesPage() {
  const { user } = useUser();
  const { isOwner } = usePermissions();
  const { accounts } = useActiveAccounts();

  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const loadEntries = useCallback(() => {
    if (!user?.dataOwnerId) return;
    setLoading(true);
    setError(null);
    getJournalEntries(user.dataOwnerId, undefined, undefined, false)
      .then((result) => {
        if (result.success && result.data) {
          const sorted = [...result.data].sort((a, b) => b.date.getTime() - a.date.getTime());
          setEntries(sorted);
          setWarning(result.warning ?? null);
        } else if (!result.success) {
          setError("فشل تحميل القيود اليومية. يرجى المحاولة مرة أخرى.");
        }
      })
      .catch(() => {
        setError("حدث خطأ في الاتصال. يرجى المحاولة مرة أخرى.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [user?.dataOwnerId]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  return (
    <div className="flex flex-col h-full" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white">
        <div>
          <h1 className="text-xl font-bold text-slate-900">القيود اليومية</h1>
          {!loading && !error && (
            <p className="text-sm text-slate-500 mt-0.5">
              {entries.length} قيد محاسبي
            </p>
          )}
        </div>
        {isOwner && (
          <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            قيد جديد
          </Button>
        )}
      </div>

      {warning && (
        <div className="px-6 py-2 text-sm text-amber-600 bg-amber-50 border-b border-amber-200">
          {warning}
        </div>
      )}

      {/* Entries list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-24 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin ml-2" />
            <span>جارٍ التحميل…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 text-danger-600 gap-3">
            <AlertCircle className="h-8 w-8 text-danger-400" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={loadEntries}>
              إعادة المحاولة
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-2">
            <p className="text-sm">لا توجد قيود يومية</p>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                أضف أول قيد
              </Button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm text-right">
            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="w-8" />
                <th className="px-4 py-2.5 font-medium text-slate-500 text-xs">رقم القيد</th>
                <th className="px-4 py-2.5 font-medium text-slate-500 text-xs">التاريخ</th>
                <th className="px-4 py-2.5 font-medium text-slate-500 text-xs">البيان</th>
                <th className="px-4 py-2.5 font-medium text-slate-500 text-xs text-left">مدين</th>
                <th className="px-4 py-2.5 font-medium text-slate-500 text-xs text-left">دائن</th>
                <th className="px-4 py-2.5 font-medium text-slate-500 text-xs">النوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const totalDebit = entry.lines.reduce((s, l) => safeAdd(s, l.debit), 0);
                const totalCredit = entry.lines.reduce((s, l) => safeAdd(s, l.credit), 0);
                const isManual = entry.linkedDocumentType === "manual";
                const isExpanded = expandedIds.has(entry.id);
                return (
                  <React.Fragment key={entry.id}>
                    <tr
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => toggleExpand(entry.id)}
                    >
                      <td className="pr-3 pl-1 py-2.5 text-slate-400">
                        {isExpanded
                          ? <ChevronDown className="h-3.5 w-3.5" />
                          : <ChevronLeft className="h-3.5 w-3.5" />}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                        {entry.entryNumber}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 max-w-[260px] truncate">
                        {entry.description}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-left text-xs text-slate-800">
                        {formatNumber(totalDebit, 2)}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-left text-xs text-slate-800">
                        {formatNumber(totalCredit, 2)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                            isManual
                              ? "bg-primary-100 text-primary-700"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {isManual ? "يدوي" : "تلقائي"}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && entry.lines.map((line, idx) => (
                      <tr key={`${entry.id}-line-${idx}`} className="bg-slate-50/70">
                        <td />
                        <td />
                        <td />
                        <td className={cn("px-4 py-1.5 text-xs text-slate-600", line.debit > 0 ? "" : "pr-10")}>
                          {line.debit > 0 ? (
                            <span className="font-medium">{line.accountNameAr || line.accountCode}</span>
                          ) : (
                            <span className="text-slate-400 mr-6">{line.accountNameAr || line.accountCode}</span>
                          )}
                          <span className="text-slate-400 text-[10px] mr-1">({line.accountCode})</span>
                        </td>
                        <td className="px-4 py-1.5 tabular-nums text-left text-xs text-slate-700">
                          {line.debit > 0 ? formatNumber(line.debit, 2) : ""}
                        </td>
                        <td className="px-4 py-1.5 tabular-nums text-left text-xs text-slate-700">
                          {line.credit > 0 ? formatNumber(line.credit, 2) : ""}
                        </td>
                        <td />
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ManualJournalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        accounts={accounts}
        onSuccess={loadEntries}
      />
    </div>
  );
}
