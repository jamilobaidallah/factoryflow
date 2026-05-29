"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Briefcase } from "lucide-react";
import {
  usePartnersLocal,
  useCreatePartnerLocal,
  useUpdatePartnerLocal,
  useDeletePartnerLocal,
} from "@/hooks/local/usePartnersLocal";
import { useActiveProfile } from "@/hooks/local/useActiveProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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

/** Mirrors the SQLite `partners` table row shape. */
interface PartnerRow {
  id: string;
  profileId: string;
  name: string;
  ownershipPercentage: number;
  phone: string;
  email: string;
  initialInvestment: number;
  joinDate: string;
  active: boolean;
  createdAt: string;
}

interface PartnerForm {
  name: string;
  ownershipPercentage: string;
  phone: string;
  email: string;
  initialInvestment: string;
  joinDate: string;
  active: boolean;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY_FORM: PartnerForm = {
  name: "",
  ownershipPercentage: "",
  phone: "",
  email: "",
  initialInvestment: "",
  joinDate: todayIso(),
  active: true,
};

export default function LocalPartnersPage() {
  const profile = useActiveProfile();
  const { data, isLoading } = usePartnersLocal();
  const createPartner = useCreatePartnerLocal();
  const updatePartner = useUpdatePartnerLocal();
  const deletePartner = useDeletePartnerLocal();

  const partners = (data as PartnerRow[] | undefined) ?? [];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PartnerRow | null>(null);
  const [form, setForm] = useState<PartnerForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<PartnerRow | null>(null);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(partner: PartnerRow) {
    setEditing(partner);
    setForm({
      name: partner.name,
      ownershipPercentage: String(partner.ownershipPercentage),
      phone: partner.phone,
      email: partner.email,
      initialInvestment: String(partner.initialInvestment),
      joinDate: partner.joinDate.slice(0, 10),
      active: partner.active,
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast({ title: "الاسم مطلوب", variant: "destructive" });
      return;
    }
    if (!profile) { return; }

    const ownership = parseFloat(form.ownershipPercentage) || 0;
    const investment = parseFloat(form.initialInvestment) || 0;
    if (ownership < 0 || ownership > 100) {
      toast({ title: "نسبة الملكية يجب أن تكون بين 0 و 100", variant: "destructive" });
      return;
    }

    try {
      if (editing) {
        await updatePartner.mutateAsync({
          id: editing.id,
          data: {
            name: form.name.trim(),
            ownershipPercentage: ownership,
            phone: form.phone.trim(),
            email: form.email.trim(),
            initialInvestment: investment,
            joinDate: new Date(form.joinDate).toISOString(),
            active: form.active,
          },
        });
        toast({ title: "تم تحديث الشريك بنجاح" });
      } else {
        await createPartner.mutateAsync({
          id: `par-${crypto.randomUUID()}`,
          profileId: profile.id,
          name: form.name.trim(),
          ownershipPercentage: ownership,
          phone: form.phone.trim(),
          email: form.email.trim(),
          initialInvestment: investment,
          joinDate: new Date(form.joinDate).toISOString(),
          active: form.active,
          createdAt: new Date().toISOString(),
        });
        toast({ title: "تم إضافة الشريك بنجاح" });
      }
      setDialogOpen(false);
    } catch (e) {
      console.error("Partner save failed:", e);
      toast({ title: "فشل الحفظ. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) { return; }
    try {
      await deletePartner.mutateAsync(deleteTarget.id);
      toast({ title: "تم حذف الشريك" });
      setDeleteTarget(null);
    } catch (e) {
      console.error("Partner delete failed:", e);
      toast({ title: "فشل الحذف. يرجى المحاولة مرة أخرى", variant: "destructive" });
    }
  }

  const isSaving = createPartner.isPending || updatePartner.isPending;
  const totalOwnership = partners
    .filter((p) => p.active)
    .reduce((sum, p) => sum + p.ownershipPercentage, 0);

  return (
    <div dir="rtl" className="px-6 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الشركاء</h1>
          <p className="text-sm text-slate-500 mt-1">
            {partners.length} شريك — إجمالي نسبة الملكية النشطة {totalOwnership}%
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة شريك
        </Button>
      </div>

      {isLoading ? (
        <p className="text-slate-500 py-8 text-center">جاري التحميل...</p>
      ) : partners.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="لا يوجد شركاء"
          description="أضف الشركاء لتتبع حصص الملكية ورأس المال"
          action={{ label: "إضافة شريك", onClick: openAdd }}
        />
      ) : (
        <div className="rounded-xl border border-slate-200/60 bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">نسبة الملكية</TableHead>
                <TableHead className="text-right">رأس المال الأولي</TableHead>
                <TableHead className="text-right">تاريخ الانضمام</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.map((partner) => (
                <TableRow key={partner.id}>
                  <TableCell className="font-medium text-slate-800">{partner.name}</TableCell>
                  <TableCell className="text-slate-600">{partner.ownershipPercentage}%</TableCell>
                  <TableCell className="text-slate-600">
                    {formatCurrency(partner.initialInvestment)}
                  </TableCell>
                  <TableCell className="text-slate-600">{formatShortDate(partner.joinDate)}</TableCell>
                  <TableCell>
                    {partner.active ? (
                      <Badge variant="cleared">نشط</Badge>
                    ) : (
                      <Badge variant="secondary">غير نشط</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-left">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(partner)} aria-label="تعديل">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(partner)} aria-label="حذف">
                        <Trash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{editing ? "تعديل الشريك" : "إضافة شريك جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="partner-name">الاسم *</Label>
              <Input
                id="partner-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="اسم الشريك"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="partner-ownership">نسبة الملكية (%)</Label>
                <Input
                  id="partner-ownership"
                  type="number"
                  min={0}
                  max={100}
                  value={form.ownershipPercentage}
                  onChange={(e) => setForm({ ...form, ownershipPercentage: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="partner-investment">رأس المال الأولي</Label>
                <Input
                  id="partner-investment"
                  type="number"
                  min={0}
                  value={form.initialInvestment}
                  onChange={(e) => setForm({ ...form, initialInvestment: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-phone">الهاتف</Label>
              <Input
                id="partner-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="رقم الهاتف"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-email">البريد الإلكتروني</Label>
              <Input
                id="partner-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partner-joindate">تاريخ الانضمام</Label>
              <Input
                id="partner-joindate"
                type="date"
                value={form.joinDate}
                onChange={(e) => setForm({ ...form, joinDate: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="partner-active"
                checked={form.active}
                onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
              />
              <Label htmlFor="partner-active" className="cursor-pointer">شريك نشط</Label>
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
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="حذف الشريك"
        description={`هل أنت متأكد من حذف "${deleteTarget?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="حذف"
        cancelText="إلغاء"
        variant="destructive"
        isLoading={deletePartner.isPending}
      />
    </div>
  );
}
