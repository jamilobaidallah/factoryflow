/**
 * SaveFavoriteDialog - Dialog for saving a ledger entry as a favorite
 */

import { useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLedgerFavorites } from "@/hooks/useLedgerFavorites";
import { parseAmount } from "@/lib/currency";
import type { LedgerFormData } from "../types/ledger";

interface SaveFavoriteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  formData: LedgerFormData;
  entryType: string;
}

export function SaveFavoriteDialog({
  isOpen,
  onClose,
  formData,
  entryType,
}: SaveFavoriteDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { saveFavoriteFromForm, isSaving } = useLedgerFavorites();

  const handleSave = async () => {
    if (!name.trim()) {
      setError("اسم المفضلة مطلوب");
      return;
    }

    const amount = parseAmount(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("المبلغ غير صحيح");
      return;
    }

    const success = await saveFavoriteFromForm(name.trim(), formData, entryType);
    if (success) {
      setName("");
      setError(null);
      onClose();
    }
  };

  const handleClose = () => {
    setName("");
    setError(null);
    onClose();
  };

  // Generate a suggested name based on the form data
  const suggestedName = formData.subCategory || formData.category || "";

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-500" />
            حفظ كمفضلة
          </DialogTitle>
          <DialogDescription>
            احفظ هذه الحركة كمفضلة للوصول السريع لاحقاً
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="favorite-name">اسم المفضلة</Label>
            <Input
              id="favorite-name"
              placeholder={suggestedName || "مثال: إيجار شهري"}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              className={error ? "border-danger-500" : ""}
              autoFocus
            />
            {error && <p className="text-sm text-danger-600">{error}</p>}
          </div>

          {/* Preview of what will be saved */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500 mb-2">سيتم حفظ:</p>
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-slate-500">التصنيف:</span>{" "}
                <span className="font-medium">{formData.category}</span>
                {formData.subCategory && (
                  <span className="text-slate-400"> • {formData.subCategory}</span>
                )}
              </p>
              <p>
                <span className="text-slate-500">المبلغ:</span>{" "}
                <span className="font-medium">{formData.amount} دينار</span>
              </p>
              {formData.associatedParty && (
                <p>
                  <span className="text-slate-500">الطرف:</span>{" "}
                  <span className="font-medium">{formData.associatedParty}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            <Star className="h-4 w-4" />
            {isSaving ? "جاري الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
