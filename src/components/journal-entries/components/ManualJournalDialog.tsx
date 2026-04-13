"use client";

import { useReducer, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, Plus, Trash2, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/firebase/provider";
import { safeAdd } from "@/lib/currency";
import { formatNumber } from "@/lib/date-utils";
import type { Account, JournalLine } from "@/types/accounting";
import { createJournalEntry } from "@/services/journalService";
import type { JournalLineFormData, LineAction } from "../types/journal-form";

// ============================================================================
// Reducer
// ============================================================================

const EMPTY_LINE = (): JournalLineFormData => ({
  accountCode: "",
  accountNameAr: "",
  debit: "",
  credit: "",
  description: "",
});

function lineReducer(state: JournalLineFormData[], action: LineAction): JournalLineFormData[] {
  switch (action.type) {
    case "ADD_LINE":
      return [...state, EMPTY_LINE()];
    case "REMOVE_LINE":
      return state.filter((_, i) => i !== action.payload);
    case "UPDATE_LINE": {
      const { index, field, value } = action.payload;
      return state.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      );
    }
    case "RESET_LINES":
      return [EMPTY_LINE(), EMPTY_LINE()];
    default:
      return state;
  }
}

// ============================================================================
// Account Combobox
// ============================================================================

interface AccountComboboxProps {
  accounts: Account[];
  value: string;
  onChange: (code: string, nameAr: string) => void;
}

function AccountCombobox({ accounts, value, onChange }: AccountComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.code === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm text-right",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            !value && "text-muted-foreground"
          )}
          aria-expanded={open}
          aria-label="اختر الحساب"
        >
          <span className="truncate">
            {selected ? `${selected.code} — ${selected.nameAr}` : "اختر حساباً…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 mr-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="بحث بالكود أو الاسم…" className="text-right" />
          <CommandList>
            <CommandEmpty>لا توجد نتائج</CommandEmpty>
            <CommandGroup>
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={`${account.code} ${account.nameAr} ${account.name}`}
                  onSelect={() => {
                    onChange(account.code, account.nameAr);
                    setOpen(false);
                  }}
                  className="text-right"
                >
                  <span className="font-mono text-xs text-slate-400 ml-2">{account.code}</span>
                  {account.nameAr}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ============================================================================
// Main dialog
// ============================================================================

interface ManualJournalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onSuccess: () => void;
}

export function ManualJournalDialog({
  open,
  onOpenChange,
  accounts,
  onSuccess,
}: ManualJournalDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [lines, dispatch] = useReducer(lineReducer, undefined, () => [EMPTY_LINE(), EMPTY_LINE()]);
  const [loading, setLoading] = useState(false);

  // Totals
  const { totalDebit, totalCredit, isBalanced } = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    for (const line of lines) {
      totalDebit = safeAdd(totalDebit, parseFloat(line.debit) || 0);
      totalCredit = safeAdd(totalCredit, parseFloat(line.credit) || 0);
    }
    const diff = Math.abs(totalDebit - totalCredit);
    return { totalDebit, totalCredit, isBalanced: diff < 0.01 };
  }, [lines]);

  const handleClose = () => {
    if (!loading) {
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      dispatch({ type: "RESET_LINES" });
      onOpenChange(false);
    }
  };

  const handleSave = async () => {
    if (!user?.dataOwnerId) return;

    if (!description.trim()) {
      toast({ title: "خطأ", description: "البيان مطلوب", variant: "destructive" });
      return;
    }
    if (!isBalanced) {
      toast({ title: "القيد غير متزن", description: "يجب أن تتساوى المدين والدائن", variant: "destructive" });
      return;
    }
    if (lines.some((l) => !l.accountCode)) {
      toast({ title: "خطأ", description: "يجب اختيار حساب لكل سطر", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const journalLines: JournalLine[] = lines.map((l) => ({
        accountCode: l.accountCode,
        accountName: accounts.find((a) => a.code === l.accountCode)?.name ?? l.accountCode,
        accountNameAr: l.accountNameAr,
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        description: l.description || undefined,
      }));

      const result = await createJournalEntry(
        user.dataOwnerId,
        description,
        new Date(date),
        journalLines,
        undefined,
        undefined,
        "manual"
      );

      if (result.success) {
        toast({ title: "تم الحفظ", description: "تم حفظ القيد اليومي بنجاح" });
        onSuccess();
        handleClose();
      } else {
        toast({ title: "خطأ", description: result.error, variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>قيد يومي جديد</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Header fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="description">البيان</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="وصف القيد…"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="date">التاريخ</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-left"
              />
            </div>
          </div>

          {/* Lines table */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_100px_100px_1fr_32px] gap-2 text-xs font-medium text-slate-500 px-1">
              <span>الحساب</span>
              <span className="text-left">مدين</span>
              <span className="text-left">دائن</span>
              <span>بيان السطر</span>
              <span />
            </div>

            {lines.map((line, index) => (
              <div
                key={index}
                className="grid grid-cols-[1fr_100px_100px_1fr_32px] gap-2 items-center"
              >
                <AccountCombobox
                  accounts={accounts}
                  value={line.accountCode}
                  onChange={(code, nameAr) => {
                    dispatch({ type: "UPDATE_LINE", payload: { index, field: "accountCode", value: code } });
                    dispatch({ type: "UPDATE_LINE", payload: { index, field: "accountNameAr", value: nameAr } });
                  }}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.debit}
                  onChange={(e) => {
                    dispatch({ type: "UPDATE_LINE", payload: { index, field: "debit", value: e.target.value } });
                    if (e.target.value) {
                      dispatch({ type: "UPDATE_LINE", payload: { index, field: "credit", value: "" } });
                    }
                  }}
                  placeholder="0.00"
                  className="text-left text-sm"
                />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.credit}
                  onChange={(e) => {
                    dispatch({ type: "UPDATE_LINE", payload: { index, field: "credit", value: e.target.value } });
                    if (e.target.value) {
                      dispatch({ type: "UPDATE_LINE", payload: { index, field: "debit", value: "" } });
                    }
                  }}
                  placeholder="0.00"
                  className="text-left text-sm"
                />
                <Input
                  value={line.description}
                  onChange={(e) =>
                    dispatch({ type: "UPDATE_LINE", payload: { index, field: "description", value: e.target.value } })
                  }
                  placeholder="بيان اختياري"
                  className="text-sm"
                />
                <button
                  type="button"
                  className="flex items-center justify-center h-9 w-8 rounded-md text-slate-400 hover:text-danger-600 hover:bg-danger-50 transition-colors disabled:opacity-30"
                  onClick={() => dispatch({ type: "REMOVE_LINE", payload: index })}
                  disabled={lines.length <= 2}
                  aria-label="حذف السطر"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => dispatch({ type: "ADD_LINE" })}
              className="gap-1 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة سطر
            </Button>
          </div>

          {/* Totals */}
          <div className="flex items-center justify-end gap-6 pt-2 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              إجمالي مدين:{" "}
              <span className="font-medium text-slate-800">{formatNumber(totalDebit, 2)}</span>
            </span>
            <span className="text-slate-500">
              إجمالي دائن:{" "}
              <span className="font-medium text-slate-800">{formatNumber(totalCredit, 2)}</span>
            </span>
            <span
              className={cn(
                "font-semibold",
                isBalanced ? "text-success-700" : "text-danger-600"
              )}
            >
              {isBalanced ? "القيد متزن ✓" : "القيد غير متزن"}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={loading || !isBalanced}>
            {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            حفظ القيد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
