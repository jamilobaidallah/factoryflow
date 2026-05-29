"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveProfile, clearActiveProfile } from "@/hooks/local/useActiveProfile";
import {
  useClientsLocal,
  useCreateClientLocal,
} from "@/hooks/local/useClientsLocal";
import {
  useLedgerLocal,
  useLedgerCountLocal,
  useUnpaidARAPCountLocal,
  useCreateLedgerEntryLocal,
} from "@/hooks/local/useLedgerLocal";
import {
  useJournalEntriesLocal,
  useTrialBalanceSummaryLocal,
} from "@/hooks/local/useJournalLocal";

// Quick sanity check: is the page running inside Electron?
function isElectron(): boolean {
  return typeof window !== "undefined" && "electron" in window;
}

interface ClientRow {
  id: string; name: string; phone: string; createdAt: string;
}
interface LedgerRow {
  id: string; description: string; type: string; amount: number;
  category: string; associatedParty: string; date: string;
  paymentStatus?: string;
}
interface JournalRow {
  id: string; entryNumber: string; description: string; date: string;
  sourceType?: string | null;
}

export default function LocalDiagnosticPage() {
  const router = useRouter();
  const profile = useActiveProfile();

  // ── Queries ─────────────────────────────────────────────────────────────
  const { data: clientsData }   = useClientsLocal();
  const { data: ledgerData }    = useLedgerLocal(20);
  const { data: ledgerCount }   = useLedgerCountLocal();
  const { data: unpaidCount }   = useUnpaidARAPCountLocal();
  const { data: journalData }   = useJournalEntriesLocal(20);
  const { data: trialBalance }  = useTrialBalanceSummaryLocal();

  const clients  = (clientsData ?? []) as ClientRow[];
  const ledger   = (ledgerData ?? []) as LedgerRow[];
  const journals = (journalData ?? []) as JournalRow[];

  // ── Mutations ───────────────────────────────────────────────────────────
  const createClient      = useCreateClientLocal();
  const createLedgerEntry = useCreateLedgerEntryLocal();

  // ── Form state ──────────────────────────────────────────────────────────
  const [clientName,  setClientName]  = useState("");
  const [clientPhone, setClientPhone] = useState("");

  const [txnType,     setTxnType]     = useState<"دخل" | "مصروف">("دخل");
  const [txnAmount,   setTxnAmount]   = useState("");
  const [txnParty,    setTxnParty]    = useState("");
  const [txnDesc,     setTxnDesc]     = useState("");
  const [txnInstant,  setTxnInstant]  = useState(true);
  const [txnCategory, setTxnCategory] = useState("مبيعات حجر مقطوع");

  // ── Handlers ────────────────────────────────────────────────────────────
  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim() || !profile) { return; }
    await createClient.mutateAsync({
      id: `cli-${Date.now()}`,
      profileId: profile.id,
      name: clientName.trim(),
      phone: clientPhone.trim(),
      email: "",
      address: "",
      balance: 0,
      createdAt: new Date().toISOString(),
    });
    setClientName(""); setClientPhone("");
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(txnAmount);
    if (!amount || amount <= 0 || !profile) { return; }
    await createLedgerEntry.mutateAsync({
      profileId: profile.id,
      type: txnType,
      amount,
      category: txnCategory,
      subCategory: txnType === "مصروف" ? "إيجار محل" : "",
      associatedParty: txnParty.trim() || "—",
      description: txnDesc.trim(),
      date: new Date().toISOString(),
      immediateSettlement: txnInstant,
    });
    setTxnAmount(""); setTxnParty(""); setTxnDesc("");
  }

  function handleSwitchProfile() {
    clearActiveProfile();
    router.push("/profile-picker");
  }

  // ── Render guards ───────────────────────────────────────────────────────
  if (typeof window !== "undefined" && !isElectron()) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3">⚠️ هذه الصفحة تعمل داخل تطبيق Electron فقط</h1>
          <p className="text-slate-400 text-sm">
            لاختبار النسخة المحلية، شغّل: <code className="bg-slate-800 px-2 py-1 rounded">npm run electron:dev</code>
          </p>
        </div>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6" dir="rtl">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-3">لم يتم اختيار ملف تجاري</h1>
          <button
            onClick={() => router.push("/profile-picker")}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-medium"
          >
            اختيار ملف تجاري
          </button>
        </div>
      </div>
    );
  }

  // ── Page ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      <div className="max-w-6xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{profile.emoji}</span>
            <div>
              <h1 className="text-xl font-bold">{profile.name}</h1>
              <p className="text-xs text-slate-500">صفحة اختبار قاعدة البيانات المحلية</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/local/dashboard")}
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              الذهاب إلى لوحة التحكم
            </button>
            <button
              onClick={handleSwitchProfile}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              تبديل الملف ←
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="العملاء"           value={clients.length} />
          <StatCard label="القيود الإجمالية"   value={ledgerCount ?? 0} />
          <StatCard label="غير المدفوع"        value={unpaidCount ?? 0} accent={(unpaidCount ?? 0) > 0 ? "amber" : undefined} />
          <StatCard label="قيود اليومية"       value={journals.length} />
        </div>

        {/* Trial Balance */}
        <div className={`rounded-xl border p-5 ${
          trialBalance?.isBalanced ? "border-emerald-600/50 bg-emerald-950/30" : "border-rose-600/50 bg-rose-950/30"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">ميزان المراجعة</h2>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              trialBalance?.isBalanced
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-rose-500/20 text-rose-300"
            }`}>
              {trialBalance?.isBalanced ? "✓ متوازن" : "✗ غير متوازن"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-slate-400 text-xs mb-1">إجمالي المدين</div>
              <div className="text-lg font-mono">{(trialBalance?.totalDebits ?? 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">إجمالي الدائن</div>
              <div className="text-lg font-mono">{(trialBalance?.totalCredits ?? 0).toFixed(2)}</div>
            </div>
            <div>
              <div className="text-slate-400 text-xs mb-1">الفرق</div>
              <div className="text-lg font-mono">{(trialBalance?.difference ?? 0).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Forms */}
        <div className="grid md:grid-cols-2 gap-4">

          {/* Add Client */}
          <form onSubmit={handleAddClient} className="rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-3">
            <h2 className="font-semibold mb-2">إضافة عميل</h2>
            <input
              value={clientName}
              onChange={e => setClientName(e.target.value)}
              placeholder="اسم العميل"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={clientPhone}
              onChange={e => setClientPhone(e.target.value)}
              placeholder="رقم الهاتف"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={createClient.isPending || !clientName.trim()}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
            >
              {createClient.isPending ? "..." : "إضافة العميل"}
            </button>
          </form>

          {/* Add Transaction */}
          <form onSubmit={handleAddTransaction} className="rounded-xl bg-slate-900 border border-slate-700 p-5 space-y-3">
            <h2 className="font-semibold mb-2">إضافة قيد محاسبي</h2>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setTxnType("دخل"); setTxnCategory("مبيعات حجر مقطوع"); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                  txnType === "دخل" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                دخل
              </button>
              <button
                type="button"
                onClick={() => { setTxnType("مصروف"); setTxnCategory("مصاريف تشغيلية"); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                  txnType === "مصروف" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                مصروف
              </button>
            </div>

            <input
              type="number"
              value={txnAmount}
              onChange={e => setTxnAmount(e.target.value)}
              placeholder="المبلغ"
              step="0.01"
              min="0"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={txnParty}
              onChange={e => setTxnParty(e.target.value)}
              placeholder={txnType === "دخل" ? "اسم العميل" : "اسم المورد"}
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={txnDesc}
              onChange={e => setTxnDesc(e.target.value)}
              placeholder="الوصف (اختياري)"
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={txnInstant}
                onChange={e => setTxnInstant(e.target.checked)}
                className="rounded"
              />
              نقدي مباشر
            </label>
            <button
              type="submit"
              disabled={createLedgerEntry.isPending || !txnAmount}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium"
            >
              {createLedgerEntry.isPending ? "..." : "إضافة القيد"}
            </button>
          </form>
        </div>

        {/* Recent Ledger */}
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-5">
          <h2 className="font-semibold mb-3">آخر القيود</h2>
          {ledger.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">لا توجد قيود — أضف قيدًا أعلاه</p>
          ) : (
            <div className="space-y-1">
              {ledger.slice(0, 10).map(e => (
                <div key={e.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-slate-800/50 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{e.description || "—"}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {e.associatedParty} · {e.category}
                    </div>
                  </div>
                  <div className="text-left ml-3">
                    <div className={`font-mono font-semibold ${e.type === "دخل" || e.type === "إيراد" ? "text-emerald-400" : "text-rose-400"}`}>
                      {e.type === "دخل" || e.type === "إيراد" ? "+" : "-"}{e.amount.toFixed(2)}
                    </div>
                    {e.paymentStatus && (
                      <div className="text-xs text-slate-500">{e.paymentStatus}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Journals */}
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-5">
          <h2 className="font-semibold mb-3">قيود اليومية الأخيرة</h2>
          {journals.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">لا توجد قيود يومية</p>
          ) : (
            <div className="space-y-1">
              {journals.slice(0, 10).map(j => (
                <div key={j.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-slate-800/50 text-sm font-mono">
                  <div>
                    <div className="font-semibold">{j.entryNumber}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{j.description || "—"}</div>
                  </div>
                  <div className="text-xs text-slate-500">{j.sourceType ?? ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Clients */}
        <div className="rounded-xl bg-slate-900 border border-slate-700 p-5">
          <h2 className="font-semibold mb-3">العملاء</h2>
          {clients.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">لا يوجد عملاء بعد</p>
          ) : (
            <div className="space-y-1">
              {clients.slice(0, 10).map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-slate-800/50 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "amber" }) {
  const accentClass =
    accent === "amber"
      ? "border-amber-600/50 bg-amber-950/30"
      : "border-slate-700 bg-slate-900";
  return (
    <div className={`rounded-xl border p-4 ${accentClass}`}>
      <div className="text-xs text-slate-400 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
