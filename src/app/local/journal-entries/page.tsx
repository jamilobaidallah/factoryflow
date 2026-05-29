"use client";

import { useState, Fragment } from "react";
import { ChevronDown, ChevronLeft, Trash2, BookOpen, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  useJournalEntriesLocal,
  useJournalLinesLocal,
  useTrialBalanceSummaryLocal,
  useDeleteJournalEntryLocal,
} from "@/hooks/local/useJournalLocal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatShortDate } from "@/lib/date-utils";

/** Mirrors the relevant subset of the SQLite `journal_entries` table row shape. */
interface JournalEntryRow {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  sourceType: string | null;
  status: string;
  entryStatus: string;
}

/** Mirrors the SQLite `journal_lines` table row shape. */
interface JournalLineRow {
  id: string;
  accountCode: string;
  accountNameAr: string;
  accountName: string;
  debit: number;
  credit: number;
}

const SOURCE_LABELS: Record<string, string> = {
  ledger: "حركة مالية",
  payment: "دفعة",
  cheque_cash: "صرف شيك",
  endorsement: "تظهير",
  inventory: "مخزون",
  depreciation: "إهلاك",
  manual: "قيد يدوي",
};

/** Renders the debit/credit lines for a single journal entry (lazy-loaded). */
function JournalLines({ journalId }: { journalId: string }) {
  const { data, isLoading } = useJournalLinesLocal(journalId);
  const lines = (data as JournalLineRow[] | undefined) ?? [];

  if (isLoading) {
    return <p className="text-sm text-slate-400 px-4 py-3">جاري تحميل القيود...</p>;
  }

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

  return (
    <div className="bg-slate-50/70 px-4 py-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-right w-24">الرمز</TableHead>
            <TableHead className="text-right">الحساب</TableHead>
            <TableHead className="text-right w-32">مدين</TableHead>
            <TableHead className="text-right w-32">دائن</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line) => (
            <TableRow key={line.id}>
              <TableCell className="font-mono text-slate-600">{line.accountCode}</TableCell>
              <TableCell className="text-slate-700">{line.accountNameAr || line.accountName}</TableCell>
              <TableCell className="text-slate-700">
                {line.debit > 0 ? formatCurrency(line.debit) : "—"}
              </TableCell>
              <TableCell className="text-slate-700">
                {line.credit > 0 ? formatCurrency(line.credit) : "—"}
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="font-semibold border-t-2 border-slate-200">
            <TableCell colSpan={2} className="text-left text-slate-500">الإجمالي</TableCell>
            <TableCell className="text-slate-800">{formatCurrency(totalDebit)}</TableCell>
            <TableCell className="text-slate-800">{formatCurrency(totalCredit)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export default function LocalJournalEntriesPage() {
  const { data, isLoading } = useJournalEntriesLocal(500);
  const { data: summary } = useTrialBalanceSummaryLocal();
  const deleteEntry = useDeleteJournalEntryLocal();

  const entries = (data as JournalEntryRow[] | undefined) ?? [];

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<JournalEntryRow | null>(null);

  function toggle(id: string) {
    setExpandedId((current) => (current === id ? null : id));
  }

  async function handleDelete() {
    if (!deleteTarget) { return; }
    try {
      await deleteEntry.mutateAsync(deleteTarget.id);
      toast({ title: "تم حذف القيد" });
      setDeleteTarget(null);
    } catch (e) {
      console.error("Journal delete failed:", e);
      toast({ title: "فشل الحذف. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  return (
    <div dir="rtl" className="px-6 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">القيود المحاسبية</h1>
        <p className="text-sm text-slate-500 mt-1">
          {entries.length} قيد {entries.length === 500 ? "(أحدث 500)" : ""}
        </p>
      </div>

      {/* Trial balance integrity banner */}
      {summary ? (
        <div
          className={
            summary.isBalanced
              ? "rounded-xl border border-success-200/60 bg-success-50 px-4 py-3 flex items-center gap-3"
              : "rounded-xl border border-danger-200/60 bg-danger-50 px-4 py-3 flex items-center gap-3"
          }
        >
          {summary.isBalanced ? (
            <CheckCircle2 className="h-5 w-5 text-success-600 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-danger-600 shrink-0" />
          )}
          <div className="text-sm">
            <span className={summary.isBalanced ? "text-success-800 font-medium" : "text-danger-800 font-medium"}>
              {summary.isBalanced ? "ميزان المراجعة متوازن" : "ميزان المراجعة غير متوازن!"}
            </span>
            <span className="text-slate-600 mr-2">
              إجمالي المدين {formatCurrency(summary.totalDebits)} · إجمالي الدائن {formatCurrency(summary.totalCredits)}
              {!summary.isBalanced ? ` · الفرق ${formatCurrency(summary.difference)}` : ""}
            </span>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-slate-500 py-8 text-center">جاري التحميل...</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="لا توجد قيود محاسبية"
          description="تُنشأ القيود تلقائياً عند تسجيل الحركات المالية"
        />
      ) : (
        <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="text-right w-32">رقم القيد</TableHead>
                <TableHead className="text-right w-28">التاريخ</TableHead>
                <TableHead className="text-right">البيان</TableHead>
                <TableHead className="text-right w-28">المصدر</TableHead>
                <TableHead className="text-left w-16">حذف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const isManual = entry.sourceType === "manual";
                return (
                  <Fragment key={entry.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => toggle(entry.id)}
                    >
                      <TableCell>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronLeft className="h-4 w-4 text-slate-400" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-slate-700">{entry.entryNumber}</TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatShortDate(entry.date)}
                      </TableCell>
                      <TableCell className="text-slate-800">
                        {entry.description || "—"}
                        {entry.entryStatus === "voided" ? (
                          <Badge variant="secondary" className="mr-2">ملغى</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {entry.sourceType ? SOURCE_LABELS[entry.sourceType] ?? entry.sourceType : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-left" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(entry)}
                          aria-label="حذف"
                          disabled={!isManual}
                          title={isManual ? "حذف القيد" : "القيود الآلية تُحذف من خلال حذف الحركة المرتبطة"}
                        >
                          <Trash2 className="h-4 w-4 text-danger-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {isExpanded ? (
                      <TableRow>
                        <TableCell colSpan={6} className="p-0">
                          <JournalLines journalId={entry.id} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف القيد المحاسبي"
        description={`سيتم حذف القيد "${deleteTarget?.entryNumber}" وجميع بنوده. لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        isLoading={deleteEntry.isPending}
      />
    </div>
  );
}
