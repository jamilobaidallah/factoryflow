"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Mail, Phone, MapPin, ArrowUp, ArrowDown } from "lucide-react";
import { useClientsLocal } from "@/hooks/local/useClientsLocal";
import { useLedgerLocal } from "@/hooks/local/useLedgerLocal";
import { usePaymentsLocal } from "@/hooks/local/usePaymentsLocal";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatShortDate } from "@/lib/date-utils";
import { Users } from "lucide-react";

interface ClientRow {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface LedgerRow {
  id: string;
  transactionId: string;
  date: string;
  type: string;
  amount: number;
  category: string;
  associatedParty: string | null;
  description: string;
  paymentStatus: string | null;
  remainingBalance: number | null;
  totalPaid: number | null;
  isARAPEntry: boolean | number | null;
}

interface PaymentRow {
  id: string;
  date: string;
  amount: number;
  type: string;
  clientName: string;
  notes: string;
}

// Required for static export — dynamic routes need declared params.
// We don't pre-render any ids; the route resolves client-side at runtime.
// (Static export config is in next.config.js when NEXT_BUILD_TARGET=electron.)

export default function LocalClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? "");

  const { data: clientsData } = useClientsLocal();
  const { data: ledgerData }  = useLedgerLocal(5000);
  const { data: paymentsData } = usePaymentsLocal();

  const clients  = (clientsData as ClientRow[] | undefined) ?? [];
  const ledger   = (ledgerData   as LedgerRow[]  | undefined) ?? [];
  const payments = (paymentsData as PaymentRow[] | undefined) ?? [];

  const client = useMemo(() => clients.find((c) => c.id === id), [clients, id]);

  // Transactions for this client are matched by associatedParty === client.name.
  // (Firestore data uses name strings, not ids, for the party association.)
  const txForClient = useMemo(() => {
    if (!client) { return []; }
    return ledger
      .filter((e) => e.associatedParty === client.name)
      .sort((a, b) => (b.date < a.date ? -1 : 1));
  }, [ledger, client]);

  const paymentsForClient = useMemo(() => {
    if (!client) { return []; }
    return payments
      .filter((p) => p.clientName === client.name)
      .sort((a, b) => (b.date < a.date ? -1 : 1));
  }, [payments, client]);

  /** Outstanding balance = sum of unpaid/partial AR/AP, signed by direction. */
  const summary = useMemo(() => {
    let income = 0, expense = 0, outstanding = 0;
    let unpaidCount = 0;
    for (const e of txForClient) {
      if (e.type === "دخل" || e.type === "إيراد") { income  += e.amount; }
      if (e.type === "مصروف")                       { expense += e.amount; }
      const isARAP = e.isARAPEntry === true || e.isARAPEntry === 1;
      if (isARAP && (e.paymentStatus === "unpaid" || e.paymentStatus === "partial")) {
        const balance = (e.remainingBalance ?? e.amount) || 0;
        const sign = e.type === "دخل" || e.type === "إيراد" || e.type === "مردود" ? 1 : -1;
        outstanding += sign * balance;
        unpaidCount++;
      }
    }
    return { income, expense, outstanding, unpaidCount, totalTx: txForClient.length };
  }, [txForClient]);

  // ── Render ───────────────────────────────────────────────────────────

  if (!clientsData) {
    return <div className="p-6 text-slate-500" dir="rtl">جاري التحميل...</div>;
  }

  if (!client) {
    return (
      <div className="p-6" dir="rtl">
        <EmptyState
          icon={Users}
          title="العميل غير موجود"
          description="قد يكون قد تم حذفه أو أن الرابط غير صحيح"
          action={{ label: "العودة إلى العملاء", onClick: () => router.push("/local/clients") }}
        />
      </div>
    );
  }

  const isDebit  = summary.outstanding > 0;
  const isCredit = summary.outstanding < 0;

  return (
    <div dir="rtl" className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/local/clients"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
          title="العودة"
        >
          <ArrowRight className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{client.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {summary.totalTx} حركة · {summary.unpaidCount} غير مدفوع
          </p>
        </div>
      </div>

      {/* Client info + balance card */}
      <div className="grid md:grid-cols-3 gap-3">
        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200/60 p-5 space-y-2 text-sm">
          {client.phone && (
            <div className="flex items-center gap-2 text-slate-600">
              <Phone className="h-4 w-4 text-slate-400" />
              <span dir="ltr">{client.phone}</span>
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2 text-slate-600">
              <Mail className="h-4 w-4 text-slate-400" />
              <span dir="ltr">{client.email}</span>
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="h-4 w-4 text-slate-400" />
              <span>{client.address}</span>
            </div>
          )}
          {!client.phone && !client.email && !client.address && (
            <p className="text-slate-400">لا توجد بيانات تواصل</p>
          )}
        </div>

        <div
          className={
            isDebit
              ? "rounded-xl border border-danger-200/60 bg-danger-50/30 p-5"
              : isCredit
                ? "rounded-xl border border-success-200/60 bg-success-50/30 p-5"
                : "rounded-xl border border-slate-200/60 bg-slate-50/30 p-5"
          }
        >
          <div className="text-xs text-slate-500 font-medium mb-1">الرصيد المستحق</div>
          <div className={
            isDebit ? "text-2xl font-bold text-danger-700"
            : isCredit ? "text-2xl font-bold text-success-700"
            : "text-2xl font-bold text-slate-500"
          }>
            {formatCurrency(Math.abs(summary.outstanding))}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {isDebit ? "العميل مدين لك" : isCredit ? "أنت مدين للعميل" : "لا يوجد رصيد مستحق"}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-success-200/60">
          <div className="text-xs text-success-600 font-medium mb-1">إجمالي الإيرادات</div>
          <div className="text-lg font-semibold text-success-700">{formatCurrency(summary.income)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-danger-200/60">
          <div className="text-xs text-danger-600 font-medium mb-1">إجمالي المصاريف</div>
          <div className="text-lg font-semibold text-danger-700">{formatCurrency(summary.expense)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200/60 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-500 font-medium mb-1">عدد المدفوعات</div>
          <div className="text-lg font-semibold text-slate-700">{paymentsForClient.length}</div>
        </div>
      </div>

      {/* Transactions table */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">حركات العميل</h2>
        {txForClient.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/60 p-8 text-center text-slate-500">
            لا توجد حركات لهذا العميل
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-10" />
                  <TableHead className="text-right w-28">التاريخ</TableHead>
                  <TableHead className="text-right">البيان</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  <TableHead className="text-right w-32">المبلغ</TableHead>
                  <TableHead className="text-right w-32">المتبقي</TableHead>
                  <TableHead className="text-right w-24">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txForClient.map((e) => {
                  const isIncome = e.type === "دخل" || e.type === "إيراد";
                  const isExpense = e.type === "مصروف";
                  const remaining = e.remainingBalance ?? 0;
                  return (
                    <TableRow key={e.id}>
                      <TableCell>
                        {isIncome
                          ? <ArrowUp className="h-4 w-4 text-success-500" />
                          : isExpense
                            ? <ArrowDown className="h-4 w-4 text-danger-500" />
                            : null}
                      </TableCell>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatShortDate(e.date)}
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {e.description || "—"}
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">{e.category || "—"}</TableCell>
                      <TableCell className={
                        isIncome ? "text-success-700 font-medium font-mono" :
                        isExpense ? "text-danger-700 font-medium font-mono" :
                        "text-slate-700 font-mono"
                      }>
                        {isIncome ? "+" : isExpense ? "-" : ""}{formatCurrency(e.amount)}
                      </TableCell>
                      <TableCell className="text-slate-600 font-mono">
                        {remaining > 0 ? formatCurrency(remaining) : "—"}
                      </TableCell>
                      <TableCell>
                        {e.paymentStatus === "paid" && <Badge variant="cleared">مدفوع</Badge>}
                        {e.paymentStatus === "partial" && <Badge variant="pending">جزئي</Badge>}
                        {e.paymentStatus === "unpaid" && <Badge variant="bounced">غير مدفوع</Badge>}
                        {!e.paymentStatus && <span className="text-slate-400">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Payments for this client */}
      {paymentsForClient.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-3">المدفوعات</h2>
          <div className="bg-white rounded-xl border border-slate-200/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-28">التاريخ</TableHead>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right w-32">المبلغ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsForClient.map((p) => {
                  const isReceipt = p.type === "قبض";
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {formatShortDate(p.date)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isReceipt ? "cleared" : "bounced"}>{p.type}</Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">{p.notes || "—"}</TableCell>
                      <TableCell className={
                        isReceipt
                          ? "text-success-700 font-medium font-mono"
                          : "text-danger-700 font-medium font-mono"
                      }>
                        {formatCurrency(p.amount)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}
