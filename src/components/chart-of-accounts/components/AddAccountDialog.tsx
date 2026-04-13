"use client";

import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getNormalBalance, ACCOUNT_CODE_RANGES, type Account, type AccountType, type NormalBalance } from "@/types/accounting";
import {
  createAccount,
  updateAccount,
  type CreateAccountInput,
} from "@/services/journalService";
import { useUser } from "@/firebase/provider";

const TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: "asset", label: "أصل" },
  { value: "liability", label: "التزام" },
  { value: "equity", label: "حقوق ملكية" },
  { value: "revenue", label: "إيراد" },
  { value: "expense", label: "مصروف" },
];

const NORMAL_BALANCE_OPTIONS: { value: NormalBalance; label: string }[] = [
  { value: "debit", label: "مدين" },
  { value: "credit", label: "دائن" },
];

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, dialog is in edit mode */
  editAccount?: Account | null;
  /** Existing account codes to avoid collisions in suggestion */
  existingCodes: string[];
  onSuccess: () => void;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  editAccount,
  existingCodes,
  onSuccess,
}: AddAccountDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const isEditMode = !!editAccount;

  const [code, setCode] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("asset");
  const [normalBalance, setNormalBalance] = useState<NormalBalance>("debit");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Populate form when editing
  useEffect(() => {
    if (editAccount) {
      setCode(editAccount.code);
      setNameAr(editAccount.nameAr);
      setName(editAccount.name);
      setType(editAccount.type);
      setNormalBalance(editAccount.normalBalance);
    } else {
      setCode("");
      setNameAr("");
      setName("");
      setType("asset");
      setNormalBalance(getNormalBalance("asset"));
    }
    setErrors({});
  }, [editAccount, open]);

  // Auto-set normal balance when type changes (in create mode)
  const handleTypeChange = (val: AccountType) => {
    setType(val);
    setNormalBalance(getNormalBalance(val));
    // Suggest next code for this type
    if (!isEditMode) {
      setCode(suggestCode(val, existingCodes));
    }
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!isEditMode && !/^\d{4}$/.test(code)) {
      errs.code = "الكود يجب أن يكون 4 أرقام";
    }
    if (!nameAr.trim()) {
      errs.nameAr = "الاسم العربي مطلوب";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!user?.dataOwnerId || !validate()) return;

    setLoading(true);
    try {
      if (isEditMode && editAccount) {
        const result = await updateAccount(user.dataOwnerId, editAccount.id, {
          name: name || nameAr,
          nameAr,
          description: undefined,
        });
        if (result.success) {
          toast({ title: "تم التعديل", description: "تم تعديل الحساب بنجاح" });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ title: "خطأ", description: result.error, variant: "destructive" });
        }
      } else {
        const input: CreateAccountInput = {
          code,
          name: name || nameAr,
          nameAr,
          type,
          normalBalance,
        };
        const result = await createAccount(user.dataOwnerId, input);
        if (result.success) {
          toast({ title: "تم الإنشاء", description: `تم إنشاء الحساب ${code} بنجاح` });
          onSuccess();
          onOpenChange(false);
        } else {
          toast({ title: "خطأ", description: result.error, variant: "destructive" });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "تعديل الحساب" : "إضافة حساب جديد"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Code — immutable in edit mode */}
          <div className="grid gap-1.5">
            <Label htmlFor="code">كود الحساب</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={isEditMode}
              placeholder="مثال: 1250"
              maxLength={4}
              className="text-left"
              aria-invalid={!!errors.code}
              aria-describedby={errors.code ? "code-error" : undefined}
            />
            {errors.code && (
              <p id="code-error" className="text-xs text-danger-600">{errors.code}</p>
            )}
          </div>

          {/* Arabic name */}
          <div className="grid gap-1.5">
            <Label htmlFor="nameAr">الاسم العربي</Label>
            <Input
              id="nameAr"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              placeholder="مثال: النقدية في الصندوق"
              aria-invalid={!!errors.nameAr}
              aria-describedby={errors.nameAr ? "nameAr-error" : undefined}
            />
            {errors.nameAr && (
              <p id="nameAr-error" className="text-xs text-danger-600">{errors.nameAr}</p>
            )}
          </div>

          {/* Type — immutable in edit mode */}
          <div className="grid gap-1.5">
            <Label>نوع الحساب</Label>
            <Select
              value={type}
              onValueChange={(v) => handleTypeChange(v as AccountType)}
              disabled={isEditMode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Normal balance — immutable in edit mode */}
          <div className="grid gap-1.5">
            <Label>الرصيد الطبيعي</Label>
            <Select
              value={normalBalance}
              onValueChange={(v) => setNormalBalance(v as NormalBalance)}
              disabled={isEditMode}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NORMAL_BALANCE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
            {isEditMode ? "حفظ التعديلات" : "إنشاء الحساب"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Suggest the next available code in a type's range
 * Strategy: max existing code in range + 10 (rounded to nearest 10)
 */
function suggestCode(type: AccountType, existingCodes: string[]): string {
  const range = ACCOUNT_CODE_RANGES[type];
  const codesInRange = existingCodes
    .map(Number)
    .filter((n) => n >= range.min && n <= range.max);

  if (codesInRange.length === 0) {
    return String(range.min);
  }

  const maxCode = Math.max(...codesInRange);
  const suggested = maxCode + 10;

  if (suggested > range.max) {
    return "";
  }

  // Round to nearest 10 if not already
  const rounded = Math.round(suggested / 10) * 10;
  return rounded <= range.max ? String(rounded) : String(suggested);
}
