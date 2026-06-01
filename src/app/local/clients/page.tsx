"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Users } from "lucide-react";
import {
  useClientsLocal,
  useCreateClientLocal,
  useUpdateClientLocal,
  useDeleteClientLocal,
} from "@/hooks/local/useClientsLocal";
import { useLedgerLocal } from "@/hooks/local/useLedgerLocal";
import { useActiveProfile } from "@/hooks/local/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/date-utils";

/** Mirrors the SQLite `clients` table row shape. */
interface ClientRow {
  id: string;
  profileId: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  createdAt: string;
}

interface ClientForm {
  name: string;
  phone: string;
  email: string;
  address: string;
}

const EMPTY_FORM: ClientForm = { name: "", phone: "", email: "", address: "" };

/** Subset of the ledger row we need for the balance computation. */
interface LedgerForBalance {
  type: string;
  amount: number;
  associatedParty: string | null;
  paymentStatus: string | null;
  remainingBalance: number | null;
  isARAPEntry: boolean | number | null;
}

/**
 * Compute outstanding balance per client name from ledger entries.
 *
 * Why this exists: the SQLite `clients.balance` column is migrated as-is
 * from Firestore, where it's always 0 (Firestore-side balances are
 * computed live by the app from the ledger, not stored). We do the same
 * computation here from the local ledger so the column shows real numbers.
 *
 * Positive = client owes you (مدين). Negative = you owe the client (دائن).
 */
function buildBalanceIndex(ledger: LedgerForBalance[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of ledger) {
    const isARAP = e.isARAPEntry === true || e.isARAPEntry === 1;
    if (!isARAP) { continue; }
    if (!e.associatedParty) { continue; }
    if (e.paymentStatus !== "unpaid" && e.paymentStatus !== "partial") { continue; }
    const outstanding = (e.remainingBalance ?? e.amount) || 0;
    // Income/return = client owes us; expense = we owe the supplier.
    const sign = e.type === "دخل" || e.type === "إيراد" || e.type === "مردود" ? 1 : -1;
    out.set(e.associatedParty, (out.get(e.associatedParty) ?? 0) + sign * outstanding);
  }
  return out;
}

export default function LocalClientsPage() {
  const profile = useActiveProfile();
  const { data, isLoading } = useClientsLocal();
  const { data: ledgerData } = useLedgerLocal(5000);
  const createClient = useCreateClientLocal();
  const updateClient = useUpdateClientLocal();
  const deleteClient = useDeleteClientLocal();

  const clients = useMemo(() => (data as ClientRow[] | undefined) ?? [], [data]);

  const balanceByName = useMemo(
    () => buildBalanceIndex((ledgerData as LedgerForBalance[] | undefined) ?? []),
    [ledgerData],
  );

  /** Resolve a client's display balance: computed from ledger, fallback to stored. */
  function balanceOf(client: ClientRow): number {
    return balanceByName.get(client.name) ?? client.balance ?? 0;
  }

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) { return clients; }
    return clients.filter(
      (c) => c.name.toLowerCase().includes(term) || c.phone.includes(term)
    );
  }, [clients, search]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(client: ClientRow) {
    setEditing(client);
    setForm({
      name: client.name,
      phone: client.phone,
      email: client.email,
      address: client.address,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" });
      return;
    }
    if (!profile) { return; }

    try {
      if (editing) {
        await updateClient.mutateAsync({
          id: editing.id,
          data: {
            name: form.name.trim(),
            phone: form.phone.trim(),
            email: form.email.trim(),
            address: form.address.trim(),
          },
        });
        toast({ title: "تم تحديث العميل بنجاح" });
      } else {
        await createClient.mutateAsync({
          id: `cli-${crypto.randomUUID()}`,
          profileId: profile.id,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          address: form.address.trim(),
          balance: 0,
          createdAt: new Date().toISOString(),
        });
        toast({ title: "تم إضافة العميل بنجاح" });
      }
      setDialogOpen(false);
    } catch (e) {
      console.error("Client save failed:", e);
      toast({ title: "فشل الحفظ. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) { return; }
    try {
      await deleteClient.mutateAsync(deleteTarget.id);
      toast({ title: "تم حذف العميل" });
      setDeleteTarget(null);
    } catch (e) {
      console.error("Client delete failed:", e);
      toast({ title: "فشل الحذف. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  const isSaving = createClient.isPending || updateClient.isPending;

  return (
    <div dir="rtl" className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">العملاء</h1>
          <p className="text-sm text-slate-500 mt-1">
            {clients.length} عميل
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة عميل
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف..."
          className="pr-9"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <p className="text-slate-500 py-8 text-center">جاري التحميل...</p>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد عملاء"
          description="ابدأ بإضافة أول عميل لك"
          action={{ label: "إضافة عميل", onClick: openAdd }}
        />
      ) : filtered.length === 0 ? (
        <p className="text-slate-500 py-8 text-center">لا توجد نتائج مطابقة للبحث</p>
      ) : (
        <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">البريد الإلكتروني</TableHead>
                <TableHead className="text-right">الرصيد</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((client) => {
                const computedBalance = balanceOf(client);
                return (
                <TableRow key={client.id}>
                  <TableCell className="font-medium text-slate-800">{client.name}</TableCell>
                  <TableCell className="text-slate-600">{client.phone || "—"}</TableCell>
                  <TableCell className="text-slate-600">{client.email || "—"}</TableCell>
                  <TableCell
                    className={
                      computedBalance > 0
                        ? "text-danger-600 font-medium"
                        : computedBalance < 0
                          ? "text-success-600 font-medium"
                          : "text-slate-500"
                    }
                    title={computedBalance > 0 ? "مدين (يدين لك)" : computedBalance < 0 ? "دائن (تدين له)" : ""}
                  >
                    {formatCurrency(Math.abs(computedBalance))}
                    {computedBalance > 0 ? <span className="text-xs text-slate-400 mr-1">مدين</span> : null}
                    {computedBalance < 0 ? <span className="text-xs text-slate-400 mr-1">دائن</span> : null}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(client)}
                        aria-label="تعديل"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(client)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل العميل" : "إضافة عميل جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="client-name">الاسم *</Label>
              <Input
                id="client-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اسم العميل"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-phone">الهاتف</Label>
              <Input
                id="client-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="رقم الهاتف"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-email">البريد الإلكتروني</Label>
              <Input
                id="client-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="client-address">العنوان</Label>
              <Input
                id="client-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="العنوان"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف العميل"
        description={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        isLoading={deleteClient.isPending}
      />
    </div>
  );
}
