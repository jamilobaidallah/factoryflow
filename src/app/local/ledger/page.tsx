"use client";

import { useState } from "react";
import { Plus, Trash2, Receipt } from "lucide-react";
import {
  useLedgerLocal,
  useCreateLedgerEntryLocal,
  useDeleteLedgerEntryLocal,
} from "@/hooks/local/useLedgerLocal";
import { useActiveProfile } from "@/hooks/local/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatShortDate } from "@/lib/date-utils";

/** Transaction types — must match the Arabic strings stored in the ledger. */
const TX_TYPE_INCOME = "دخل";
const TX_TYPE_EXPENSE = "مصروف";
const TX_TYPE_CAPITAL = "حركة رأس مال";

const TX_TYPES = [TX_TYPE_INCOME, TX_TYPE_EXPENSE, TX_TYPE_CAPITAL] as const;

/** Mirrors the relevant subset of the SQLite `ledger` table row shape. */
interface LedgerRow {
  id: string;
  transactionId: string;
  description: string;
  type: string;
  amount: number;
  category: string;
  associatedParty: string;
  date: string;
  paymentStatus: string | null;
  isARAPEntry: boolean | null;
}

interface LedgerForm {
  type: string;
  amount: string;
  description: string;
  category: string;
  associatedParty: string;
  date: string;
  immediateSettlement: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: LedgerForm = {
  type: TX_TYPE_INCOME,
  amount: "",
  description: "",
  category: "",
  associatedParty: "",
  date: todayIso(),
  immediateSettlement: true,
};

function paymentBadge(entry: LedgerRow): React.ReactNode {
  if (!entry.isARAPEntry) { return <span className="text-slate-400">—</span>; }
  switch (entry.paymentStatus) {
    case "paid":
      return <Badge variant="cleared">مدفوع</Badge>;
    case "partial":
      return <Badge variant="pending">جزئي</Badge>;
    default:
      return <Badge variant="bounced">غير مدفوع</Badge>;
  }
}

export default function LocalLedgerPage() {
  const profile = useActiveProfile();
  const { data, isLoading } = useLedgerLocal(500);
  const createEntry = useCreateLedgerEntryLocal();
  const deleteEntry = useDeleteLedgerEntryLocal();

  const entries = (data as LedgerRow[] | undefined) ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<LedgerForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<LedgerRow | null>(null);

  function openAdd() {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      toast({ title: "المبلغ يجب أن يكون أكبر من صفر", variant: "destructive" });
      return;
    }
    if (!profile) { return; }

    try {
      await createEntry.mutateAsync({
        profileId: profile.id,
        type: form.type,
        amount,
        description: form.description.trim(),
        category: form.category.trim(),
        associatedParty: form.associatedParty.trim(),
        date: new Date(form.date).toISOString(),
        immediateSettlement: form.immediateSettlement,
        isARAPEntry: !form.immediateSettlement,
      });
      toast({ title: "تمت إضافة الحركة بنجاح" });
      setDialogOpen(false);
    } catch (e) {
      console.error("Ledger create failed:", e);
      toast({ title: "فشل حفظ الحركة. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) { return; }
    try {
      await deleteEntry.mutateAsync(deleteTarget.id);
      toast({ title: "تم حذف الحركة وقيودها المحاسبية" });
      setDeleteTarget(null);
    } catch (e) {
      console.error("Ledger delete failed:", e);
      toast({ title: "فشل الحذف. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  return (
    <div dir="rtl" className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">السجل المالي</h1>
          <p className="text-sm text-slate-500 mt-1">
            {entries.length} حركة {entries.length === 500 ? "(أحدث 500)" : ""}
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة حركة
        </Button>
      </div>

      {isLoading ? (
        <p className="text-slate-500 py-8 text-center">جاري التحميل...</p>
      ) : entries.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="لا توجد حركات"
          description="سجل أول حركة مالية ليتم إنشاء القيد المحاسبي تلقائياً"
          action={{ label: "إضافة حركة", onClick: openAdd }}
        />
      ) : (
        <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right w-28">التاريخ</TableHead>
                <TableHead className="text-right">البيان</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">التصنيف</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">حالة الدفع</TableHead>
                <TableHead className="text-left w-16">حذف</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isIncome = entry.type === TX_TYPE_INCOME;
                const isExpense = entry.type === TX_TYPE_EXPENSE;
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {formatShortDate(entry.date)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800">
                      {entry.description || "—"}
                      {entry.associatedParty ? (
                        <span className="block text-xs text-slate-400">{entry.associatedParty}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={isIncome ? "cleared" : isExpense ? "bounced" : "secondary"}>
                        {entry.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-600">{entry.category || "—"}</TableCell>
                    <TableCell
                      className={
                        isIncome
                          ? "text-success-600 font-medium"
                          : isExpense
                            ? "text-danger-600 font-medium"
                            : "text-slate-700 font-medium"
                      }
                    >
                      {formatCurrency(entry.amount)}
                    </TableCell>
                    <TableCell>{paymentBadge(entry)}</TableCell>
                    <TableCell className="text-left">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(entry)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة حركة مالية</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="led-type">النوع</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger id="led-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TX_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="led-amount">المبلغ *</Label>
                <Input
                  id="led-amount"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="led-desc">البيان</Label>
              <Input
                id="led-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="وصف الحركة"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="led-cat">التصنيف</Label>
                <Input
                  id="led-cat"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="التصنيف"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="led-date">التاريخ</Label>
                <Input
                  id="led-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="led-party">الطرف المرتبط</Label>
              <Input
                id="led-party"
                value={form.associatedParty}
                onChange={(e) => setForm({ ...form, associatedParty: e.target.value })}
                placeholder="اسم العميل أو المورد"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="led-immediate"
                checked={form.immediateSettlement}
                onCheckedChange={(checked) =>
                  setForm({ ...form, immediateSettlement: checked === true })
                }
              />
              <Label htmlFor="led-immediate" className="cursor-pointer">
                تسوية نقدية فورية (غير ذلك تُسجَّل كذمم)
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={createEntry.isPending}>
              {createEntry.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف الحركة"
        description="سيتم حذف الحركة المالية وجميع قيودها المحاسبية المرتبطة. لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        isLoading={deleteEntry.isPending}
      />
    </div>
  );
}
