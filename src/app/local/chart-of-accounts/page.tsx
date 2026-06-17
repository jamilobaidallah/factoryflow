"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Ban, ListTree } from "lucide-react";
import {
  useChartOfAccountsLocal,
  useCreateAccountLocal,
  useUpdateAccountLocal,
  useDeactivateAccountLocal,
} from "@/hooks/local/useChartOfAccountsLocal";
import { useActiveProfile } from "@/hooks/local/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
type NormalBalance = "debit" | "credit";

/** Mirrors the SQLite `chart_of_accounts` table row shape. */
interface AccountRow {
  id: string;
  profileId: string;
  code: string;
  name: string;
  nameAr: string;
  type: AccountType;
  normalBalance: NormalBalance;
  isActive: boolean;
  isSystemAccount?: boolean | null;
  parentCode?: string | null;
  description?: string | null;
  createdAt: string;
}

interface AccountForm {
  code: string;
  nameAr: string;
  name: string;
  type: AccountType;
  normalBalance: NormalBalance;
}

const TYPE_LABELS: Record<AccountType, string> = {
  asset: "الأصول",
  liability: "الخصوم",
  equity: "حقوق الملكية",
  revenue: "الإيرادات",
  expense: "المصروفات",
};

/** Display order for the grouped sections — follows accounting statement order. */
const TYPE_ORDER: AccountType[] = ["asset", "liability", "equity", "revenue", "expense"];

/** Debit-normal: assets & expenses. Credit-normal: everything else. */
function defaultNormalBalance(type: AccountType): NormalBalance {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

const EMPTY_FORM: AccountForm = {
  code: "",
  nameAr: "",
  name: "",
  type: "asset",
  normalBalance: "debit",
};

export default function LocalChartOfAccountsPage() {
  const profile = useActiveProfile();
  const { data, isLoading } = useChartOfAccountsLocal();
  const createAccount = useCreateAccountLocal();
  const updateAccount = useUpdateAccountLocal();
  const deactivateAccount = useDeactivateAccountLocal();

  const accounts = useMemo(() => (data as AccountRow[] | undefined) ?? [], [data]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountRow | null>(null);
  const [form, setForm] = useState<AccountForm>(EMPTY_FORM);
  const [deactivateTarget, setDeactivateTarget] = useState<AccountRow | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<AccountType, AccountRow[]>();
    for (const type of TYPE_ORDER) { map.set(type, []); }
    for (const account of accounts) {
      const bucket = map.get(account.type);
      if (bucket) { bucket.push(account); }
    }
    return map;
  }, [accounts]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(account: AccountRow) {
    setEditing(account);
    setForm({
      code: account.code,
      nameAr: account.nameAr,
      name: account.name,
      type: account.type,
      normalBalance: account.normalBalance,
    });
    setDialogOpen(true);
  }

  function handleTypeChange(type: AccountType) {
    // Keep normal balance in sync with the conventional default when type changes,
    // but only auto-set it on the add flow / when it matches the old default.
    setForm((prev) => ({
      ...prev,
      type,
      normalBalance: defaultNormalBalance(type),
    }));
  }

  async function handleSubmit() {
    if (!form.code.trim() || !form.nameAr.trim()) {
      toast({ title: "الرمز والاسم العربي مطلوبان", variant: "destructive" });
      return;
    }
    if (!profile) { return; }

    // Guard against duplicate codes within this profile (DB enforces this too).
    const duplicate = accounts.find(
      (a) => a.code === form.code.trim() && a.id !== editing?.id
    );
    if (duplicate) {
      toast({ title: "رمز الحساب مستخدم بالفعل", variant: "destructive" });
      return;
    }

    try {
      if (editing) {
        await updateAccount.mutateAsync({
          id: editing.id,
          data: {
            code: form.code.trim(),
            nameAr: form.nameAr.trim(),
            name: form.name.trim() || form.nameAr.trim(),
            type: form.type,
            normalBalance: form.normalBalance,
          },
        });
        toast({ title: "تم تحديث الحساب بنجاح" });
      } else {
        await createAccount.mutateAsync({
          id: `acc-${crypto.randomUUID()}`,
          profileId: profile.id,
          code: form.code.trim(),
          nameAr: form.nameAr.trim(),
          name: form.name.trim() || form.nameAr.trim(),
          type: form.type,
          normalBalance: form.normalBalance,
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        toast({ title: "تم إضافة الحساب بنجاح" });
      }
      setDialogOpen(false);
    } catch (e) {
      console.error("Account save failed:", e);
      toast({ title: "فشل الحفظ. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  async function handleDeactivate() {
    if (!deactivateTarget) { return; }
    try {
      await deactivateAccount.mutateAsync(deactivateTarget.id);
      toast({ title: "تم تعطيل الحساب" });
      setDeactivateTarget(null);
    } catch (e) {
      console.error("Account deactivate failed:", e);
      toast({ title: "فشل التعطيل. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  const isSaving = createAccount.isPending || updateAccount.isPending;

  return (
    <div dir="rtl" className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">دليل الحسابات</h1>
          <p className="text-sm text-slate-500 mt-1">{accounts.length} حساب</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة حساب
        </Button>
      </div>

      {isLoading ? (
        <p className="text-slate-500 py-8 text-center">جاري التحميل...</p>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={ListTree}
          title="لا توجد حسابات"
          description="دليل الحسابات فارغ. أضف الحسابات لبناء نظامك المحاسبي"
          action={{ label: "إضافة حساب", onClick: openAdd }}
        />
      ) : (
        <div className="space-y-6">
          {TYPE_ORDER.map((type) => {
            const rows = grouped.get(type) ?? [];
            if (rows.length === 0) { return null; }
            return (
              <div key={type} className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  {TYPE_LABELS[type]}
                  <span className="text-slate-400 font-normal mr-2">({rows.length})</span>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-28">الرمز</TableHead>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right w-32">طبيعة الرصيد</TableHead>
                      <TableHead className="text-right w-24">الحالة</TableHead>
                      <TableHead className="text-left w-28">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((account) => (
                      <TableRow key={account.id} className={account.isActive ? "" : "opacity-50"}>
                        <TableCell className="font-mono text-slate-700">{account.code}</TableCell>
                        <TableCell className="font-medium text-slate-800">
                          {account.nameAr}
                          {account.isSystemAccount ? (
                            <Badge variant="secondary" className="mr-2 text-[10px]">نظام</Badge>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {account.normalBalance === "debit" ? "مدين" : "دائن"}
                        </TableCell>
                        <TableCell>
                          {account.isActive ? (
                            <Badge variant="cleared">نشط</Badge>
                          ) : (
                            <Badge variant="secondary">معطل</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-left">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(account)} aria-label="تعديل">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeactivateTarget(account)}
                              aria-label="تعطيل"
                              disabled={!account.isActive || !!account.isSystemAccount}
                            >
                              <Ban className="h-4 w-4 text-danger-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الحساب" : "إضافة حساب جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="acc-code">الرمز *</Label>
                <Input
                  id="acc-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="1100"
                  className="font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acc-type">النوع</Label>
                <Select value={form.type} onValueChange={(v) => handleTypeChange(v as AccountType)}>
                  <SelectTrigger id="acc-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_ORDER.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-nameAr">الاسم بالعربية *</Label>
              <Input
                id="acc-nameAr"
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                placeholder="النقدية"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-name">الاسم بالإنجليزية</Label>
              <Input
                id="acc-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Cash"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-normal">طبيعة الرصيد</Label>
              <Select
                value={form.normalBalance}
                onValueChange={(v) => setForm({ ...form, normalBalance: v as NormalBalance })}
              >
                <SelectTrigger id="acc-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">مدين</SelectItem>
                  <SelectItem value="credit">دائن</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        onConfirm={handleDeactivate}
        title="تعطيل الحساب"
        description={`سيتم تعطيل الحساب "${deactivateTarget?.nameAr}". لن يظهر في القوائم النشطة لكن قيوده المحاسبية تبقى محفوظة.`}
        confirmText="تعطيل"
        cancelText="إلغاء"
        variant="warning"
        isLoading={deactivateAccount.isPending}
      />
    </div>
  );
}
